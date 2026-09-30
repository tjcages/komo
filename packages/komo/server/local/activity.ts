import type { DatabaseSync } from "node:sqlite";

// SQLite assigns a revision to each comment write in transaction order.
// Activity, Send and the edit guard use it together: an edit to an older
// message counts as new human activity, and a write committed after Send
// stays held even when both operations capture the same wall-clock time.

export const tombstone = "[Comment deleted]";

export type Activity = {
  id: string;
  branch: string;
  resolved: boolean;
  /**
   * A person had the last word: the last message is theirs, or they edited a
   * message after the last agent message. Deleted messages do not count.
   */
  waiting: boolean;
  /** The page origin of the thread's first write, when known. */
  threadOrigin?: string;
  /** The page origin of the latest human activity, when known. */
  humanOrigin?: string;
  /** `thread:comment:revision` of the latest human activity, or null with none. */
  key: string | null;
  /** On an agent channel, with human activity after the last Send. */
  held: boolean;
  /** On an agent channel, the revision at its last Send; null elsewhere. */
  sentRevision: number | null;
};

type Row = {
  id: string;
  branch: string;
  resolved: number;
  waiting: number;
  thread_origin: string | null;
  human_origin: string | null;
  human_id: string | null;
  human_revision: number | null;
  channel: number;
  sent_revision: number;
};

/**
 * The activity of the threads on some branches of a project, oldest first.
 * `open` keeps unresolved threads only; `threadId` reads one thread.
 */
export function activity(
  database: DatabaseSync,
  scope: {
    project: string;
    repo: string;
    branches: string[];
    open?: boolean;
    threadId?: string;
  },
): Activity[] {
  const rows = database
    .prepare(
      `WITH agents AS (SELECT user_id FROM local_channels WHERE project=? AND user_id IS NOT NULL)
      SELECT t.id,t.branch,t.resolved,
        (h.id IS NOT NULL AND (l.id=h.id OR hr.revision>COALESCE(
          (SELECT MAX(ar.revision) FROM comments ac
            JOIN local_comment_revisions ar ON ar.comment_id=ac.id
            WHERE ac.thread_id=t.id AND ac.body<>? AND ac.user_id IN (SELECT user_id FROM agents)),0))) AS waiting,
        o.origin AS thread_origin,ho.origin AS human_origin,
        h.id AS human_id,hr.revision AS human_revision,
        EXISTS(SELECT 1 FROM local_channels c WHERE c.channel=t.branch AND c.project=t.project AND c.repo=t.repo) AS channel,
        COALESCE(s.sent_revision,0) AS sent_revision
      FROM threads t
      LEFT JOIN comments l ON l.id=(SELECT id FROM comments WHERE thread_id=t.id AND body<>?
        ORDER BY created_at DESC,user_id IN (SELECT user_id FROM agents),id DESC LIMIT 1)
      LEFT JOIN comments h ON h.id=(SELECT c.id FROM comments c
        JOIN local_comment_revisions r ON r.comment_id=c.id
        WHERE c.thread_id=t.id AND c.body<>? AND c.user_id NOT IN (SELECT user_id FROM agents)
        ORDER BY r.revision DESC LIMIT 1)
      LEFT JOIN local_comment_revisions hr ON hr.comment_id=h.id
      LEFT JOIN local_thread_origins o ON o.thread_id=t.id
      LEFT JOIN local_comment_origins ho ON ho.comment_id=h.id
      LEFT JOIN local_sends s ON s.project=t.project AND s.repo=t.repo AND s.branch=t.branch
      WHERE t.project=? AND t.repo=? AND t.branch IN (${scope.branches.map(() => "?").join(",")})
        ${scope.open ? "AND t.resolved=0" : ""} ${scope.threadId ? "AND t.id=?" : ""}
      ORDER BY t.created_at,t.id`,
    )
    .all(
      scope.project,
      tombstone,
      tombstone,
      tombstone,
      scope.project,
      scope.repo,
      ...scope.branches,
      ...(scope.threadId ? [scope.threadId] : []),
    ) as Row[];
  return rows.map((row) => ({
    id: row.id,
    branch: row.branch,
    resolved: !!row.resolved,
    waiting: !!row.waiting,
    threadOrigin: row.thread_origin ?? undefined,
    humanOrigin: row.human_origin ?? undefined,
    key: row.human_id
      ? `${row.id}:${row.human_id}:${row.human_revision}`
      : null,
    held:
      !!row.channel &&
      row.human_revision !== null &&
      row.human_revision > row.sent_revision,
    sentRevision: row.channel ? row.sent_revision : null,
  }));
}

/** Open threads that wait for an agent on one branch: held, and sent. */
export function sendCounts(
  database: DatabaseSync,
  scope: { project: string; repo: string; branch: string },
) {
  let held = 0,
    sent = 0;
  for (const row of activity(database, {
    ...scope,
    branches: [scope.branch],
    open: true,
  }))
    if (row.waiting) row.held ? held++ : sent++;
  return { held, sent };
}

/**
 * Press Send on an agent channel: every thread held there becomes
 * deliverable, on every page. The watermark never moves back.
 */
export function sendChannel(
  database: DatabaseSync,
  scope: { project: string; repo: string; branch: string },
  insideTransaction = false,
) {
  if (!insideTransaction) database.exec("BEGIN IMMEDIATE");
  try {
    const released = sendCounts(database, scope).held;
    database
      .prepare(
        `INSERT INTO local_sends(project,repo,branch,sent_at,sent_revision)
        SELECT ?,?,?,?,revision FROM local_revision_clock WHERE true
        ON CONFLICT(project,repo,branch) DO UPDATE SET
          sent_at=MAX(sent_at,excluded.sent_at),
          sent_revision=MAX(sent_revision,excluded.sent_revision)`,
      )
      .run(scope.project, scope.repo, scope.branch, Date.now());
    const counts = sendCounts(database, scope);
    if (!insideTransaction) database.exec("COMMIT");
    return { released, ...counts };
  } catch (error) {
    if (!insideTransaction) try {
      database.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}
