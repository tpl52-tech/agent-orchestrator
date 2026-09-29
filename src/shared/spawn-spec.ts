/**
 * Per-CLI spawn spec — the ONE place that knows tool flags (design §7.2).
 *
 * claude: fresh -> --session-id <uuid we mint>; resume -> --resume <handle>. --model,
 *   --effort, --permission-mode default/acceptEdits/bypassPermissions. ONE --settings JSON
 *   (a second flag would win) carrying claudeMdExcludes + notify hooks. --append-system-prompt
 *   on every spawn (incl. resumes) with deferred-tool guidance (it does not survive as a seed).
 *   Seed positional last arg UNLESS deferred.
 * codex: no launch id; resume via explicit isResume flag (`resume <id>` preferred, else
 *   `resume --last`). -m, -c model_reasoning_effort=. Permissions map to sandbox flags.
 *   Hook: -c notify=[...argv, "codex-event"]. Seed positional, never deferred.
 * copilot: fresh --name ao-<8hex>; resume --resume=<handle> (the = form is required).
 *   --model, --effort. Anything beyond ask -> --allow-all-tools. No hooks. Seed via -i.
 * openrouter (remote): absolute bun + runner path with --session/--cwd/--model/--effort/
 *   --permissions [--resume] [--seed]. Absolute paths because the wrapper shell-quotes tokens.
 */

import type { Tool, Permissions, Effort } from "./types.ts";

export interface SpawnRequest {
  tool: Tool;
  cwd: string;
  model: string;
  effort: Effort | null;
  permissions: Permissions;
  /** present iff resuming an existing conversation. */
  resumeHandle?: string;
  /** the normalized seed prompt, if any. */
  seed?: string;
  /** hook argv `[bun, <abs path to hook-notify>]` for tools that support hooks. */
  hookArgv?: string[];
  sessionId: string;
}

export interface SpawnSpec {
  /** the executable + args to launch (local) — openrouter runs in-process instead. */
  argv: string[];
  /**
   * claude gets the seed typed in LATER (deferSeedPrompt): true iff a ticket seed on claude —
   * the untrusted-folder trust gate on codex/copilot would swallow typed text as menu keys.
   */
  deferSeedPrompt: boolean;
  /** env additions (e.g. AO_SESSION_DIR, AO_SESSION_ID for hooks). */
  env: Record<string, string>;
}

/**
 * Build the argv + flags for a spawn. TODO(step 3): implement per-tool branches from §7.2.
 * Local OpenRouter branches off before this (in-process, no argv).
 */
export function buildSpawnSpec(_req: SpawnRequest): SpawnSpec {
  throw new Error("spawn-spec.buildSpawnSpec: not implemented (design §7.2)");
}
