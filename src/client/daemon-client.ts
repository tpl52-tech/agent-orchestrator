/**
 * Daemon client — the socket connection the TUI and CLI use (design §8, §19 Daemon client).
 *
 * Connects to ~/.agent-orchestrator/daemon.sock, sends control requests, receives events. Reconnect
 * with 500ms->5s backoff FOREVER after a first successful connect; pending requests failed on close;
 * unsolicited events dropped during raw attach except session.openUrl. Auto-starts the daemon if none
 * is listening (waits up to 5s for a launchd-managed one rather than spawning a second).
 */

import type { ControlEvent, RequestType } from "../shared/wire.ts";

export interface DaemonClient {
  request<T = unknown>(type: RequestType, params?: unknown): Promise<T>;
  on(fn: (event: ControlEvent) => void): () => void;
  close(): void;
}

/** TODO(step 1): implement the reconnecting socket client over the wire framing. */
export function connectDaemon(_socketPath: string): Promise<DaemonClient> {
  throw new Error("daemon-client.connectDaemon: not implemented (design §8)");
}
