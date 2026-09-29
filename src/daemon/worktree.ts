/**
 * Worktrees & the worktree reaper (design §7.4, §17.6).
 *
 * Path: <repo top>/.worktrees/ao/<id8>. Branch: with ticket `<branchOwner>/<TICKET>` (uppercased;
 * GH provider normalizes the prefix); without, `ao/<slug(title,40)>-<id8>` (the id suffix is
 * load-bearing against collisions). Base is ALWAYS origin/<defaultBranch>. Script: cd repo top;
 * mkdir; `git fetch --no-tags origin <branch>` (tolerated on failure); `git worktree add -B <branch>
 * <path> origin/<base>` (-B so a second attempt resets rather than fails).
 *
 * Removal: FIRST stop any docker-compose stack whose working_dir label equals the worktree, then
 * `worktree remove --force`, `prune`, `branch -D` (the STORED branch, never re-derived).
 *
 * Reaper (hourly): disk-side enumeration joined back to the store; classify open/too-recent/
 * closed/orphan against a grace period; veto on dirty or a live docker mount; removal cascades
 * `worktree remove --force` -> `rm -rf` -> chmod+rm -> `sudo -n rm -rf` -> prune; success judged
 * by the directory being GONE.
 */

export interface ProvisionResult {
  path: string;
  branch: string;
}

/** Provision a worktree, throwing a one-line error on "branch already checked out elsewhere". */
export function provisionWorktree(): Promise<ProvisionResult> {
  throw new Error("worktree.provisionWorktree: not implemented (design §7.4)");
}

/** Remove a worktree (stop docker stack first, then the removal cascade). */
export function removeWorktree(_path: string, _branch: string): Promise<void> {
  throw new Error("worktree.removeWorktree: not implemented (design §7.4)");
}

/** The hourly reaper pass. TODO(step 9). */
export function reapWorktrees(): Promise<void> {
  throw new Error("worktree.reapWorktrees: not implemented (design §17.6)");
}
