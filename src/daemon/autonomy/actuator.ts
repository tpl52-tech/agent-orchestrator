/**
 * Autonomy actuator — the ONLY place the system acts unasked (design §13.1, §13.5).
 *
 * An ordered gate chain, an audit row for every attempt INCLUDING suppressions, never throws.
 *
 * Gate chain, in order (design §13.5). `none`/`alert-human` never reach it:
 *   1.  disabled (config off or kill-switch file exists)
 *   2.  outside-window (§13.7)
 *   3.  not-my-host (ownsSession)
 *   4.  not-allowed (action not in the allow set)
 *   5.  session-not-allowed (AO_AUTONOMY_SESSIONS)
 *   6.  session-planning
 *   7.  already-attempted (failedAttemptCount(key) >= 2 — one transport retry)
 *   8.  duplicate (a performed/queued/cancelled row exists; undelivered is NOT terminal)
 *   9.  cooldown 20 min per (PR, action), PR-scoped; exempt for the three review sweeps
 *   10. global rate limit 12 acted rows/hour (excludes manual) with an onBlocked alert
 *   11. per-item 2/hour (skipped for sweeps; sweeps don't count)
 *   12. per-session nudges 3/hour
 *   13. nudge queue full (>= 2 pending) for nudge-transport actions
 *   14. freshness (stillJustified: re-read the item at act time)
 *   15. dry-run (record and return)
 *
 * Dedupe keys encode the event's identity, never the row (design §13.5):
 *   cto-followups:<PR>:<approvedAt>, review-bot-followups:<PR>:<reviewedAt>,
 *   cto-review-followups:<PR>:<reviewedAt>, cto-review-delay-nudge:<PR>:<headSha>,
 *   nudge:<PR>:<ci>:<cto>:<unresolved>:<mergeable>:<failedChecks>, default <action>:<PR>:<headSha>.
 */

import type { PolicyResult } from "./policy.ts";

export const GLOBAL_RATE_LIMIT_PER_HOUR = 12;
export const PER_ITEM_LIMIT_PER_HOUR = 2;
export const PER_SESSION_NUDGES_PER_HOUR = 3;
export const COOLDOWN_MS = 20 * 60 * 1000;
export const NUDGE_QUEUE_MAX_PENDING = 2;

export interface Actuator {
  /** Run one decision through the gate chain, writing an audit row for the outcome. */
  act(result: PolicyResult): Promise<void>;
  stop(): void;
}

/** TODO(step 7): implement the ordered gate chain + delivery + audit writes. */
export function createActuator(): Actuator {
  throw new Error("actuator.createActuator: not implemented (design §13.5)");
}
