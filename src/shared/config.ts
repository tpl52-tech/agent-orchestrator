/**
 * Configuration model (design §4).
 *
 * Four resolution layers, highest first:
 *   1. Environment (AO_*)              — devbox config + test escape hatch
 *   2. Operator config config.json     — only facts about YOU; malformed -> throws
 *   3. Tracked org defaults.json        — team facts; malformed/missing -> silently {}
 *   4. Built-in defaults                — autonomy window + a few numeric knobs
 *
 * Blank/whitespace env values read as unset, so an empty export cannot shadow the file.
 * Nothing personal is ever defaulted — an absent identity key is a startup error naming it.
 */

import type { Profile } from "./profile.ts";
import type { Settings } from "./settings.ts";

/** Personal identity — required or per-feature, NEVER defaulted (design §4.2). */
export interface OperatorIdentity {
  /** branch prefix `<owner>/ENG-123`; always required. */
  branchOwner: string;
  /** ssh destination; required for remote agents. */
  devbox?: string;
  /** how the alert persona addresses you. */
  operatorName?: string;
  /** GitHub login, for detecting your own ack comments. */
  operatorLogin?: string;
  /** who autonomy-created follow-up tickets go to; unset -> unassigned. */
  linearAssignee?: string;
  /** required when alerts are on. */
  alertSlackId?: string;
}

/** Team facts — from defaults.json, overridable by operator config (design §4.2). */
export interface TeamConfig {
  repo?: string;
  defaultRemoteCwd?: string;
  /** identity a review is requested from. */
  ctoLogin?: string;
  /** identity @-mentioned to bump the reviewer queue. */
  ctoBotLogin?: string;
  /**
   * set of identities whose reviews count as the CTO's. A helper adds the suffix-less alias
   * for every `X[bot]` entry (a GitHub App's GraphQL login omits `[bot]`; REST includes it).
   */
  ctoLogins?: string[];
  ctoRepo?: string;
  ctoHostMatch?: string;
  linearWorkspace?: string;
  /** which `ABC-123` tokens are real tickets (so UTF-8 / HTTP-404 aren't mistaken for them). */
  linearTeamKeys?: string[];
}

/** Built-in defaults (design §4.2) — the ONLY layer with numeric knobs. */
export interface BuiltinDefaults {
  autonomyTimeZone: string; // "America/New_York"
  autonomyStartHour: number; // 9
  autonomyEndHour: number; // 21
  worktreeReapDays: number; // 7
  ctoReviewDelayNudgeMinutes: number; // 15
}

export const BUILTIN_DEFAULTS: BuiltinDefaults = {
  autonomyTimeZone: "America/New_York",
  autonomyStartHour: 9,
  autonomyEndHour: 21,
  worktreeReapDays: 7,
  ctoReviewDelayNudgeMinutes: 15,
};

/** The fully-resolved config the daemon runs on. */
export interface ResolvedConfig extends OperatorIdentity, TeamConfig, BuiltinDefaults {
  profiles: Profile[];
  settings: Settings;
}

/**
 * Runtime authority toggles are environment-only ON PURPOSE (design §4.2, §13.6): they grant
 * authority to act unattended, so "install the daemon" and "let it act" stay separate.
 */
export const RUNTIME_ENV_TOGGLES = [
  "AO_AUTONOMY",
  "AO_AUTONOMY_DRY_RUN",
  "AO_AUTONOMY_SESSIONS",
  "AO_AUTONOMY_LOCATIONS",
  "AO_AUTONOMY_ALWAYS",
  "AO_ALERTS",
  "AO_ALERTS_DRY_RUN",
  "AO_CI_IGNORE",
  "AO_STUCK_MINUTES",
  "AO_STUCK_QUIET_MINUTES",
] as const;

export interface ValidateOptions {
  /** an unset repo is legal and means "no PR monitoring" (design §5.1). */
  needsRepo?: boolean;
  /** required iff AO_ALERTS=1. */
  needsAlerts?: boolean;
}

/**
 * Resolve config across the four layers and validate it. Dies at boot on misconfiguration,
 * with an error naming the missing key.
 * TODO(step 1): implement the layered resolution + blank-env handling + validation.
 */
export function resolveConfig(_opts?: ValidateOptions): ResolvedConfig {
  throw new Error("config.resolveConfig: not implemented (design §4, §5.1)");
}

/** Read a AO_* env value, treating blank/whitespace as unset (design §4.1). */
export function envOrUnset(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
