/**
 * Session manager — owns the lifecycle of every agent (design §7, §5.2, §5.3).
 *
 * Spawn sequence (design §7.1): resolve profile -> parse seed ticket -> create the DB row FIRST
 * (the id is needed for the remote hook path and tmux name) -> provision worktree -> devbox extras
 * (tmux name, remote hook, Linear MCP creds, hook argv) -> normalize the seed prompt (daemon-owned)
 * -> build argv via the per-CLI spec (or branch to in-process OpenRouter) -> compute deferSeedPrompt
 * -> persist resume handle -> start the PTY at 80x24 (server overrides with the real client size)
 * -> best-effort link the headline ticket as a manual placeholder work item.
 *
 * Shutdown (design §5.3): SIGTERM every LOCAL PTY (local agents die with the daemon); devbox tmux
 * sessions survive (only the ssh mirror dies) — which is why devbox nudge-draft state is persisted.
 */

import type { PtySession } from "./pty.ts";

export interface SessionManager {
  spawn(): Promise<{ sessionId: string; pty: PtySession | null }>;
  resume(sessionId: string): Promise<PtySession>;
  shutdown(): void;
}

/** TODO(step 1/3): implement the spawn sequence and lazy resume. */
export function createSessionManager(): SessionManager {
  throw new Error("session-manager.createSessionManager: not implemented (design §7.1)");
}
