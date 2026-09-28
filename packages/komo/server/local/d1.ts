import type { DatabaseSync, SQLInputValue, StatementSync } from "node:sqlite";
import { tombstone } from "./activity";

// A D1Database over node:sqlite, for running the unchanged Worker in Node.
// It covers what server/*.ts uses: prepare, bind, first(column?), all, run,
// batch, `.results` and `meta.changes`. Check that list again after every
// upstream merge; a Worker that starts using exec, raw or withSession fails
// here with "is not a function" instead of misbehaving.

type Row = Record<string, unknown>;
type Result<T> = {
  success: true;
  results: T[];
  meta: {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
    last_row_id: number;
    changed_db: boolean;
    changes: number;
  };
};

const writes = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;
const readers = /^\s*(?:SELECT|WITH|PRAGMA|VALUES|EXPLAIN)\b|\bRETURNING\b/i;

// D1 stores booleans as 0/1 and refuses undefined. node:sqlite binds every JS
// number as REAL, so safe integers become BigInt to keep INTEGER storage.
function value(input: unknown): SQLInputValue {
  if (input === null || typeof input === "string" || typeof input === "bigint")
    return input;
  if (typeof input === "boolean") return input ? 1n : 0n;
  if (typeof input === "number")
    return Number.isSafeInteger(input) ? BigInt(input) : input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input))
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError(
    `D1_TYPE_ERROR: Type '${typeof input}' not supported for value '${String(input)}'`,
  );
}

class Statement {
  constructor(
    private readonly db: LocalD1,
    readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.db, this.sql, values.map(value));
  }
  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.execute<Row>().results[0];
    if (!row) return null;
    if (column === undefined) return row as T;
    if (!(column in row))
      throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    return row[column] as T;
  }
  async all<T = Row>(): Promise<Result<T>> {
    return this.execute<T>();
  }
  async run<T = Row>(): Promise<Result<T>> {
    return this.execute<T>();
  }
  /** Runs the statement to completion, synchronously. */
  execute<T>(): Result<T> {
    const started = performance.now();
    const statement = this.db.statement(this.sql);
    const returnsRows =
      typeof statement.columns === "function"
        ? statement.columns().length > 0
        : readers.test(this.sql);
    let results: T[] = [],
      changes = 0,
      lastRowId = 0;
    if (returnsRows) {
      // Plain objects: node:sqlite rows have a null prototype.
      results = statement.all(...this.params).map((row) => ({ ...row }) as T);
      if (writes.test(this.sql)) ({ changes, lastRowId } = this.db.changes());
    } else {
      const outcome = statement.run(...this.params);
      changes = Number(outcome.changes);
      lastRowId = Number(outcome.lastInsertRowid);
    }
    if (changes) this.db.recordPageWrite(this.sql, this.params);
    return {
      success: true,
      results,
      meta: {
        duration: performance.now() - started,
        size_after: 0,
        rows_read: results.length,
        rows_written: changes,
        last_row_id: lastRowId,
        changed_db: changes > 0,
        changes,
      },
    };
  }
}

class LocalD1 {
  private readonly cache = new Map<string, StatementSync>();
  constructor(
    private readonly database: DatabaseSync,
    private readonly origin?: string,
    private readonly audit = false,
    private readonly insideAgentAction = false,
  ) {}
  /** Keep page origin and reply state in the Worker's comment batch. */
  recordPageWrite(sql: string, params: SQLInputValue[]) {
    if (!this.audit) return;
    const now = Date.now();
    if (
      this.origin &&
      /^INSERT INTO threads\(id,project,repo,branch,page,anchor,created_at,updated_at\)/.test(
        sql,
      )
    ) {
      this.database
        .prepare(
          "INSERT INTO local_thread_origins(thread_id,origin,created_at) VALUES(?,?,?)",
        )
        .run(params[0], this.origin, now);
    } else if (
      this.origin &&
      /^INSERT INTO comments\(id,thread_id,user_id,body,created_at\)/.test(sql)
    ) {
      this.database
        .prepare(
          "INSERT INTO local_comment_origins(comment_id,thread_id,origin,updated_at) VALUES(?,?,?,?)",
        )
        .run(params[0], params[1], this.origin, now);
    } else if (
      /^UPDATE comments SET body=\?,edited_at=\? WHERE id=\?/.test(sql)
    ) {
      if (this.origin)
        this.database
          .prepare(
            `INSERT INTO local_comment_origins(comment_id,thread_id,origin,updated_at)
          SELECT id,thread_id,?,? FROM comments WHERE id=?
          ON CONFLICT(comment_id) DO UPDATE SET origin=excluded.origin,updated_at=excluded.updated_at`,
          )
          .run(this.origin, now, params[2]);
      else
        this.database
          .prepare("DELETE FROM local_comment_origins WHERE comment_id=?")
          .run(params[2]);
    }
    // Only a new human reply through the Worker's validated comment route
    // reopens a resolved thread. This runs inside the same Worker batch; edits,
    // agent replies and imported history do not reopen it.
    if (
      /^INSERT INTO comments\(id,thread_id,user_id,body,created_at\) SELECT /.test(
        sql,
      ) &&
      params[3] !== tombstone
    )
      this.database
        .prepare(
          `UPDATE threads SET resolved=0,resolved_by=NULL
        WHERE id=? AND resolved=1 AND NOT EXISTS (
          SELECT 1 FROM local_channels WHERE project=threads.project AND repo=threads.repo AND user_id=?
        )`,
        )
        .run(params[1], params[2]);
  }
  prepare(sql: string) {
    return new Statement(this, sql);
  }
  /** D1 runs a batch as one transaction, including inside an agent action. */
  async batch<T = Row>(statements: Statement[]): Promise<Result<T>[]> {
    const nested = this.insideAgentAction;
    this.database.exec(
      nested ? "SAVEPOINT komo_worker_batch" : "BEGIN IMMEDIATE",
    );
    try {
      const results = statements.map((statement) => statement.execute<T>());
      this.database.exec(nested ? "RELEASE komo_worker_batch" : "COMMIT");
      return results;
    } catch (error) {
      // SQLite may already have rolled back (SQLITE_FULL and similar).
      try {
        this.database.exec(
          nested ? "ROLLBACK TO komo_worker_batch" : "ROLLBACK",
        );
        if (nested) this.database.exec("RELEASE komo_worker_batch");
      } catch {}
      throw error;
    }
  }
  statement(sql: string) {
    let statement = this.cache.get(sql);
    if (!statement) {
      if (this.cache.size >= 500) this.cache.clear();
      statement = this.database.prepare(sql);
      this.cache.set(sql, statement);
    }
    return statement;
  }
  changes() {
    const row = this.statement(
      "SELECT changes() AS changes, last_insert_rowid() AS id",
    ).get() as { changes: number; id: number };
    return { changes: Number(row.changes), lastRowId: Number(row.id) };
  }
}

/** Wraps an open node:sqlite database as the Worker's `env.DB`. */
export function d1(
  database: DatabaseSync,
  origin?: string,
  audit = false,
  insideAgentAction = false,
): D1Database {
  return new LocalD1(
    database,
    origin,
    audit,
    insideAgentAction,
  ) as unknown as D1Database;
}
