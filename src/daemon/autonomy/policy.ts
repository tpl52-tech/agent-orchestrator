/**
 * Autonomy policy — a PURE, deterministic decision function (design §13.1, §13.4).
 *
 * Over (work item, field changes since last tick, agent activity, session, now, injected
 * store-backed lookups) -> EXACTLY ONE decision per item per tick, FIRST MATCHING RULE WINS.
 * No model votes on typing into an agent; models only word human alerts.
 *
 * Bias toward inaction: suppressing a nudge costs one tick; a duplicate instruction typed mid-fix
 * corrupts work that cannot be undone. The cost of first-match-wins is STARVATION — any rule that
 * returns early without clearing its own condition blocks every rule below — so a large fraction of
 * the design is anti-starvation machinery (handover stamps, attempt backoffs, act-time freshness).
 *
 * Rule order IS the design (§13.4):
 *   0.  cannot see the agent (activity null / fidelity none)
 *   1.  draft -> nothing
 *   1.5 code-quality review handover (review-bot-followups)   — before fault rules
 *   1.6 non-approving CTO review handover (cto-review-followups) — before fault rules
 *   1.7 CTO approval sweep (cto-followups)
 *   2/3/4 fault nudge (ci failure / cto changes / conflict / unresolved rising / ...)
 *   5.  agent blocked on a question (alert needs-input)
 *   5.5 thermo regrade (CI green, grade != A)                 — before review requests
 *   6.  request codex
 *   6.1a CTO review delay nudge                                — checked before 6.1
 *   6.1 request CTO
 *   7.  ready to merge (alert-human)
 *   9.  stalled (see BUILD.md known gaps: effectively unreachable as written)
 */

import type { AutonomyDecision } from "../../shared/types.ts";

/** Thresholds (design §13.2). */
export const THRESHOLDS = {
  monitorTaskEvidenceMs: 20 * 60 * 1000,
  prLinkEvidenceMs: 10 * 60 * 1000,
  idleEvidenceMs: 5 * 60 * 1000,
  waitingSustainedMs: 3 * 60 * 1000,
  stallMs: 45 * 60 * 1000,
  followupRetryBackoffMs: 20 * 60 * 1000, // deliberately equals the actuator cooldown
  thermoCycleCap: 3,
} as const;

export interface PolicyInputs {
  // work item, field changes, agent activity, session, now, injected lookups — see design §13.1.
  now: number;
}

export interface PolicyResult {
  decision: AutonomyDecision;
  /** the dedupe key for the chosen action (design §13.5). */
  dedupeKey: string;
  /** the message body for nudge-transport decisions, if any. */
  message?: string;
  /** human-readable reason, recorded even for `none` when it changes (the "considered" row). */
  reason: string;
}

/**
 * Decide the single action for one work item this tick. TODO(step 7): implement the rule table in
 * order, honoring the anti-starvation machinery.
 */
export function decide(_inputs: PolicyInputs): PolicyResult {
  throw new Error("policy.decide: not implemented (design §13.4)");
}

/**
 * "Is the agent handling this PR" predicate (design §13.3) — only asked about the owning session.
 * Fidelity none -> blind. Idle and evidence older than 5 min -> agent moved on. Babysit evidence
 * must be recent.
 */
export function isAgentHandling(_inputs: PolicyInputs): boolean {
  throw new Error("policy.isAgentHandling: not implemented (design §13.3)");
}
