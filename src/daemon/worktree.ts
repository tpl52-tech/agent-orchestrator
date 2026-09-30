/**
 * Worktrees & the worktree reaper (design §7.4, §17.6).
 *
 * Path: <repo top>/.worktrees/ao/<id8>. Branch: with ticket `<branchOwner>/<TICKET>`; without,
 * `ao/<slug(title,40)>-<id8>` (the id suffix is load-bearing against collisions). Base is ALWAYS
 * origin/<defaultBranch> when available (the shared checkout was once 195 commits behind), falling
 * back to the local branch then HEAD. Script: mkdir; `git fetch --no-tags origin <branch>` (tolerated);
 * `git worktree add -B <branch> <path> <base>` (-B so a second attempt at the same ticket resets).
 * "Already used by worktree at ..." is surfaced as a one-line error. Existing dir -> reuse.
 *
 * Removal: `worktree remove --force`, `prune`, `branch -D` (the STORED branch, never re-derived).
 * TODO(step 9): stop any docker-compose stack whose working_dir label equals the worktree first, and
 * the disk-side hourly reaper.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

interface GitResult { code: number; stdout: string; stderr: string; }

function git(cwd: string, args: string[]): GitResult {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { code: r.status ?? -1, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

/** The git top-level of a directory, or null if it isn't inside a repo. */
export function gitToplevel(cwd: string): string | null {
  const r = git(cwd, ["rev-parse", "--show-toplevel"]);
  return r.code === 0 && r.stdout ? r.stdout : null;
}

/** Slugify a title for a branch name (design §7.4). */
export function slug(title: string, max = 40): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max) || "session";
}

/** Compute the branch name for a session (design §7.4). */
export function branchName(opts: {
  ticket?: string | null;
  branchOwner?: string;
  title?: string;
  id8: string;
  githubPrefixNormalize?: boolean;
}): string {
  if (opts.ticket && opts.branchOwner) {
    return `${opts.branchOwner}/${opts.ticket.toUpperCase()}`;
  }
  return `ao/${slug(opts.title ?? opts.ticket ?? "session")}-${opts.id8}`;
}

export interface ProvisionOptions {
  repoTop: string;
  branch: string;
  defaultBranch: string;
  id8: string;
}

export interface ProvisionResult {
  path: string;
  branch: string;
  reused: boolean;
}

/** Provision a worktree; throws a one-line error on "branch already checked out elsewhere". */
export function provisionWorktree(opts: ProvisionOptions): ProvisionResult {
  const path = join(opts.repoTop, ".worktrees", "ao", opts.id8);
  if (existsSync(path)) return { path, branch: opts.branch, reused: true };

  mkdirSync(dirname(path), { recursive: true });
  git(opts.repoTop, ["fetch", "--no-tags", "origin", opts.defaultBranch]); // tolerated on failure

  const base = resolveBase(opts.repoTop, opts.defaultBranch);
  const add = git(opts.repoTop, ["worktree", "add", "-B", opts.branch, path, base]);
  if (add.code !== 0) {
    const conflict = /already used by worktree at (.+)/i.exec(add.stderr);
    if (conflict) {
      throw new Error(
        `worktree: branch '${opts.branch}' is already checked out at ${conflict[1]!.trim()} — ` +
        `remove that worktree or pick another branch (refusing to share the checkout).`,
      );
    }
    throw new Error(`worktree: 'git worktree add' failed for '${opts.branch}': ${add.stderr}`);
  }
  return { path, branch: opts.branch, reused: false };
}

function resolveBase(repoTop: string, defaultBranch: string): string {
  if (git(repoTop, ["rev-parse", "--verify", "--quiet", `origin/${defaultBranch}`]).code === 0) {
    return `origin/${defaultBranch}`;
  }
  if (git(repoTop, ["rev-parse", "--verify", "--quiet", defaultBranch]).code === 0) {
    return defaultBranch;
  }
  return "HEAD";
}

export interface RemoveOptions {
  repoTop: string;
  path: string;
  branch: string;
}

/** Remove a worktree and delete its branch (design §7.4). */
export function removeWorktree(opts: RemoveOptions): void {
  // TODO(step 9): stop any docker-compose stack whose working_dir label equals the worktree first.
  git(opts.repoTop, ["worktree", "remove", "--force", opts.path]);
  git(opts.repoTop, ["worktree", "prune"]);
  git(opts.repoTop, ["branch", "-D", opts.branch]);
}

/** The hourly disk-side reaper pass. TODO(step 9). */
export function reapWorktrees(): Promise<void> {
  throw new Error("worktree.reapWorktrees: not implemented (design §17.6, build step 9)");
}
