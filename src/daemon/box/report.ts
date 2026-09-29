/**
 * Box report (box -> Mac) (design §17.4).
 *
 * A one-shot read-only script printing:
 *   { observedAt, autonomy{enabled, dryRun, actions, killed, window, restartPending, daemonAlive},
 *     counts, actions[40 joined rows] }
 *
 * Pulled by the Mac every 15s (25s timeout, stale after 90s from the BOX's own clock), cached so the
 * 1-second snapshot never waits on ssh, skipped while a client is attached. Unreachable keeps the
 * last payload and flips a flag (a flapping "no box" badge is worse than slightly old data). The TUI
 * merges box audit rows into the activity log tagged "box".
 */

export interface BoxReport {
  observedAt: number;
  autonomy: {
    enabled: boolean;
    dryRun: boolean;
    actions: string[];
    killed: boolean;
    window: unknown;
    restartPending: boolean;
    daemonAlive: boolean;
  };
  counts: Record<string, number>;
  actions: unknown[];
}

/** Render the report (run on the box). TODO(step 9). */
export function renderReport(): BoxReport {
  throw new Error("box.report.renderReport: not implemented (design §17.4)");
}
