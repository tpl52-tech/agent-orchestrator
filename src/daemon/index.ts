/**
 * The daemon (Mac) — one long-lived process (design §3.1, §5).
 *
 * Sole writer of the SQLite DB; owner of every local agent PTY; server of the UDS socket. Agents
 * outlive any client.
 *
 * MILESTONE 1 boot: mkdir state dir; open the store (migrate); create the session manager; start the
 * UDS server and wire manager status/exit events to broadcast; write the pidfile; install signal
 * handlers. Config validation, the monitors, autonomy, alerts, and box federation land in later build
 * steps (see BUILD.md); their ordered boot sequence is documented in daemon/index.ts history / §5.1.
 */

import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { paths, stateHome } from "../shared/paths.ts";
import { loadOperatorConfig } from "../shared/config.ts";
import { Store } from "./store.ts";
import { createSessionManager, type SessionManager } from "./session-manager.ts";
import { createStatusTracker, type StatusTracker } from "./monitors/status.ts";
import { startWorkItemMonitor, type WorkItemMonitor } from "./monitors/work-item.ts";
import { createNudgeDelivery, type NudgeDelivery } from "./nudge/index.ts";
import { RemoteAgents } from "./remote-box.ts";
import { startUdsServer, type UdsServer } from "./uds-server.ts";

export interface Daemon {
  store: Store;
  manager: SessionManager;
  tracker: StatusTracker;
  monitor: WorkItemMonitor;
  nudge: NudgeDelivery;
  server: UdsServer;
  socketPath: string;
  stop(): void;
}

/** Start the daemon in-process (also used by integration tests). */
export function startDaemon(home = stateHome()): Daemon {
  const p = paths(home);
  for (const dir of [p.home, p.sessions, p.worktrees, p.repos]) {
    mkdirSync(dir, { recursive: true });
  }

  const store = new Store(p.db);
  const config = loadOperatorConfig(home);
  const tracker = createStatusTracker({ home });

  // The remote-agent helper (devbox) needs to emit openUrl through the server, created just below.
  let server: UdsServer;
  const remote = config.devbox
    ? new RemoteAgents({
        dest: config.devbox,
        tracker,
        onOpenUrl: (sessionId, url) => server.broadcast({ type: "session.openUrl", data: { sessionId, url } }),
      })
    : undefined;

  const manager = createSessionManager(store, tracker, config, home, remote);
  const nudge = createNudgeDelivery({
    store, manager,
    subscribeStatus: (cb) => tracker.onChange(({ sessionId }) => cb(sessionId)),
  });
  const monitor = startWorkItemMonitor({
    store, manager, config,
    emit: () => server.broadcast({ type: "workitems.changed", data: {} }),
    isBusy: () => server.isBusy(),
  });
  server = startUdsServer(p.socket, { store, manager, monitor, nudge });

  // Broadcast runtime status transitions to all clients (design §8.2 manager fan-out).
  tracker.onChange(({ sessionId, status }) =>
    server.broadcast({ type: "session.status", data: { sessionId, status } }));
  manager.onExit(({ sessionId, exit }) =>
    server.broadcast({ type: "session.exit", data: { sessionId, ...exit } }));

  tracker.start();

  return {
    store,
    manager,
    tracker,
    monitor,
    nudge,
    server,
    socketPath: p.socket,
    stop() {
      server.stop();
      monitor.stop();
      nudge.stop();
      tracker.stop();
      manager.shutdown();
      store.close();
    },
  };
}

export async function main(): Promise<void> {
  const p = paths();
  const daemon = startDaemon();
  writeFileSync(p.pid, String(process.pid));
  console.log(`agent-orchestrator daemon listening on ${daemon.socketPath} (pid ${process.pid})`);

  const shutdown = (): never => {
    daemon.stop();
    if (existsSync(p.pid)) { try { unlinkSync(p.pid); } catch { /* ignore */ } }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
