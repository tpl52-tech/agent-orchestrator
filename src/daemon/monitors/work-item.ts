/**
 * Work-item monitor — PRs and tickets (design §12).
 *
 * Cadence (§12.1): tick every 15s; a session is "due" every 30s while working/needs-input/starting,
 * else every 5 min; sessions with no items back off 2^misses x interval capped at 15 min; a polling
 * latch drops overlapping passes; the PR half is skipped while a client is attached (usage
 * accounting is not); skipped entirely with no repo. When nothing is due, autonomy STILL runs on all
 * sessions (a PR red for an hour is never "due").
 *
 * Linking (§12.2): observe each due session's branch from git -> one aliased GraphQL query per repo
 * per batch of 20 branches -> reconcile each PR (ownership exclusion, upsert with parsed tickets,
 * retire covered placeholders) -> pane fallback for unlinked devbox sessions -> refresh tracked items
 * -> autonomy -> emit workitems.changed.
 *
 * Derived states (§12.4): CI, greenlight, codex review bot, code-quality review bot, thermo grade,
 * CTO state, operator ack, outstanding reviewer tags, unresolved threads. A lookup FAILURE is never
 * "empty" (a wrong PR number never reads as review-clean).
 */

export function startWorkItemMonitor(): { stop(): void } {
  throw new Error("work-item.startWorkItemMonitor: not implemented (design §12)");
}

/** Derive CI/greenlight/review states for a fetched PR (design §12.4). TODO(step 5). */
export function deriveStates(_prJson: unknown): unknown {
  throw new Error("work-item.deriveStates: not implemented (design §12.4)");
}
