/**
 * Box roster (design §17.2, §17.3).
 *
 * Roster refresh every 10s: in parallel `tmux ls` (names + paths), `ls ~/.agent-orchestrator-remote`
 * (full uuids), `claude agents --json`, plus the last events.log line per session; each with a 20s
 * timeout. Join: only `ao-` names; the 8-char prefix must match EXACTLY ONE uuid dir (zero or several
 * -> dropped, never guessed); a live claude process match wins for activity, else the events file;
 * neither -> unknown (NEVER idle). Roster entries are upserted into the box store under the Mac's
 * session id (real FKs failed every reconcile when the roster lived only in memory).
 *
 * Manifest (Mac -> box, §17.3): roster-policy.json pushed over ssh (atomic temp+mv) every 60s when
 * changed, heartbeat every 10 min, forced immediately on setPlanning. FRESHNESS INVERSION:
 * missing/invalid/older than 24h -> the box refuses to act on ANYTHING (staleness must make the box
 * MORE conservative). Ownership on the box = manifest allows AND session is in the live roster.
 */

export function startRoster(): { stop(): void } {
  throw new Error("box.roster.startRoster: not implemented (design §17.2)");
}
