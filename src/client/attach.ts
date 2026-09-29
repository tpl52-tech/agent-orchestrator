/**
 * Attach / detach — raw byte passthrough (design §8.4, §8.5).
 *
 * MILESTONE 1 core: raw stdin passthrough to the daemon, PTY output to stdout, SIGWINCH -> resize, a
 * double-Ctrl-B detach chord within 800ms, and the unconditional terminal-mode reset on exit. The
 * fuller loop (braille spinner, Kitty-protocol chord decoding, focus-in Ctrl-L, 250ms resync) layers
 * on in later polish; the framing and safety contract is here.
 *
 * Terminal reset (§8.5): unconditionally disable mouse modes 1000/1002/1003/1005/1006/1015, focus
 * 1004, bracketed paste 2004, show cursor, wrap on, SGR reset FIRST, leave alt screen (1049) LAST.
 */

import type { DaemonClient } from "./daemon-client.ts";
import { connectDaemon } from "./daemon-client.ts";
import { paths } from "../shared/paths.ts";

export const DETACH_CHORD_MS = 800;
const CTRL_B = 0x02;
const ESC = "\x1b";

/** Emit the unconditional terminal-mode reset sequence to a TTY (design §8.5). No-op on non-TTY. */
export function terminalReset(out: NodeJS.WriteStream = process.stdout): void {
  if (!out.isTTY) return;
  const seq =
    `${ESC}[0m` + // SGR reset first
    `${ESC}[?1000l${ESC}[?1002l${ESC}[?1003l${ESC}[?1005l${ESC}[?1006l${ESC}[?1015l` + // mouse
    `${ESC}[?1004l` + // focus reporting
    `${ESC}[?2004l` + // bracketed paste
    `${ESC}[?25h` + // show cursor
    `${ESC}[?7h` + // wrap on
    `${ESC}[?1049l`; // leave alt screen LAST
  out.write(seq);
}

/** Clear screen + scrollback (separate from reset — only correct when something will repaint). */
export function clearScreen(out: NodeJS.WriteStream = process.stdout): void {
  if (!out.isTTY) return;
  out.write(`${ESC}[H${ESC}[2J${ESC}[3J`);
}

export interface AttachIO {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
}

/**
 * Attach the real terminal to a session over an existing daemon connection. Resolves on detach
 * (double Ctrl-B) or when the daemon connection closes.
 */
export async function attachSession(
  client: DaemonClient,
  sessionId: string,
  io: AttachIO = { stdin: process.stdin, stdout: process.stdout },
): Promise<void> {
  const { stdin, stdout } = io;
  const cols = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  let done!: () => void;
  const finished = new Promise<void>((res) => { done = res; });

  const unsubOutput = client.onPtyOutput((sid, bytes) => {
    if (sid === sessionId) stdout.write(bytes);
  });

  // Detach chord state.
  let prefixPending = false;
  let prefixTimer: ReturnType<typeof setTimeout> | null = null;

  const onStdin = (chunk: Buffer) => {
    if (chunk.length === 1 && chunk[0] === CTRL_B) {
      if (prefixPending) { // second Ctrl-B within the window -> detach
        if (prefixTimer) clearTimeout(prefixTimer);
        void detach();
        return;
      }
      prefixPending = true;
      prefixTimer = setTimeout(() => { prefixPending = false; prefixTimer = null; }, DETACH_CHORD_MS);
      return; // swallow a lone prefix
    }
    if (prefixPending) { // prefix followed by another key -> not a detach; deliver the key only
      prefixPending = false;
      if (prefixTimer) { clearTimeout(prefixTimer); prefixTimer = null; }
    }
    client.sendInput(sessionId, new Uint8Array(chunk));
  };

  const onResize = () => {
    client.sendResize(sessionId, stdout.columns ?? 80, stdout.rows ?? 24);
  };

  const cleanup = () => {
    unsubOutput();
    stdin.removeListener("data", onStdin);
    process.removeListener("SIGWINCH", onResize);
    if (prefixTimer) clearTimeout(prefixTimer);
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
    terminalReset(stdout);
    clearScreen(stdout);
  };

  const detach = async () => {
    try { await client.request("session.detach"); } catch { /* connection may be gone */ }
    cleanup();
    done();
  };

  // If the connection drops mid-attach, restore the terminal and resolve.
  void client.closed.then(() => { cleanup(); done(); });

  await client.request("session.attach", { sessionId, cols, rows });

  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.on("data", onStdin);
  process.on("SIGWINCH", onResize);

  return finished;
}

/** Standalone: connect, attach, detach, close. */
export async function attach(sessionId: string): Promise<void> {
  const client = await connectDaemon(paths().socket);
  try {
    await attachSession(client, sessionId);
  } finally {
    client.close();
  }
}
