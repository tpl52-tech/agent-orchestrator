/**
 * Nudge delivery — typing into an agent SAFELY (design §10.5, §10.6, §10.7, §10.8).
 *
 * Three implementations share the framing rules: local PTY, Mac->devbox over an awaited ssh hop,
 * box->tmux.
 *
 * FRAMING (design §10.5):
 *   - CR must NEVER ride in the same write as the text. A PTY delivers one write as one read; the
 *     TUIs classify text+newline in one read as a PASTE and insert the newline literally, leaving
 *     the message typed but unsent while looking delivered. Write the body, wait 150ms (local/remote)
 *     or 120ms (tmux), then send Enter as a SEPARATE write.
 *   - Body normalization: every CR/CRLF -> LF. Codex bodies wrapped in bracketed-paste markers.
 *
 * PANE GUARDS (Claude-shaped, one-directional — an uninterpretable line means "safe to type"):
 * strip dim runs; hasPendingInput; looksBusy ("esc to interrupt" / live spinner incl. h/m/s unit);
 * looksLikeMenu (footer + numbered option, with a cleared-dialog exception).
 *
 * DISPATCH ORDER (box): capture -> menu => drop+report -> our own text stranded and not busy =>
 * press Enter only, never retype -> busy/pending => hold (bounded) -> failed capture => box proceeds,
 * Mac holds -> type, settle, check cancellation, Enter, acknowledge.
 *
 * NEVER retype our own stranded text (the 58-copies incident). Promote the audit row to `performed`
 * only AFTER the Enter is verified (performed is the one status the startup sweep cannot reclaim).
 *
 * Queue semantics: max 2 pending per session; dedupe by key; holds re-insert at the FRONT; a
 * manual/unkeyed message is never terminally demoted; autonomous ones demote to `undelivered`.
 */

export const BODY_SETTLE_MS_LOCAL = 150;
export const BODY_SETTLE_MS_TMUX = 120;
export const MAX_PENDING_PER_SESSION = 2;

export interface NudgeRequest {
  sessionId: string;
  body: string;
  /** the dedupe/settlement keys this delivery should promote on success. */
  keys: string[];
  manual: boolean;
}

export interface NudgeDelivery {
  enqueue(req: NudgeRequest): void;
  stop(): void;
}

/** TODO(step 6): implement the three transports + framing + pane guards + queue. */
export function createNudgeDelivery(): NudgeDelivery {
  throw new Error("nudge.createNudgeDelivery: not implemented (design §10.5)");
}
