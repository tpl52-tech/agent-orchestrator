/**
 * Wire protocol over the Unix-domain socket (design §8.2).
 *
 * One socket carries JSON control messages AND raw PTY bytes, interleaved.
 * Frame layout (no JSON/base64 on the hot path):
 *
 *   [1 byte kind][1 byte sessionId length][4 bytes payload length, big-endian][sessionId][payload]
 *
 * An incremental parser keeps partial tails. Backpressure: Bun's socket write returns the
 * number of bytes accepted and silently drops the rest — every frame write MUST go through a
 * writer wrapper that queues the tail and flushes on drain, or streams desync.
 */

export enum FrameKind {
  Control = 0, // JSON request/response/event
  PtyOutput = 1, // raw bytes daemon -> client
  PtyInput = 2, // raw bytes client -> daemon
  PtyResize = 3, // JSON { cols, rows }
}

export interface Frame {
  kind: FrameKind;
  sessionId: string; // "" for daemon-scoped control frames
  payload: Uint8Array;
}

// ---------------------------------------------------------------------------
// Control messages
// ---------------------------------------------------------------------------

export interface ControlRequest {
  id: string;
  type: string; // see RequestType below
  params?: unknown;
}

export interface ControlResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ControlEvent {
  type: EventType;
  data: unknown;
}

/** Server-pushed event types (design §8.2). */
export type EventType =
  | "snapshot"
  | "session.status"
  | "session.exit"
  | "session.openUrl"
  | "workitems.changed"
  | "workitem.transition"
  | "autonomy.acted"
  | "linear.changed";

/**
 * The request surface (design §8.3). No authentication: filesystem permissions on the socket
 * are the only protection.
 */
export type RequestType =
  // tasks
  | "task.list" | "task.create" | "task.update" | "task.close" | "task.reopen"
  // sessions
  | "session.list" | "session.spawn" | "session.rename" | "session.setPlanning"
  | "session.attach" | "session.detach" | "session.resume" | "session.prune"
  | "session.kill" | "session.close" | "session.remove" | "session.files"
  | "session.nudge" | "session.updateBranch" | "session.queue" | "session.queue.set"
  | "session.interrupt"
  // snapshots & meta
  | "snapshot.get" | "tool.capabilities" | "keepawake.set"
  | "autonomy.log" | "autonomy.extend"
  | "game.scores"
  // work items
  | "workitem.list" | "workitem.refresh" | "workitem.add" | "workitem.remove"
  | "workitem.action"
  // linear / usage / quota
  | "project.setHidden" | "linear.refresh" | "linear.list"
  | "usage.get" | "quota.get";

// ---------------------------------------------------------------------------
// Framing codec (STUB — build step 1)
// ---------------------------------------------------------------------------

/** Encode a single frame to bytes. TODO(step 1): implement the header + payload layout. */
export function encodeFrame(_frame: Frame): Uint8Array {
  throw new Error("wire.encodeFrame: not implemented (design §8.2)");
}

/**
 * Incremental frame decoder. Feed it socket chunks; it yields complete frames and retains a
 * partial tail. TODO(step 1): implement the stateful parser.
 */
export class FrameDecoder {
  push(_chunk: Uint8Array): Frame[] {
    throw new Error("wire.FrameDecoder.push: not implemented (design §8.2)");
  }
}

/**
 * A backpressure-aware frame writer. Every frame write goes through here: it queues the tail
 * that Bun's socket.write() did not accept and flushes on drain.
 * TODO(step 1): implement the drain queue.
 */
export interface FrameWriter {
  write(frame: Frame): void;
}
