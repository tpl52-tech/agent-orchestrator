/**
 * Box tmux nudge transport (design §10.5, §17).
 *
 * The box delivers nudges via tmux directly (no ssh hop, no mirror PTY):
 *   - `tmux send-keys -l --` for text via argv (NEVER a shell string);
 *   - `Enter` as its OWN invocation (body and Enter are separate writes; 120ms settle, tmux's
 *     assume-paste-time is 1ms);
 *   - `Escape` to clear a typed body;
 *   - `capture-pane -p -e` to read (keeps SGR so a dim placeholder can be told from real text).
 *
 * Shares the pane guards + stranded-text recognition + dispatch order in src/daemon/nudge. On a
 * FAILED pane capture the box PROCEEDS (the Mac holds) — see BUILD.md known gaps for the asymmetry.
 */

export function createTmuxNudge(): { stop(): void } {
  throw new Error("box.tmux-nudge.createTmuxNudge: not implemented (design §10.5, §17)");
}
