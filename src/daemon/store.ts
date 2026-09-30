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
import type {
  Task, TaskStatus, Session, Tool, Location, Permissions, Effort,
} from "../shared/types.ts";

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

type Row = Record<string, any>;

const b = (v: unknown): boolean => v === 1 || v === true;
const i = (v: boolean): number => (v ? 1 : 0);

export interface CreateTaskParams {
  name: string;
  description?: string;
}

export interface CreateSessionParams {
  taskId: string;
  title?: string;
  tool: Tool;
  location: Location;
  cwd: string;
  usesWorktree?: boolean;
  worktreePath?: string | null;
  model?: string;
  permissions?: Permissions;
  effort?: Effort | null;
  resumeHandle?: string | null;
  tmuxSession?: string | null;
  worktreeBranch?: string | null;
  profileId?: string;
}

/** Fields of a session that may be updated after creation. */
export type SessionPatch = Partial<Pick<Session,
  | "title" | "cwd" | "usesWorktree" | "model" | "permissions" | "effort" | "resumeHandle"
  | "tmuxSession" | "worktreePath" | "worktreeBranch" | "planning" | "draftMayBeStranded"
  | "codexTranscriptPath" | "codexSessionId">>;

/**
 * The typed data-access layer over the SQLite file (design §6). The daemon holds exactly one of
 * these; the Mac reads the box DB only through a one-shot read-only process. Methods are added per
 * build step — Milestone 1 covers tasks and sessions.
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

  // --- tasks ---------------------------------------------------------------

  createTask(params: CreateTaskParams): Task {
    const now = Date.now();
    const id = crypto.randomUUID();
    const nextIdx =
      (this.db.query("SELECT COALESCE(MAX(order_idx), 0) + 1 AS n FROM tasks").get() as Row).n as number;
    this.db.run(
      `INSERT INTO tasks (id, name, description, status, created_at, updated_at, order_idx)
       VALUES (?, ?, ?, 'open', ?, ?, ?)`,
      [id, params.name, params.description ?? "", now, now, nextIdx],
    );
    return this.getTask(id)!;
  }

  getTask(id: string): Task | null {
    const row = this.db.query("SELECT * FROM tasks WHERE id = ?").get(id) as Row | null;
    return row ? rowToTask(row) : null;
  }

  /** Human-assigned order: open tasks first, then by order_idx (design §6). */
  listTasks(includeClosed = true): Task[] {
    const sql = includeClosed
      ? "SELECT * FROM tasks ORDER BY (status = 'closed') ASC, order_idx ASC"
      : "SELECT * FROM tasks WHERE status = 'open' ORDER BY order_idx ASC";
    return (this.db.query(sql).all() as Row[]).map(rowToTask);
  }

  updateTask(id: string, patch: { name?: string; description?: string }): Task | null {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (patch.name !== undefined) { sets.push("name = ?"); vals.push(patch.name); }
    if (patch.description !== undefined) { sets.push("description = ?"); vals.push(patch.description); }
    if (sets.length === 0) return this.getTask(id);
    sets.push("updated_at = ?"); vals.push(Date.now());
    vals.push(id);
    this.db.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, vals as any);
    return this.getTask(id);
  }

  closeTask(id: string): void {
    this.db.run("UPDATE tasks SET status = 'closed', updated_at = ? WHERE id = ?", [Date.now(), id]);
  }

  reopenTask(id: string): void {
    this.db.run("UPDATE tasks SET status = 'open', updated_at = ? WHERE id = ?", [Date.now(), id]);
  }

  // --- sessions ------------------------------------------------------------

  createSession(params: CreateSessionParams): Session {
    const now = Date.now();
    const id = crypto.randomUUID();
    this.db.run(
      `INSERT INTO sessions (
         id, task_id, title, tool, location, cwd, uses_worktree, worktree_path, model,
         permissions, effort, resume_handle, tmux_session, closed, created_at, closed_at,
         worktree_branch, profile_id, codex_transcript_path, codex_session_id, planning,
         draft_may_be_stranded
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, NULL, NULL, 0, 0)`,
      [
        id, params.taskId, params.title ?? "", params.tool, params.location, params.cwd,
        i(params.usesWorktree ?? false), params.worktreePath ?? null, params.model ?? "auto",
        params.permissions ?? "ask", params.effort ?? null, params.resumeHandle ?? null,
        params.tmuxSession ?? null, now, params.worktreeBranch ?? null, params.profileId ?? "legacy",
      ],
    );
    return this.getSession(id)!;
  }

  getSession(id: string): Session | null {
    const row = this.db.query("SELECT * FROM sessions WHERE id = ?").get(id) as Row | null;
    return row ? rowToSession(row) : null;
  }

  listSessions(opts: { taskId?: string; includeClosed?: boolean } = {}): Session[] {
    const where: string[] = [];
    const vals: unknown[] = [];
    if (opts.taskId) { where.push("task_id = ?"); vals.push(opts.taskId); }
    if (!opts.includeClosed) where.push("closed = 0");
    const sql =
      "SELECT * FROM sessions" + (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      " ORDER BY created_at ASC";
    return (this.db.query(sql).all(...(vals as any[])) as Row[]).map(rowToSession);
  }

  updateSession(id: string, patch: SessionPatch): Session | null {
    const map: Record<keyof SessionPatch, string> = {
      title: "title", cwd: "cwd", usesWorktree: "uses_worktree", model: "model",
      permissions: "permissions", effort: "effort", resumeHandle: "resume_handle",
      tmuxSession: "tmux_session", worktreePath: "worktree_path", worktreeBranch: "worktree_branch",
      planning: "planning", draftMayBeStranded: "draft_may_be_stranded",
      codexTranscriptPath: "codex_transcript_path", codexSessionId: "codex_session_id",
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, col] of Object.entries(map) as [keyof SessionPatch, string][]) {
      const v = patch[key];
      if (v === undefined) continue;
      sets.push(`${col} = ?`);
      vals.push(typeof v === "boolean" ? i(v) : v);
    }
    if (sets.length === 0) return this.getSession(id);
    vals.push(id);
    this.db.run(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`, vals as any);
    return this.getSession(id);
  }

  /** Close a session; COALESCE closed_at so a redundant close can't push the reaper deadline (§6). */
  closeSession(id: string): void {
    const now = Date.now();
    this.db.run(
      "UPDATE sessions SET closed = 1, closed_at = COALESCE(closed_at, ?) WHERE id = ?",
      [now, id],
    );
  }

  removeSession(id: string): void {
    this.db.run("DELETE FROM sessions WHERE id = ?", [id]);
  }
}

function rowToTask(r: Row): Task {
  return {
    id: r.id, name: r.name, description: r.description, status: r.status as TaskStatus,
    createdAt: r.created_at, updatedAt: r.updated_at, orderIdx: r.order_idx,
  };
}

function rowToSession(r: Row): Session {
  return {
    id: r.id, taskId: r.task_id, title: r.title, tool: r.tool as Tool,
    location: r.location as Location, cwd: r.cwd, usesWorktree: b(r.uses_worktree),
    worktreePath: r.worktree_path, model: r.model, permissions: r.permissions as Permissions,
    effort: (r.effort as Effort | null) ?? null, resumeHandle: r.resume_handle,
    tmuxSession: r.tmux_session, closed: b(r.closed), createdAt: r.created_at,
    closedAt: r.closed_at, worktreeBranch: r.worktree_branch, profileId: r.profile_id,
    codexTranscriptPath: r.codex_transcript_path, codexSessionId: r.codex_session_id,
    planning: b(r.planning), draftMayBeStranded: b(r.draft_may_be_stranded),
  };
}
