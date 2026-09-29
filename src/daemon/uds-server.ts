/**
 * Unix-domain socket server (design §8.2, §8.3, §5.2).
 *
 * Serves the wire protocol (see src/shared/wire.ts). No authentication: filesystem permissions
 * on the socket file are the only protection. On boot: remove a stale socket file then listen
 * (no liveness probe of an old daemon). The CLI refuses to spawn a second daemon when launchd
 * manages one (waits up to 5s for it instead).
 *
 * Fan-out rules (design §8.2):
 *   - manager events go to ALL clients (and tell the monitor to drop backoff for that session);
 *   - work-item events are suppressed entirely while ANY client is attached (control frames
 *     interleaved with raw PTY bytes broke repaint; clients refresh on detach);
 *   - Linear events go per-socket to UNATTACHED sockets only.
 */

import type { ControlEvent } from "../shared/wire.ts";

/** A supplier of the 1-second snapshot the client renders (design §5.1 step 9). */
export type SnapshotSupplier = () => unknown;

export interface UdsServer {
  broadcast(event: ControlEvent): void;
  /** true iff any client is currently attached (isBusy). */
  isBusy(): boolean;
  stop(): void;
}

/** TODO(step 1): implement listen + framing + request dispatch + fan-out rules. */
export function startUdsServer(_socketPath: string, _snapshot: SnapshotSupplier): UdsServer {
  throw new Error("uds-server.startUdsServer: not implemented (design §8.2, §8.3)");
}
