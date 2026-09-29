/**
 * Repository profiles — multi-repo support (design §4.3).
 *
 * Id derived from the repo slug if absent (`Elomi-inc/dorsia-monorepo` ->
 * `elomi-inc-dorsia-monorepo`). `legacy` is reserved; duplicate ids throw. A scalar `repo`
 * matching no profile appends an implicit profile. A stale explicit selection returns null
 * rather than silently falling back.
 */

import type { TicketProvider } from "./types.ts";

export interface ReviewPolicy {
  codex: boolean;
  cto: boolean;
  reviewBot: boolean;
  ctoFollowups: boolean;
}

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  codex: true,
  cto: true,
  reviewBot: true,
  ctoFollowups: true,
};

export interface Profile {
  id: string;
  repo: string;
  defaultBranch: string; // "main"
  localCwd?: string;
  remoteCwd?: string;
  ticketProvider: TicketProvider;
  githubIssuePrefix?: string; // GH profiles
  linearWorkspace?: string;
  linearTeamKeys?: string[];
  ctoLogin?: string;
  ctoBotLogin?: string;
  ctoLogins?: string[];
  ctoRepo?: string;
  ctoHostMatch?: string;
  reviewPolicy: ReviewPolicy;
}

/** Derive a profile id from a repo slug (design §4.3). */
export function profileIdFromRepo(repo: string): string {
  return repo.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface ProfileSelection {
  explicitId?: string;
  explicitRepo?: string;
  defaultProfileId?: string;
  scalarRepo?: string;
}

/**
 * Select the active profile (design §4.3):
 * explicit id/repo -> defaultProfileId -> scalar repo match -> first.
 * A stale explicit selection returns null (never silently falls back).
 * TODO(step 3): implement selection + implicit-profile append + duplicate-id throw.
 */
export function selectProfile(_profiles: Profile[], _sel: ProfileSelection): Profile | null {
  throw new Error("profile.selectProfile: not implemented (design §4.3)");
}
