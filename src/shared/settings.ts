/**
 * Settings — preferences, distinct from identity (design §4.4).
 *
 * Stored in a `settings` block of the same config file. Every one has a working default;
 * unset is normal; resolution is file -> default, deliberately NOT env. Only values that
 * differ from the shipped default are written (restating a default would pin it).
 * Malformed settings -> defaults, never throw (a spawn form with stock defaults beats a
 * dashboard that won't start).
 */

import type { Tool, Location, Permissions, Effort } from "./types.ts";

export interface SpawnDefaults {
  tool: Tool;
  model: string; // "auto"
  effort: Effort;
  location: Location;
  usesWorktree: boolean;
  permissions: Permissions;
}

export interface FocusThresholds {
  agentSilenceMs: number; // 10 min
  prSilenceMs: number; // 20 min
}

export interface Settings {
  spawnDefaults: SpawnDefaults;
  /** {TICKET} is replaced everywhere with the uppercased ticket id. */
  ticketPrompt: string; // legacy shared (claude)
  ticketPromptCodex: string;
  ticketPromptCopilot: string;
  ticketPromptOpenRouter: string;
  focus: FocusThresholds;
}

export const DEFAULT_SETTINGS: Settings = {
  spawnDefaults: {
    tool: "claude",
    model: "auto",
    effort: "medium",
    location: "local",
    usesWorktree: true,
    permissions: "full-access",
  },
  ticketPrompt: "",
  ticketPromptCodex: "",
  ticketPromptCopilot: "",
  ticketPromptOpenRouter: "",
  focus: {
    agentSilenceMs: 10 * 60 * 1000,
    prSilenceMs: 20 * 60 * 1000,
  },
};

/**
 * Parse a raw settings block, falling back to defaults on anything malformed.
 * TODO(step 3): implement tolerant field-by-field merge.
 */
export function parseSettings(_raw: unknown): Settings {
  return DEFAULT_SETTINGS;
}
