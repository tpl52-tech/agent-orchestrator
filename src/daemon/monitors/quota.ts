/**
 * Quota probes (design §15.3, §12.8).
 *
 * NOT accumulation: read each CLI's OWN rate-limit snapshot. Probe every 5 min, fire-and-forget
 * (the devbox probe can take ~90s). Claude: force a refresh with `claude -p "/usage"` then read
 * cachedUsageUtilization (five-hour and seven-day windows). Codex: a live app-server JSON-RPC
 * account/rateLimits/read, falling back to the newest usable rate_limits event in recent rollouts.
 * Windows classified by window_minutes (>= 1440 = weekly). Probed locally AND on the devbox;
 * expired windows pruned per window on every read; a failed round trip keeps the prior reading, a
 * successful probe reporting absence clears it. NOTHING acts on quota; it is displayed with staleness.
 */

export function startQuotaProbe(): { stop(): void } {
  throw new Error("quota.startQuotaProbe: not implemented (design §15.3)");
}
