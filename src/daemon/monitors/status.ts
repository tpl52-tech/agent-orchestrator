/**
 * Status detection — the per-PTY state machine (design §10.1, §10.2).
 *
 * Seven states. Evidence layers, strongest first: CLI notify hooks (authoritative for
 * needs-input/done) -> output-idle timer (fallback) -> process exit / tmux liveness -> transcript
 * growth (claude only; gates a CONFIDENT stuck) -> pane scraping (cosmetic) -> introspection probe.
 *
 * Key rules (design §10.1):
 *   - output -> `working` unless a hook holds needs-input or status is already working/stuck
 *     (stuck is NOT cleared by bytes — it is diagnosed precisely because output keeps flowing);
 *   - quiet >= 4s -> `done`;
 *   - no transcript growth for 8 min -> `stuck` (confident); or working >= 60 min -> stuck (not confident);
 *   - a hook-asserted needs-input >= 90s ago with output within the idle window overturns to working.
 *
 * Local hook watcher (§10.2): fs.watch on the session dir filtered to events.log PLUS a 500ms poll
 * (watch is edge-triggered and misses rapid writes); byte offset so each line processes once.
 */

import type { SessionStatus } from "../../shared/types.ts";

/** Attention rank for the task rollup glyph only (the list never re-sorts by it). */
export const ATTENTION_RANK: Record<SessionStatus, number> = {
  "needs-input": 100,
  done: 90,
  error: 80,
  stuck: 70,
  working: 20,
  starting: 15,
  exited: 10,
};

export function needsAttention(status: SessionStatus): boolean {
  return status === "needs-input" || status === "done" || status === "error";
}

/** TODO(step 2): implement the per-session state machine + hook watcher. */
export function startStatusMonitor(): { stop(): void } {
  throw new Error("status.startStatusMonitor: not implemented (design §10.1)");
}
