import type { DatabaseSync } from "node:sqlite";
import type { OptionPick } from "../../src/types";

// Text options: an agent marks a block with candidate copy
// (`data-komo-options`), and the reviewer picks one in the dock. Picks reach
// the agent inside a note, so they wait for Send like any other note. The
// note carries them as rows here, keyed by its thread.

export type SentPick = OptionPick & {
  threadId: string;
  resolved: boolean;
  page: string;
  url: string | null;
  pickedAt: string;
};

const invalid = () =>
  Object.assign(
    Error("The text option picks are invalid. Reload the page and try again."),
    { status: 400 },
  );

/** Validate the picks a note carries. Undefined when it carries none. */
export function validatePicks(value: unknown): OptionPick[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw invalid();
  return value.map((item) => {
    const { block, selector, index, count, text, html, original } = (item ??
      {}) as Record<string, unknown>;
    const strings = [block, selector, text, html, original];
    if (
      !strings.every((field) => typeof field === "string") ||
      !(block as string).trim() ||
      (block as string).length > 200 ||
      (selector as string).length > 1000 ||
      (text as string).length > 4000 ||
      (html as string).length > 8000 ||
      (original as string).length > 8000 ||
      !Number.isInteger(count) ||
      (count as number) < 2 ||
      (count as number) > 100 ||
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) >= (count as number)
    )
      throw invalid();
    return {
      block,
      selector,
      index,
      count,
      text,
      html,
      original,
    } as OptionPick;
  });
}

/** Record a note's picks. Runs inside the transaction that creates the note. */
export function recordPicks(
  db: DatabaseSync,
  threadId: string,
  picks: OptionPick[],
) {
  const insert = db.prepare(
    "INSERT OR REPLACE INTO local_option_picks(thread_id,block,selector,choice,count,text,html,original) VALUES(?,?,?,?,?,?,?,?)",
  );
  for (const pick of picks)
    insert.run(
      threadId,
      pick.block,
      pick.selector,
      pick.index,
      pick.count,
      pick.text,
      pick.html,
      pick.original,
    );
}

type Row = {
  thread_id: string;
  block: string;
  selector: string;
  choice: number;
  count: number;
  text: string;
  html: string;
  original: string;
  page: string;
  resolved: number;
  created_at: number;
  origin: string | null;
};

const columns = `p.thread_id,p.block,p.selector,p.choice,p.count,p.text,p.html,p.original,
  t.page,t.resolved,t.created_at,o.origin
  FROM local_option_picks p JOIN threads t ON t.id=p.thread_id
  LEFT JOIN local_thread_origins o ON o.thread_id=t.id`;

function pick(row: Row): SentPick {
  return {
    threadId: row.thread_id,
    resolved: !!row.resolved,
    page: row.page,
    url: row.origin ? `${row.origin}${row.page}` : null,
    block: row.block,
    selector: row.selector,
    index: row.choice,
    count: row.count,
    text: row.text,
    html: row.html,
    original: row.original,
    pickedAt: new Date(row.created_at).toISOString(),
  };
}

/** The picks one note carries, in block order. */
export function picksOf(db: DatabaseSync, threadId: string): OptionPick[] {
  return (
    db
      .prepare(`SELECT ${columns} WHERE p.thread_id=? ORDER BY p.rowid`)
      .all(threadId) as Row[]
  ).map(({ block, selector, choice, count, text, html, original }) => ({
    block,
    selector,
    index: choice,
    count,
    text,
    html,
    original,
  }));
}

/**
 * The newest sent pick for each block on each page in some branches of a
 * project, newest first. A note on a branch other than the queue has been
 * sent. Without `all`, picks whose note is resolved are left out: the agent
 * applied them.
 */
export function sentPicks(
  db: DatabaseSync,
  scope: { project: string; repo: string; branches: string[] },
  all = false,
): SentPick[] {
  const rows = db
    .prepare(
      `SELECT ${columns}
      WHERE t.project=? AND t.repo=? AND t.branch IN (${scope.branches.map(() => "?").join(",")})
      ORDER BY t.created_at DESC, p.rowid`,
    )
    .all(scope.project, scope.repo, ...scope.branches) as Row[];
  const seen = new Set<string>();
  const latest: SentPick[] = [];
  for (const row of rows) {
    const key = JSON.stringify([row.origin, row.page, row.block]);
    if (seen.has(key)) continue;
    seen.add(key);
    if (all || !row.resolved) latest.push(pick(row));
  }
  return latest;
}
