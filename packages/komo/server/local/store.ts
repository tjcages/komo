import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { workerMigrations } from "./migrations";

// The local store: one SQLite file shared by every komo process on this
// machine. It holds the Worker's own tables, created by its D1 migrations, and
// the local-only tables below, which the Worker never reads.

const localMigrations = [
  {
    name: "local/0001_agent_mode",
    sql: `
CREATE TABLE local_registrations (
  project TEXT NOT NULL,
  channel TEXT NOT NULL,
  repo TEXT NOT NULL,
  origins TEXT,
  pid INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project, channel, pid)
);
CREATE TABLE local_channels (
  channel TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  repo TEXT NOT NULL,
  label TEXT NOT NULL,
  user_id TEXT,
  token TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX local_channels_project ON local_channels(project,repo);
CREATE TABLE local_agents (
  session TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  pid INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('waiting','working')),
  since INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX local_agents_channel ON local_agents(channel,last_seen);
CREATE TABLE local_claims (
  thread_id TEXT PRIMARY KEY,
  claim_key TEXT NOT NULL,
  holder_session TEXT NOT NULL,
  holder_pid INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE local_thread_origins (
  thread_id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE local_comment_origins (
  comment_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX local_comment_origins_thread ON local_comment_origins(thread_id);
`,
  },
  {
    // Batch Send: the last time the person pressed Send on an agent channel.
    // Channels that exist before this migration keep their notes delivered:
    // their watermark starts at the upgrade.
    name: "local/0002_batch_send",
    sql: `
CREATE TABLE local_sends (
  project TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (project, repo, branch)
);
INSERT INTO local_sends(project,repo,branch,sent_at)
  SELECT project,repo,channel,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) FROM local_channels;
`,
  },
  {
    // SQLite orders all comment writes, even when their timestamps tie. Old
    // same-millisecond writes are ordered with agents first, so an ambiguous
    // human follow-up stays unread; Send also holds writes at its timestamp.
    name: "local/0003_ordered_activity",
    sql: `
CREATE TABLE local_revision_clock (revision INTEGER NOT NULL);
INSERT INTO local_revision_clock(revision) VALUES(0);
CREATE TABLE local_comment_revisions (
  comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL
);
INSERT INTO local_comment_revisions(comment_id,revision)
  SELECT c.id,ROW_NUMBER() OVER (ORDER BY COALESCE(c.edited_at,c.created_at),
    c.user_id IN (SELECT user_id FROM local_channels WHERE user_id IS NOT NULL),c.created_at,c.id)
  FROM comments c;
UPDATE local_revision_clock SET revision=(SELECT COALESCE(MAX(revision),0) FROM local_comment_revisions);
CREATE TRIGGER local_comment_revision_insert AFTER INSERT ON comments BEGIN
  UPDATE local_revision_clock SET revision=revision+1;
  INSERT INTO local_comment_revisions(comment_id,revision)
    SELECT NEW.id,revision FROM local_revision_clock;
END;
CREATE TRIGGER local_comment_revision_edit AFTER UPDATE OF body ON comments BEGIN
  UPDATE local_revision_clock SET revision=revision+1;
  UPDATE local_comment_revisions SET revision=(SELECT revision FROM local_revision_clock)
    WHERE comment_id=NEW.id;
END;
ALTER TABLE local_sends ADD COLUMN sent_revision INTEGER NOT NULL DEFAULT 0;
UPDATE local_sends SET sent_revision=COALESCE((
  SELECT MAX(r.revision) FROM comments c
  JOIN threads t ON t.id=c.thread_id
  JOIN local_comment_revisions r ON r.comment_id=c.id
  WHERE t.project=local_sends.project AND t.repo=local_sends.repo
    AND t.branch=local_sends.branch
    AND COALESCE(c.edited_at,c.created_at)<local_sends.sent_at
),0);
`,
  },
];

/** The store file: $KOMO_DATA_HOME/local.sqlite, else ~/.local/share/komo. */
export function storePath(
  env: Record<string, string | undefined> = process.env,
) {
  return join(
    env.KOMO_DATA_HOME || join(homedir(), ".local", "share", "komo"),
    "local.sqlite",
  );
}

function sqlite(): typeof import("node:sqlite") {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13))
    throw Error(
      `komo local mode needs Node.js 22.13 or later for node:sqlite. This is Node.js ${process.versions.node}.`,
    );
  return process.getBuiltinModule("node:sqlite");
}

/**
 * A second connection to an open store, for reads only. `PRAGMA data_version`
 * on it changes on every commit by any other connection, including the main
 * connection of this process, which serves the browser.
 */
export function openProbe(path = storePath()): DatabaseSync {
  const { DatabaseSync } = sqlite();
  const database = new DatabaseSync(path);
  database.exec("PRAGMA busy_timeout=5000");
  return database;
}

/**
 * Switch the store to WAL. On a new file the switch needs an exclusive lock
 * that SQLite's busy timeout does not wait for, so agent sessions that start
 * together retry here for up to 5 s.
 */
function useWal(database: DatabaseSync) {
  const until = Date.now() + 5000;
  for (;;) {
    try {
      database.exec("PRAGMA journal_mode=WAL");
      return;
    } catch (error) {
      if (!/locked|busy/i.test((error as Error).message) || Date.now() > until)
        throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}

/** Open the store, private to this user, and bring its schema up to date. */
export function openStore(path = storePath()): DatabaseSync {
  const { DatabaseSync } = sqlite();
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  // Create the file 0600 before SQLite opens it; its WAL files copy the mode.
  closeSync(openSync(path, "a", 0o600));
  chmodSync(path, 0o600);
  const database = new DatabaseSync(path);
  database.exec("PRAGMA busy_timeout=5000");
  useWal(database);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec(
    "CREATE TABLE IF NOT EXISTS komo_local_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const applied = database.prepare(
    "SELECT 1 FROM komo_local_migrations WHERE name=?",
  );
  const record = database.prepare(
    "INSERT INTO komo_local_migrations(name,applied_at) VALUES(?,?)",
  );
  for (const { name, sql } of [...workerMigrations(), ...localMigrations]) {
    if (applied.get(name)) continue;
    // Another process may apply the same migration first; check again inside
    // the write lock.
    database.exec("BEGIN IMMEDIATE");
    try {
      if (!applied.get(name)) {
        database.exec(sql);
        record.run(name, Date.now());
      }
      database.exec("COMMIT");
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {}
      throw Error(
        `komo could not apply migration ${name}: ${(error as Error).message}`,
      );
    }
  }
  return database;
}
