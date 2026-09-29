/**
 * Focus classification — shared, pure, over WorkItem fields alone (design §14).
 *
 * Used by BOTH the daemon's autonomy rule 7 and the client's focus view, so it lives in
 * shared and must stay a pure function of its inputs. This is where "ready to merge / needs
 * attention / waiting review / in progress" is decided once.
 */

import type { WorkItem, Session } from "./types.ts";

export type WorkItemFocus =
  | "final-ready"
  | "ready-to-merge"
  | "needs-attention"
  | "waiting-review"
  | "in-progress";

export type SessionFocus = "planning" | "needs-attention" | "working";

/**
 * badStanding (ordered, design §14): CI failed with a NON-EMPTY failed-check list (a failure
 * whose checks were all filtered is a phantom); CTO changes-requested unless addressed; CTO
 * follow-up comments; merge conflict (UNKNOWN stays silent); unresolved threads > 0 unless the
 * PR is otherwise finished (an unclicked resolve button is not work).
 * TODO(step 5): implement.
 */
export function badStanding(_item: WorkItem): boolean {
  throw new Error("focus.badStanding: not implemented (design §14)");
}

/** reviewApproved: CTO required -> approved; else codex required -> approved; else true. */
export function reviewApproved(_item: WorkItem): boolean {
  throw new Error("focus.reviewApproved: not implemented (design §14)");
}

/**
 * isReadyToMerge (design §14): PR, OPEN, not draft, mergeable exactly MERGEABLE, CI success,
 * review approved, CTO follow-up sweep not pending, codex not `requested`. Open threads and an
 * unaddressed code-quality review are caveats, NOT disqualifiers.
 */
export function isReadyToMerge(_item: WorkItem): boolean {
  throw new Error("focus.isReadyToMerge: not implemented (design §14)");
}

/** classifyWorkItem — needs-attention only after a 20-min grace of GitHub silence. */
export function classifyWorkItem(_item: WorkItem, _now: number): WorkItemFocus {
  throw new Error("focus.classifyWorkItem: not implemented (design §14)");
}

/**
 * classifySession (design §14): planning wins; needs-input/done/error/stuck -> needs-attention;
 * a live agent silent >= 10 min -> needs-attention; else working. Thresholds are deliberately
 * far below the 45-min stall alert: focus is the operator looking; the alert interrupts.
 */
export function classifySession(_session: Session, _now: number): SessionFocus {
  throw new Error("focus.classifySession: not implemented (design §14)");
}
