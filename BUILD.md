# Build plan & roadmap

This scaffold follows the design description's own suggested build order. Each step layers on
the last; the daemon + SQLite + PTY foundation must exist before anything observes or acts.
Check items off as they land. Every stub file cites the design section (`§N`) it implements.

## Build order

- [x] **1. Foundation.** Daemon + SQLite + UDS binary framing + one local PTY + attach/detach +
      terminal reset. (Tasks/sessions, 256 KB replay buffer, double-Ctrl-B detach chord.) —
      `src/daemon/{index,store,pty,uds-server,session-manager}.ts`, `src/shared/{wire,paths}.ts`,
      `src/client/{index,attach,daemon-client}.tsx`. Covered by `bun test` (framing, store, PTY,
      end-to-end daemon↔client). The client dashboard is intentionally minimal here; the rich TUI
      (status glyphs, PR rows, focus view, full keymap) is step 2, and the per-CLI spawn spec /
      worktrees are step 3 — the session manager currently uses a placeholder argv.
- [ ] **2. Status.** Status state machine with claude hooks, idle timer, stuck ceiling;
      dashboard with stable (human-order) rows. — `src/daemon/monitors/status.ts`,
      `src/client/dashboard.tsx`.
- [ ] **3. Spawning.** Worktrees, per-CLI spawn spec, ticket seed expansion, settings. —
      `src/daemon/worktree.ts`, `src/shared/{spawn-spec,settings,ticket}.ts`.
- [ ] **4. Remote agents.** ssh+tmux recipe, remote hook, liveness, tmux repaint on attach,
      Tailscale re-auth detection. — `src/shared/remote.ts`, `src/daemon/pty.ts`, `deploy/box/`.
- [ ] **5. Work items.** Branch linking, batched GitHub GraphQL query, derived states,
      retirement, focus classification, focus view. — `src/daemon/monitors/work-item.ts`,
      `src/shared/focus.ts`.
- [ ] **6. Nudges.** Nudge delivery with the framing rules and pane guards; manual nudge
      form. — `src/daemon/nudge/index.ts`.
- [ ] **7. Autonomy.** Policy + actuator + audit log + window + kill switch + dry-run;
      activity log. — `src/daemon/autonomy/{policy,actuator,index}.ts`,
      `src/shared/autonomy-window.ts`.
- [ ] **8. Alerts / accounting.** Alerts + Slack narrator; usage ledger; quota probes. —
      `src/daemon/{alerts,monitors/usage,monitors/quota}.ts`, `src/shared/pricing.ts`,
      `deploy/alerts/narrate.sh`.
- [ ] **9. Federation.** Box daemon, roster, manifest, report, deploy, watchdog, cleanup,
      reaper. — `src/daemon/box/*`, `src/cli/monitor.ts`, `deploy/systemd/*`, `deploy/box/*`.
- [ ] **10. OpenRouter runtime (optional).** Agent loop with kernel sandbox, compaction, MCP
      host, credential seeding. — `src/daemon/openrouter/*`.

## Design principles (copy these)

1. Split **identity** (no defaults, fail loudly) from **preferences** (always defaulted,
   tolerant) from **team facts** (tracked org file).
2. One writer per database; readers are one-shot read-only processes; federation is plain
   ssh, no long-lived RPC.
3. The agent CLI is a black box on the alternate screen: status from hooks + idle timing +
   transcript growth; history from the transcript, not the pane; attach repaints from tmux.
4. Never type into a busy pane, a menu, or over pending/stranded text; body and Enter are
   separate writes; promote to `performed` only after the Enter; never retype stranded text.
5. A transport negative (ssh 255, timeout, empty probe, failed capture) is "no answer", never
   "dead", "idle" or "clean".
6. Absence is never a pass for a gate (no grade, no greenlight, no approval = not yet) —
   except where the bot is *known* to be silent on clean (the review bot).
7. Reviews are bound to commit shas, not timestamps; the audit log is the source of truth for
   handovers; dedupe keys encode the event's identity, never the row.
8. First-match-wins policy needs explicit anti-starvation: handover stamps, attempted-backoffs,
   permanent-vs-transient gate separation, act-time freshness.
9. Every automated action has a bounded budget: per-hour SQL counts, cooldowns, hold limits,
   retry caps, extension caps, keep-awake caps.
10. Deploy ships code, never authority or credentials; enabling autonomy/alerts is a separate
    per-host decision; the kill switch is a file.
11. Log suppressions and "considered and declined" — "why didn't it act" is asked more than
    "what did it do".
12. Use the counterpart system's own clock for silence (GitHub `updated_at`), never your poll
    timestamp.

## Known gaps to decide deliberately (from the source system)

The reference implementation shipped with these; a rebuild should fix them rather than
reproduce them. Tracked here so they are decided on purpose.

- [ ] **Stalled rule unreachable.** It compares against `updatedAt`, which every successful
      poll rewrites. Key the stall on a transition-stamped "bad state entered at" clock instead.
- [ ] **Roster publisher lazy start.** Start it on the first devbox spawn, not only at boot —
      otherwise the first post-boot devbox session never publishes and the box refuses everything.
- [ ] **Introspection probe not deployed.** Ship `introspect.sh` with the deploy tree and make
      its absence loud (absent → silent fidelity `none` for every claude agent).
- [ ] **Worktree grace inconsistency.** Config default (7 days) vs the exported constant (0,
      CLI-only). Pick one source of truth.
- [ ] **CTO review delay nudge always armed** at 15 min; disabled only by not naming the action.
- [ ] **Three remote-home rules.** History hardcodes `/home/ubuntu`; spawn derives from the ssh
      user; hook deploy asks the box. Unify on one derivation.
- [ ] **thermo-regrade** is a nudge-transport action but is missing from the queue-full cap and
      the restart orphan sweep; a restart can strand its `queued` row forever.
- [ ] **Nudge freshness vs badStanding mismatch.** Freshness checks raw CI failure; badStanding
      requires a non-empty failed-check list. Align them.
- [ ] **Box-side dispatch proceeds on a failed pane capture; Mac-side holds.** Decide the
      intended asymmetry.

## Org-specific vocabulary to parametrize

Reviewer identity set + @-mention bump convention; the review-bot login + trigger phrase; the
`github-actions` "code quality review" heading and the `THERMO GRADE:` comment convention; the
"greenlight" convergence-gate check name + repo-scoped ignored checks; Linear team keys +
workspace; the three SKILL.md docs; the alert persona name. All live in config / `defaults.json`,
never hardcoded.
