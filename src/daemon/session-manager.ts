/**
 * Session manager — owns the lifecycle of every agent (design §7, §5.2, §5.3).
 *
 * MILESTONE 1-2 SUBSET: spawn/track/resume LOCAL PTY-backed agents, feed the status tracker (§10),
 * and SIGTERM every local PTY on shutdown (local agents die with the daemon, §5.3). The full spawn
 * sequence — worktrees, the complete per-CLI spawn spec, devbox extras, deferred seeds, work-item
 * linking — lands in build steps 3-4 (see BUILD.md). The per-tool argv here is a minimal slice of
 * §7.2: enough to bring a local agent up and, for claude, to install the notify hooks the status
 * machine reads.
 */

import { mkdirSync } from "node:fs";
import { spawnPty, type PtySession, type PtyExit } from "./pty.ts";
import { Store, type CreateSessionParams } from "./store.ts";
import type { StatusTracker } from "./monitors/status.ts";
import { sessionDir } from "../shared/paths.ts";
import type { Session, SessionStatus, Tool } from "../shared/types.ts";

export interface SpawnParams extends CreateSessionParams {
  seed?: string;
  cols?: number;
  rows?: number;
  /** Override argv (tests / non-claude bring-up); otherwise derived from the tool. */
  command?: string[];
}

export interface SessionManager {
  spawn(params: SpawnParams): Session;
  resume(sessionId: string, size?: { cols: number; rows: number }): PtySession;
  live(sessionId: string): PtySession | undefined;
  status(sessionId: string): SessionStatus;
  write(sessionId: string, bytes: Uint8Array): void;
  resize(sessionId: string, cols: number, rows: number): void;
  kill(sessionId: string): void;
  /** Drop all tracking of a session (after remove). */
  forget(sessionId: string): void;
  onExit(cb: (e: { sessionId: string; exit: PtyExit }) => void): () => void;
  shutdown(): void;
}

export function createSessionManager(store: Store, tracker: StatusTracker): SessionManager {
  const live = new Map<string, PtySession>();
  const exitCbs = new Set<(e: { sessionId: string; exit: PtyExit }) => void>();

  const startPty = (
    session: Session,
    seed: string | undefined,
    command: string[] | undefined,
    size?: { cols: number; rows: number },
  ): PtySession => {
    const dir = sessionDir(session.id);
    mkdirSync(dir, { recursive: true }); // events.log hook sentinel lives here (§3.3)
    tracker.register(session.id);

    const argv = command ?? minimalArgv(session, seed);
    const pty = spawnPty({
      sessionId: session.id,
      argv,
      cwd: session.cwd,
      cols: size?.cols,
      rows: size?.rows,
      env: { AO_SESSION_ID: session.id, AO_SESSION_DIR: dir },
      onExit: (exit) => {
        live.delete(session.id);
        tracker.onExit(session.id, exit.status);
        for (const cb of exitCbs) cb({ sessionId: session.id, exit });
      },
    });
    pty.addOutputListener(() => tracker.onOutput(session.id));
    live.set(session.id, pty);
    return pty;
  };

  return {
    spawn(params) {
      const session = store.createSession(params);
      startPty(session, params.seed, params.command, sizeOf(params));
      return session;
    },

    resume(sessionId, size) {
      const existing = live.get(sessionId);
      if (existing) return existing;
      const session = store.getSession(sessionId);
      if (!session) throw new Error(`session-manager.resume: unknown session ${sessionId}`);
      if (session.closed) throw new Error(`session-manager.resume: session ${sessionId} is closed`);
      return startPty(session, undefined, undefined, size);
    },

    live: (sessionId) => live.get(sessionId),
    status: (sessionId) => tracker.status(sessionId),

    write(sessionId, bytes) { live.get(sessionId)?.write(bytes); },
    resize(sessionId, cols, rows) { live.get(sessionId)?.resize(cols, rows); },
    kill(sessionId) { live.get(sessionId)?.kill(); },
    forget(sessionId) { tracker.unregister(sessionId); },

    onExit(cb) { exitCbs.add(cb); return () => exitCbs.delete(cb); },

    shutdown() {
      for (const pty of live.values()) pty.kill();
      live.clear();
    },
  };
}

function sizeOf(p: SpawnParams): { cols: number; rows: number } | undefined {
  return p.cols && p.rows ? { cols: p.cols, rows: p.rows } : undefined;
}

/**
 * Minimal per-tool argv. A slice of the real per-CLI spawn spec (design §7.2, build step 3): it
 * covers the flags Milestone 1-2 needs, including — for claude — the notify hooks the status machine
 * reads. Still TODO for step 3: the single merged --settings (claudeMdExcludes), --append-system-prompt,
 * --permission-mode, minted --session-id, deferred seed, proper shell quoting.
 */
function minimalArgv(session: Session, seed: string | undefined): string[] {
  const model = session.model && session.model !== "auto" ? session.model : null;
  const t: Tool = session.tool;
  if (t === "claude") {
    const argv = ["claude"];
    if (model) argv.push("--model", model);
    if (session.resumeHandle) argv.push("--resume", session.resumeHandle);
    argv.push("--settings", claudeHookSettings());
    if (seed && !session.resumeHandle) argv.push(seed);
    return argv;
  }
  if (t === "codex") {
    const argv = ["codex"];
    if (model) argv.push("-m", model);
    if (seed) argv.push(seed);
    return argv;
  }
  if (t === "copilot") {
    const argv = ["copilot"];
    if (model) argv.push("--model", model);
    if (seed) argv.push("-i", seed);
    return argv;
  }
  throw new Error(`session-manager: tool '${t}' is not spawnable as a local PTY yet`);
}

/**
 * claude --settings JSON installing the notify hooks (design §7.2): Notification permission_prompt ->
 * needs-input, idle_prompt -> done; Stop -> done. The hook command uses AO_SESSION_DIR from the env.
 */
function claudeHookSettings(): string {
  const bun = process.execPath;
  const hookPath = new URL("./hook-notify.ts", import.meta.url).pathname;
  const cmd = (event: string) => ({ type: "command", command: `${bun} ${hookPath} ${event}` });
  return JSON.stringify({
    hooks: {
      Notification: [
        { matcher: "permission_prompt", hooks: [cmd("needs-input")] },
        { matcher: "idle_prompt", hooks: [cmd("done")] },
      ],
      Stop: [{ hooks: [cmd("done")] }],
    },
  });
}
