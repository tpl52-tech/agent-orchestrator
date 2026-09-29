/**
 * OpenRouter agent runtime — the one place the system writes code itself (design §16).
 *
 * Why: pointing codex at OpenRouter measured 105s to first token vs 2.5s direct and a 0% prompt-cache
 * hit rate vs 98%; cache reads are ~1000:1 of the token mix, so losing the cache costs more than the
 * subscription. So we run the tool-calling loop ourselves against the chat-completions API.
 *
 * Rendering: append-only ANSI lines into a PTY-shaped byte stream (256 KB replay buffer), so
 * attach/replay/resize are untouched and the alt-screen scroll problems are sidestepped. Status is
 * KNOWN, not inferred: working / needs-input (approval pending) / done / error / exited.
 *
 * Cache discipline: a short, byte-stable system prompt (no interpolation — cwd + task go in the first
 * USER message); tools sorted by name; provider pinned to whoever served turn 1; non-streaming.
 *
 * Loop: per-turn step ceiling 150; await MCP readiness before the first turn; maybe compact; POST;
 * run tool calls serially (MCP first, then built-ins); flush transcript after each assistant message.
 * Seedless sessions open with ONLY the system message and wait.
 *
 * Compaction: at 70% of the model's window, keep the 2 head messages, keep a byte-budgeted tail
 * (35% of size, 2-8 messages), snap to tool-call boundaries, summarize the middle with a cheap model,
 * stop after one unreducible attempt. Compact rarely and in large chunks.
 *
 * Tools: read_file (1-based offset, limit 2000, explicit "showing lines A-B of T" footer), write_file
 * (whole file), edit_file (exact unique-match), bash (exit code printed; 20,000-char clip; no timeout).
 *
 * Runner CLI (remote): --session --cwd --model --effort --permissions [--resume] [--seed].
 * Key read from env or ~/.agent-orchestrator/openrouter-key (0600); never in SQLite, never deployed.
 */

export const STEP_CEILING = 150;
export const COMPACT_AT_FRACTION = 0.7;

export async function runOpenRouterAgent(): Promise<void> {
  throw new Error("openrouter.runner: not implemented (design §16)");
}

if (import.meta.main) {
  runOpenRouterAgent().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
