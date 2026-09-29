/**
 * Session manager — owns the lifecycle of every agent (design §7, §5.2, §5.3).
 *
 * MILESTONE 1 SUBSET: spawn/track/resume LOCAL PTY-backed agents, stream output, accept input, and
 * SIGTERM every local PTY on shutdown (local agents die with the daemon, design §5.3). The full
 * spawn sequence — worktrees, per-CLI spawn spec, devbox extras, deferred seeds, work-item linking —
 * lands in build steps 3-4 (see BUILD.md). The per-tool argv here is a minimal placeholder for §7.2.
 */

import { spawnPty, type PtySession, type PtyExit } from "./pty.ts";
import { Store, type CreateSessionParams } from "./store.ts";
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
  /** Simplified runtime status for M1: live -> working, otherwise exited (full machine = step 2). */
  status(sessionId: string): SessionStatus;
  write(sessionId: string, bytes: Uint8Array): void;
  resize(sessionId: string, cols: number, rows: number): void;
  kill(sessionId: string): void;
  onStatus(cb: (e: { sessionId: string; status: SessionStatus }) => void): () => void;
  onExit(cb: (e: { sessionId: string; exit: PtyExit }) => void): () => void;
  shutdown(): void;
}

export function createSessionManager(store: Store): SessionManager {
  const live = new Map<string, PtySession>();
  const statusCbs = new Set<(e: { sessionId: string; status: SessionStatus }) => void>();
  const exitCbs = new Set<(e: { sessionId: string; exit: PtyExit }) => void>();

  const emitStatus = (sessionId: string, status: SessionStatus) => {
    for (const cb of statusCbs) cb({ sessionId, status });
  };

  const startPty = (session: Session, seed: string | undefined, command: string[] | undefined,
    size?: { cols: number; rows: number }): PtySession => {
    const argv = command ?? minimalArgv(session, seed);
    const pty = spawnPty({
      sessionId: session.id,
      argv,
      cwd: session.cwd,
      cols: size?.cols,
      rows: size?.rows,
      env: {
        AO_SESSION_ID: session.id,
        AO_SESSION_DIR: sessionDir(session.id),
      },
      onExit: (exit) => {
        live.delete(session.id);
        emitStatus(session.id, exit.status);
        for (const cb of exitCbs) cb({ sessionId: session.id, exit });
      },
    });
    live.set(session.id, pty);
    emitStatus(session.id, "starting");
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

    status: (sessionId) => (live.has(sessionId) ? "working" : "exited"),

    write(sessionId, bytes) {
      live.get(sessionId)?.write(bytes);
    },

    resize(sessionId, cols, rows) {
      live.get(sessionId)?.resize(cols, rows);
    },

    kill(sessionId) {
      live.get(sessionId)?.kill();
    },

    onStatus(cb) {
      statusCbs.add(cb);
      return () => statusCbs.delete(cb);
    },

    onExit(cb) {
      exitCbs.add(cb);
      return () => exitCbs.delete(cb);
    },

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
 * Minimal per-tool argv. Placeholder for the real per-CLI spawn spec (design §7.2, build step 3):
 * this only covers the flags Milestone 1 needs to bring a local agent up.
 */
function minimalArgv(session: Session, seed: string | undefined): string[] {
  const model = session.model && session.model !== "auto" ? session.model : null;
  const t: Tool = session.tool;
  if (t === "claude") {
    const argv = ["claude"];
    if (model) argv.push("--model", model);
    if (session.resumeHandle) argv.push("--resume", session.resumeHandle);
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
  throw new Error(`session-manager: tool '${t}' is not spawnable as a local PTY in Milestone 1`);
}
