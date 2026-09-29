/**
 * Persistence — SQLite, the single source of truth (design §6).
 *
 * Exactly ONE writer per file (design invariant). Pragmas: WAL, foreign_keys=ON (real FKs).
 * Migrations are an ordered, APPEND-ONLY array; `PRAGMA user_version` = count run; each step +
 * bump in one transaction. NEVER edit or reorder a shipped step (an earlier build spliced steps
 * and databases past that index skipped them forever). Step 0 is all `IF NOT EXISTS`. A
 * `healMissingColumns` pass on every open re-adds a handful of columns as a backstop.
 *
 * The audit log (autonomy_actions) is the source of truth for what autonomy has done; dedupe is
 * a UNIQUE key; rate limits are SQL counts so a restart cannot reset them.
 *
 * All timestamps are epoch ms; money is integer micros.
 */

import { Database } from "bun:sqlite";

export const PRAGMAS = ["PRAGMA journal_mode = WAL", "PRAGMA foreign_keys = ON"];

/**
 * Append-only migration steps. Step 0 creates the whole schema with IF NOT EXISTS.
 * To evolve the schema, PUSH a new string; never edit an existing one.
 */
export const MIGRATIONS: string[] = [
  // --- step 0: initial schema -------------------------------------------------
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'open',      -- open | closed
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    order_idx     INTEGER NOT NULL                   -- max+1 on create; human-assigned order
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id                    TEXT PRIMARY KEY,
    task_id               TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL DEFAULT '',
    tool                  TEXT NOT NULL,             -- claude | codex | copilot | openrouter
    location              TEXT NOT NULL,             -- local | devbox
    cwd                   TEXT NOT NULL,             -- load-bearing: resume is cwd-scoped
    uses_worktree         INTEGER NOT NULL DEFAULT 0,
    worktree_path         TEXT,
    model                 TEXT NOT NULL DEFAULT 'auto',
    permissions           TEXT NOT NULL DEFAULT 'ask',
    effort                TEXT,
    resume_handle         TEXT,                      -- claude uuid | copilot name | openrouter id | codex NULL
    tmux_session          TEXT,                      -- ao-<id8>
    closed                INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL,
    closed_at             INTEGER,                   -- COALESCE on re-close
    worktree_branch       TEXT,
    profile_id            TEXT NOT NULL DEFAULT 'legacy',
    codex_transcript_path TEXT,
    codex_session_id      TEXT,
    planning              INTEGER NOT NULL DEFAULT 0,
    draft_may_be_stranded INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS work_items (
    id                       TEXT PRIMARY KEY,
    session_id               TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    kind                     TEXT NOT NULL,          -- pr | ticket
    external_key             TEXT NOT NULL,          -- owner/repo#123 | HOS-1989
    repo                     TEXT,
    number                   INTEGER,
    url                      TEXT,
    title                    TEXT,
    branch                   TEXT,
    lifecycle                TEXT NOT NULL DEFAULT 'active', -- active | retiring | retired
    pr_state                 TEXT,
    is_draft                 INTEGER NOT NULL DEFAULT 0,
    ci_state                 TEXT,
    failed_checks            TEXT NOT NULL DEFAULT '[]',
    review_state             TEXT,
    mergeable                TEXT,
    head_sha                 TEXT,
    head_committed_at        INTEGER,
    head_observed_at         INTEGER,                -- first time WE saw this head
    codex_state              TEXT,
    codex_reviewed_sha       TEXT,
    cto_state                TEXT,
    cto_reviewed_at          INTEGER,
    cto_reviewed_sha         TEXT,
    review_bot_state         TEXT,
    review_bot_at            INTEGER,
    thermo_grade             TEXT,                   -- NULL = never graded = blocker
    thermo_cycles            INTEGER NOT NULL DEFAULT 0,
    greenlight_state         TEXT NOT NULL DEFAULT 'absent',
    unresolved_comments      INTEGER NOT NULL DEFAULT 0,
    operator_acked_at        INTEGER,
    outstanding_reviewer_tags TEXT NOT NULL DEFAULT '[]',
    tickets                  TEXT NOT NULL DEFAULT '[]',
    source                   TEXT NOT NULL DEFAULT 'auto', -- auto | manual | transfer
    created_at               INTEGER NOT NULL,
    updated_at               INTEGER NOT NULL,       -- poll timestamp — rewritten every poll
    remote_updated_at        INTEGER,               -- GitHub's own clock
    retired_at               INTEGER,
    last_polled_at           INTEGER,
    UNIQUE(session_id, external_key)
  );

  CREATE TABLE IF NOT EXISTS work_item_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    work_item_id  TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    at            INTEGER NOT NULL,
    field         TEXT NOT NULL,
    "from"        TEXT,
    "to"          TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id            TEXT PRIMARY KEY,
    session_id    TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    work_item_id  TEXT REFERENCES work_items(id) ON DELETE SET NULL,
    kind          TEXT NOT NULL,
    severity      TEXT NOT NULL DEFAULT 'attention', -- info | attention
    dedupe_key    TEXT NOT NULL UNIQUE,              -- MUST encode the transition
    summary       TEXT NOT NULL DEFAULT '',
    payload_json  TEXT NOT NULL DEFAULT '{}',
    attempts      INTEGER NOT NULL DEFAULT 0,        -- max 5
    created_at    INTEGER NOT NULL,
    notified_at   INTEGER,
    delivered_at  INTEGER,
    suppressed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS autonomy_actions (
    id            TEXT PRIMARY KEY,
    work_item_id  TEXT REFERENCES work_items(id) ON DELETE SET NULL,
    session_id    TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    dedupe_key    TEXT NOT NULL UNIQUE,              -- encodes the event identity, never the row
    status        TEXT NOT NULL,                     -- performed|queued|dry-run|suppressed|failed|undelivered|cancelled
    gate          TEXT,
    reason        TEXT,
    payload_json  TEXT NOT NULL DEFAULT '{}',
    created_at    INTEGER NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS session_usage (
    session_id           TEXT NOT NULL,
    model                TEXT NOT NULL,
    input_tokens         INTEGER NOT NULL DEFAULT 0,
    output_tokens        INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens    INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens   INTEGER NOT NULL DEFAULT 0,
    reported_cost_micros INTEGER,
    PRIMARY KEY (session_id, model)
  );

  CREATE TABLE IF NOT EXISTS session_usage_progress (
    session_id  TEXT NOT NULL,
    path        TEXT NOT NULL,
    byte_mark   INTEGER NOT NULL DEFAULT 0,          -- high-water mark
    PRIMARY KEY (session_id, path)
  );

  CREATE TABLE IF NOT EXISTS session_usage_sample (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    at          INTEGER NOT NULL,                    -- 14-day retention
    payload_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS session_usage_series (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    model       TEXT NOT NULL,
    at          INTEGER NOT NULL,                    -- 14-day retention; cumulative points
    cost_micros INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS session_usage_daily (
    session_id  TEXT NOT NULL,
    day         TEXT NOT NULL,                       -- local-midnight day; kept forever
    model       TEXT NOT NULL,
    cost_micros INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, day, model)
  );

  CREATE TABLE IF NOT EXISTS linear_projects (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT '',
    url        TEXT,
    state      TEXT,
    team_keys  TEXT NOT NULL DEFAULT '[]',
    hidden     INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER,
    synced_at  INTEGER,
    seen_at    INTEGER
  );

  CREATE TABLE IF NOT EXISTS linear_issues (
    id             TEXT PRIMARY KEY,
    identifier     TEXT NOT NULL,
    project_id     TEXT,
    team_key       TEXT,
    title          TEXT NOT NULL DEFAULT '',
    url            TEXT,
    state_name     TEXT,
    state_type     TEXT,
    assignee       TEXT,
    priority       INTEGER,
    blocked_by     TEXT NOT NULL DEFAULT '[]',
    sort_order     INTEGER NOT NULL DEFAULT 0,
    updated_at     INTEGER,
    synced_at      INTEGER,
    seen_at        INTEGER,
    assigned_to_me INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    score      INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
];

/**
 * Columns re-added on every open as a backstop against a spliced/rolled-back migration history
 * (design §6 healMissingColumns). Each entry: [table, column, DDL fragment].
 * TODO: populate as columns are added post-step-0.
 */
export const HEAL_COLUMNS: Array<[table: string, column: string, ddl: string]> = [];

/**
 * Run the append-only migrations under `PRAGMA user_version`, each step in one transaction, then
 * the heal pass. This is the schema skeleton — data-access methods below are stubs.
 */
export function migrate(db: Database): void {
  for (const p of PRAGMAS) db.run(p);
  const current = (db.query("PRAGMA user_version").get() as { user_version: number } | null)?.user_version ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    const step = MIGRATIONS[i]!;
    db.transaction(() => {
      db.run(step);
      db.run(`PRAGMA user_version = ${i + 1}`);
    })();
  }
  // TODO: apply HEAL_COLUMNS with IF-NOT-EXISTS semantics (ALTER TABLE ADD COLUMN, ignore dup).
}

/**
 * The typed data-access layer over the SQLite file. The daemon holds exactly one of these; the
 * Mac reads the box DB only through a one-shot read-only process.
 * TODO(step 1+): implement the query methods incrementally as each subsystem lands.
 */
export class Store {
  readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    migrate(this.db);
  }

  close(): void {
    this.db.close();
  }

  // Data-access methods (tasks, sessions, work items, alerts, audit, usage, linear) are added
  // per build step. See BUILD.md.
}
