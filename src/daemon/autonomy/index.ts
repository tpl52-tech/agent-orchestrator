/**
 * Autonomy — the policy engine + actuator (design §13). Two layers with one guarantee: policy
 * decides (pure), the actuator acts (gated, audited, never throws).
 *
 * Env config (design §13.6): AO_AUTONOMY=1 enables exactly nudge-agent, request-codex,
 * review-bot-followups, cto-review-followups (worst case stays inside the PR/agent pair). Anything
 * else is a comma list; request-cto, cto-followups, cto-review-delay-nudge, thermo-regrade must be
 * NAMED (they spend a human's time, open tickets, or jump queues). Config is read once per process;
 * the kill switch and extension file are read LIVE.
 */

export * from "./policy.ts";
export * from "./actuator.ts";
