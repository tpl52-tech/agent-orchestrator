/**
 * Usage ledger (design §15.2, §12.8).
 *
 * Runs inside the work-item monitor; sweep every 60s (even while attached). Claude transcripts are
 * sampled incrementally: per-file byte marks with inode + shrink rotation detection, partial-line
 * holdback, CONSECUTIVE-DUPLICATE message-id dedupe (usage rows repeat verbatim; naive summing
 * overstated output by 96%), 32 MiB per file per tick; subagent transcripts roll up to the parent.
 * Devbox transcripts are aggregated ON THE BOX by a read-only awk script.
 *
 * Storage: lifetime totals, samples, cumulative series (14 days), daily deltas forever with
 * restart-proof attribution (lifetime - already-attributed). Codex and copilot keep no transcript
 * -> "unaccounted", NOT free.
 */

export function startUsageLedger(): { stop(): void } {
  throw new Error("usage.startUsageLedger: not implemented (design §15.2)");
}
