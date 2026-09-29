/**
 * `ao monitor` — devbox box-daemon deploy & management (design §17.5, §17.7, §18).
 *
 * deploy: `git archive HEAD` of src/daemon src/shared package.json deploy piped over ssh into
 * ~/agent-orchestrator-monitor.new, atomic swap keeping .old (one rollback level), DEPLOYED_SHA
 * written. Env file regenerated from the Mac's config for IDENTITY keys only, CARRYING FORWARD the
 * box's existing AO_AUTONOMY/AO_ALERTS ("a deploy ships code, not authority"). Installs five user
 * units (service + watchdog timer/service + cleanup timer/service). Deploy does NOT start the service;
 * restart uses systemctl (never a signal).
 *
 * setup-mcp (§17.7): seed mcp-remote + codex credentials onto the headless box (no browser there).
 */

export async function run(_args: string[]): Promise<void> {
  throw new Error("cli.monitor: not implemented (design §17.5)");
}
