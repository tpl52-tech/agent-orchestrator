/**
 * PTY sessions (design §8.1).
 *
 * Spawned with Bun's inline terminal option (the ONLY form that makes the PTY the child's
 * controlling terminal so SIGWINCH and signals work). A 256 KB replay ring buffer; trimming cuts
 * at a SAFE BOUNDARY (byte after a newline within a 4 KB scan window, else the first ESC, else
 * skip UTF-8 continuation bytes) — a blind slice mid-escape makes the terminal swallow following
 * printable bytes as parameters and the screen drifts on scroll.
 *
 * Output listeners are multiplexed per attached client. Resize is a NO-OP when geometry is
 * unchanged (SIGWINCH makes agent TUIs repaint). Exit code 0/null -> `exited`, else `error`.
 *
 * Subprocess byte reads go through a helper wrapping arrayBuffer() (Response.bytes() returns an
 * ArrayBuffer past ~16 KB and broke attach for every remote agent with real scrollback).
 */

export const REPLAY_BUFFER_BYTES = 256 * 1024;

/** A live local PTY (or the ssh-mirror PTY for a remote agent). */
export interface PtySession {
  readonly sessionId: string;
  write(bytes: Uint8Array): void;
  resize(cols: number, rows: number): void;
  /** the trimmed replay ring buffer to send a freshly-attached local client. */
  replay(): Uint8Array;
  addOutputListener(fn: (bytes: Uint8Array) => void): () => void;
  kill(): void;
}

/** TODO(step 1): implement using Bun.spawn with the inline terminal option. */
export function spawnPty(): PtySession {
  throw new Error("pty.spawnPty: not implemented (design §8.1)");
}

/** Trim a replay buffer to <= REPLAY_BUFFER_BYTES at a safe boundary (design §8.1). */
export function trimReplayBuffer(_buf: Uint8Array): Uint8Array {
  throw new Error("pty.trimReplayBuffer: not implemented (design §8.1)");
}
