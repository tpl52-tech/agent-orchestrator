/**
 * Session manager — owns the lifecycle of every agent (design §7).
 *
 * Spawn sequence (design §7.1): resolve profile -> parse seed ticket -> mint the resume handle ->
 * create the DB row FIRST (the id is needed for the worktree path / tmux name) -> provision the
 * worktree (on failure delete the row and rethrow) -> normalize/expand the seed -> build argv via the
 * per-CLI spawn spec -> start the PTY -> for a claude ticket seed, deliver it deferred (§10.7).
 *
 * MILESTONE 3 scope: LOCAL agents. Devbox spawning (ssh+tmux) is build step 4; codex rollout discovery
 * and full deferred-seed queue interplay are steps 11 / 6.
 */

import { mkdirSync } from "node:fs";
import { spawnPty, type PtySession, type PtyExit } from "./pty.ts";
import { Store } from "./store.ts";
import type { StatusTracker } from "./monitors/status.ts";
import { provisionWorktree, gitToplevel, branchName } from "./worktree.ts";
import { sessionDir, stateHome } from "../shared/paths.ts";
import { buildSpawnSpec, DEFERRED_TOOL_GUIDANCE, type SpawnSpec } from "../shared/spawn-spec.ts";
import { isBareTicket, extractTickets, expandTicketSeed } from "../shared/ticket.ts";
import { selectProfile, profileIdFromRepo, DEFAULT_REVIEW_POLICY, type Profile } from "../shared/profile.ts";
import { applyTicketPlaceholder } from "../shared/settings.ts";
import { defaultOperatorConfig, type OperatorConfigLite } from "../shared/config.ts";
import type { Session, Tool, Location, Permissions, Effort } from "../shared/types.ts";

const HOOK_PATH = new URL("./hook-notify.ts", import.meta.url).pathname;

export interface SpawnParams {
  taskId: string;
  title?: string;
  tool?: Tool;
  location?: Location;
  cwd: string;
  usesWorktree?: boolean;
  model?: string;
  permissions?: Permissions;
  effort?: Effort | null;
  profileId?: string;
  repo?: string;
  seed?: string;
  cols?: number;
  rows?: number;
  /** Override argv (tests / bring-up); otherwise derived from the per-CLI spawn spec. */
  command?: string[];
}

export interface SessionManager {
  spawn(params: SpawnParams): Promise<Session>;
  resume(sessionId: string, size?: { cols: number; rows: number }): PtySession;
  live(sessionId: string): PtySession | undefined;
  status(sessionId: string): import("../shared/types.ts").SessionStatus;
  write(sessionId: string, bytes: Uint8Array): void;
  resize(sessionId: string, cols: number, rows: number): void;
  kill(sessionId: string): void;
  forget(sessionId: string): void;
  onExit(cb: (e: { sessionId: string; exit: PtyExit }) => void): () => void;
  shutdown(): void;
}

export function createSessionManager(
  store: Store,
  tracker: StatusTracker,
  config: OperatorConfigLite = defaultOperatorConfig(),
  home = stateHome(),
): SessionManager {
  const live = new Map<string, PtySession>();
  const exitCbs = new Set<(e: { sessionId: string; exit: PtyExit }) => void>();

  const startPty = (
    session: Session,
    argv: string[],
    env: Record<string, string>,
    size?: { cols: number; rows: number },
  ): PtySession => {
    mkdirSync(sessionDir(session.id, home), { recursive: true });
    tracker.register(session.id);
    const pty = spawnPty({
      sessionId: session.id,
      argv,
      cwd: session.cwd,
      cols: size?.cols,
      rows: size?.rows,
      env,
      onExit: (exit) => {
        live.delete(session.id);
        tracker.onExit(session.id, exit.status);
        for (const cb of exitCbs) cb({ sessionId: session.id, exit });
      },
    });
    pty.addOutputListener(() => tracker.onOutput(session.id));
    live.set(session.id, pty);
    return pty;
  };

  const resolveProfile = (params: SpawnParams): Profile => {
    const chosen = selectProfile(config.profiles, {
      explicitId: params.profileId,
      explicitRepo: params.repo,
      defaultProfileId: config.defaultProfileId,
      scalarRepo: config.repo,
    });
    if (chosen) return chosen;
    // Synthesize a default profile so a single-repo setup works without a config file.
    const repo = params.repo ?? config.repo ?? "";
    return {
      id: params.profileId ?? (repo ? profileIdFromRepo(repo) : "legacy"),
      repo,
      defaultBranch: "main",
      ticketProvider: "linear",
      linearTeamKeys: config.linearTeamKeys,
      linearWorkspace: config.linearWorkspace,
      ctoLogin: config.ctoLogin,
      ctoBotLogin: config.ctoBotLogin,
      reviewPolicy: { ...DEFAULT_REVIEW_POLICY },
    };
  };

  return {
    async spawn(params) {
      const D = config.settings.spawnDefaults;
      const tool = params.tool ?? D.tool;
      const location = params.location ?? D.location;
      if (location === "devbox") {
        throw new Error("session-manager: devbox spawning lands in build step 4 (design §9)");
      }
      const model = params.model ?? D.model;
      const permissions = params.permissions ?? D.permissions;
      const effort = params.effort ?? D.effort;
      const usesWorktree = params.usesWorktree ?? D.usesWorktree;
      const profile = resolveProfile(params);
      const teamKeys = profile.linearTeamKeys ?? config.linearTeamKeys ?? [];

      // Seed / ticket resolution.
      let seed = params.seed?.trim() || undefined;
      let ticket: string | null = null;
      let seedIsTicket = false;
      if (seed && isBareTicket(seed, teamKeys)) {
        ticket = seed.toUpperCase();
        seedIsTicket = true;
        const custom = ticketPromptFor(tool, config);
        seed = custom ? applyTicketPlaceholder(custom, ticket) : expandTicketSeed(ticket, tool, {
          provider: profile.ticketProvider,
          reviewPolicy: profile.reviewPolicy,
          ctoLogin: profile.ctoLogin,
          codexBotLogin: profile.ctoBotLogin,
        });
      } else {
        const from = `${params.title ?? ""} ${seed ?? ""}`;
        ticket = extractTickets(from, teamKeys, profile.ticketProvider)[0] ?? null;
      }

      const title = params.title?.trim() || ticket || "";
      const resumeHandle = mintResumeHandle(tool);

      // Create the DB row first (the id anchors the worktree path).
      let session = store.createSession({
        taskId: params.taskId, title, tool, location, cwd: params.cwd, usesWorktree,
        model, permissions, effort, resumeHandle, profileId: profile.id,
      });

      // Worktree.
      if (usesWorktree) {
        try {
          const repoTop = gitToplevel(profile.localCwd || params.cwd);
          if (!repoTop) throw new Error(`usesWorktree but '${params.cwd}' is not inside a git repo`);
          const id8 = session.id.slice(0, 8);
          const branch = branchName({ ticket, branchOwner: config.branchOwner, title, id8 });
          const wt = provisionWorktree({ repoTop, branch, defaultBranch: profile.defaultBranch, id8 });
          store.updateSession(session.id, { cwd: wt.path, worktreePath: wt.path, worktreeBranch: wt.branch });
          session = store.getSession(session.id)!;
        } catch (err) {
          store.removeSession(session.id);
          throw err;
        }
      }

      // argv / env.
      let argv: string[];
      let env: Record<string, string>;
      let spec: SpawnSpec | null = null;
      if (params.command) {
        argv = params.command;
        env = { AO_SESSION_ID: session.id, AO_SESSION_DIR: sessionDir(session.id, home) };
      } else {
        spec = buildSpawnSpec({
          tool, sessionId: session.id, cwd: session.cwd, model, effort, permissions,
          isResume: false, resumeHandle, seed, seedIsTicket,
          bunPath: process.execPath, hookNotifyPath: HOOK_PATH, sessionDir: sessionDir(session.id, home),
          appendSystemPrompt: DEFERRED_TOOL_GUIDANCE, claudeMdExcludes: [],
        });
        argv = spec.argv;
        env = spec.env;
      }

      const pty = startPty(session, argv, env, sizeOf(params));

      if (spec?.deferSeedPrompt && seed) void deliverDeferredSeed(pty, seed).catch(() => {});

      return session;
    },

    resume(sessionId, size) {
      const existing = live.get(sessionId);
      if (existing) return existing;
      const session = store.getSession(sessionId);
      if (!session) throw new Error(`session-manager.resume: unknown session ${sessionId}`);
      if (session.closed) throw new Error(`session-manager.resume: session ${sessionId} is closed`);
      const spec = buildSpawnSpec({
        tool: session.tool, sessionId: session.id, cwd: session.cwd, model: session.model,
        effort: session.effort, permissions: session.permissions, isResume: true,
        resumeHandle: session.resumeHandle, bunPath: process.execPath, hookNotifyPath: HOOK_PATH,
        sessionDir: sessionDir(session.id, home), appendSystemPrompt: DEFERRED_TOOL_GUIDANCE,
      });
      return startPty(session, spec.argv, spec.env, size);
    },

    live: (sessionId) => live.get(sessionId),
    status: (sessionId) => tracker.status(sessionId),
    write(sessionId, bytes) { live.get(sessionId)?.write(bytes); },
    resize(sessionId, cols, rows) { live.get(sessionId)?.resize(cols, rows); },
    kill(sessionId) { live.get(sessionId)?.kill(); },
    forget(sessionId) { tracker.unregister(sessionId); },
    onExit(cb) { exitCbs.add(cb); return () => exitCbs.delete(cb); },
    shutdown() {
      for (const pty of live.values()) pty.kill();
      live.clear();
    },
  };
}

function sizeOf(p: SpawnParams): { cols: number; rows: number } | undefined {
  return p.cols && p.rows ? { cols: p.cols, rows: p.rows } : undefined;
}

function mintResumeHandle(tool: Tool): string | null {
  if (tool === "claude") return crypto.randomUUID(); // minted so the transcript filename is known
  if (tool === "copilot") return `ao-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  return null; // codex discovers its own id later; openrouter isn't a local PTY
}

function ticketPromptFor(tool: Tool, config: OperatorConfigLite): string {
  const s = config.settings;
  if (tool === "codex") return s.ticketPromptCodex;
  if (tool === "copilot") return s.ticketPromptCopilot;
  if (tool === "openrouter") return s.ticketPromptOpenRouter;
  return s.ticketPrompt;
}

/**
 * Deferred seed delivery for claude (design §10.7): status can't signal readiness, so measure output
 * quiescence (poll 250ms, require 1.5s quiet, give up at 30s), then a fixed 6s MCP grace, then write
 * the body and — as a SEPARATE write 150ms later — the CR (§10.5: CR must never ride with the text).
 * Written directly, not via a queue (M3 has no other in-flight nudges; the queue interplay is step 6).
 */
async function deliverDeferredSeed(pty: PtySession, seed: string): Promise<void> {
  let last = Date.now();
  const off = pty.addOutputListener(() => { last = Date.now(); });
  const start = Date.now();
  try {
    while (Date.now() - start < 30_000) {
      await Bun.sleep(250);
      if (Date.now() - last >= 1_500) break;
    }
    await Bun.sleep(6_000); // MCP grace (Linear's server has no readiness signal)
    pty.write(new TextEncoder().encode(seed.replace(/\r\n?/g, "\n")));
    await Bun.sleep(150);
    pty.write(new Uint8Array([0x0d])); // CR as its own write
  } finally {
    off();
  }
}
