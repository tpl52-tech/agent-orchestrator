/**
 * The daemon (Mac) — one long-lived process (design §3.1, §5).
 *
 * Sole writer of the SQLite DB; owner of every local agent PTY and every ssh-mirror PTY; server
 * of the UDS socket; runs all monitors (status, work items, Linear, usage, quota, activity), the
 * autonomy actuator, the alert dispatcher, the worktree reaper, and box federation. Agents
 * outlive any client.
 *
 * Boot order (design §5.1) — die at boot on misconfiguration:
 *   1.  mkdir state dir; validate config (needsRepo:false; needsAlerts iff AO_ALERTS=1).
 *   2.  open store (migrate); create session manager.
 *   3.  read autonomy config from env ONCE; hold it mutable so the TUI can toggle live.
 *   4.  keep-awake controller; agent introspector; usage ledger.
 *   5.  parse AO_AUTONOMY_LOCATIONS (comma set; empty = own every location).
 *   6.  actuator (scheduled unless AO_AUTONOMY_ALWAYS=1; nudge dependency forwards the dedupe key).
 *   7.  work-item monitor (always, even with no repo, so usage accounting runs).
 *   8.  box federation; Linear monitor (self-disables if no MCP entry); roster publisher.
 *   9.  UDS server with a snapshot supplier.
 *   10. listen; start monitors; activity monitor; worktree reaper (immediately, then hourly);
 *       roster publisher iff any stored session is on the devbox; box federation unless
 *       AO_BOX_MONITOR=0.
 *
 * Crash recovery at boot resumes NOTHING eagerly (design §5.2): sessions come back lazily on
 * attach/resume/reconnect/bulk-send; every stored session reads `exited` until proven live. The
 * boot sweeps (each in try/catch) reconcile settlement rows, demote orphaned queued nudges,
 * recover stranded drafts, and redeliver orphaned manual nudges.
 */

export async function main(): Promise<void> {
  throw new Error("daemon.main: not implemented — see BUILD.md build step 1 (design §5.1)");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
