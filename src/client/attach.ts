/**
 * Attach / detach — raw byte passthrough (design §8.4, §8.5).
 *
 * Client: begin raw session (unsolicited events dropped EXCEPT session.openUrl, which must pass
 * through because the attach itself can block on the very Tailscale re-auth that event unblocks),
 * pause polling, suspend Ink, run the raw loop, then end/refresh.
 *
 * Raw loop: braille spinner until the first byte; stdout passthrough; stdin raw mode, ref'd BEFORE
 * resume (Ink's suspend unrefs stdin; with an idle agent nothing wakes the loop and every key
 * including detach silently does nothing). Detach = double Ctrl-B within 800ms (also recognizes the
 * Kitty keyboard-protocol encoding). Focus-in escape -> send Ctrl-L. On exit: full terminal-mode
 * reset (§8.5), clear screen + scrollback, raw off, detach request.
 *
 * Terminal reset (§8.5): unconditionally disable mouse modes 1000/1002/1003/1005/1006/1015, focus
 * 1004, bracketed paste 2004, show cursor, wrap on, SGR reset FIRST, leave alt screen (1049) LAST.
 * No-op on non-TTY. Screen clear is a SEPARATE function (only correct when something will repaint).
 */

export const DETACH_CHORD_MS = 800;

/** Emit the unconditional terminal-mode reset sequence (design §8.5). TODO(step 1). */
export function terminalReset(): void {
  throw new Error("attach.terminalReset: not implemented (design §8.5)");
}

/** Run the raw attach loop against a session over the daemon socket (design §8.4). TODO(step 1). */
export async function attach(_sessionId: string): Promise<void> {
  throw new Error("attach.attach: not implemented (design §8.4)");
}
