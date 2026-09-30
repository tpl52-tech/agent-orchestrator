/**
 * TUI client entry (`ao`) — a thin Ink app (design §3.1, §19).
 *
 * MILESTONE 2 dashboard: a flat, HUMAN-ORDERED list of tasks and their sessions — never re-sorted by
 * urgency or recency (rows must not move under the cursor, §19). Each task shows a rollup glyph (the
 * highest-attention session status, §10.1); each session shows its status glyph, title, tool:model,
 * location, worktree/planning badges. Live status arrives via `session.status` events on top of a 1s
 * poll. Navigate with the arrows, Enter to attach (Ink suspends for raw passthrough, re-renders on
 * detach), n new task, a add agent, x close, r refresh, q quit. PR rows, usage/quota, and the focus
 * view arrive with their subsystems (build steps 5+).
 */

import React, { useEffect, useState } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { connectDaemon, type DaemonClient } from "./daemon-client.ts";
import { attachSession } from "./attach.ts";
import { paths } from "../shared/paths.ts";
import { statusStyle, taskRollupStatus } from "../shared/status.ts";
import type { Task, Session, SessionStatus } from "../shared/types.ts";

type SessionView = Session & { status: SessionStatus };
interface Snapshot { tasks: Task[]; sessions: SessionView[] }
type Action = { type: "quit" } | { type: "attach"; sessionId: string };

type Row =
  | { kind: "task"; task: Task; rollup: SessionStatus | null }
  | { kind: "session"; session: SessionView };

function buildRows(snap: Snapshot): Row[] {
  const rows: Row[] = [];
  for (const task of snap.tasks) {
    const sessions = snap.sessions.filter((x) => x.taskId === task.id);
    rows.push({ kind: "task", task, rollup: taskRollupStatus(sessions.map((s) => s.status)) });
    for (const s of sessions) rows.push({ kind: "session", session: s });
  }
  return rows;
}

const EMPTY: Snapshot = { tasks: [], sessions: [] };

function TaskRow({ row, selected }: { row: Extract<Row, { kind: "task" }>; selected: boolean }) {
  const marker = selected ? "› " : "  ";
  const style = row.rollup ? statusStyle(row.rollup) : null;
  return (
    <Text color={selected ? "cyan" : undefined} bold>
      {marker}
      {style
        ? <Text color={style.color} dimColor={style.dim}>{style.glyph} </Text>
        : <Text dimColor>▸ </Text>}
      {row.task.name}
      {row.task.status === "closed" ? <Text dimColor> (closed)</Text> : null}
    </Text>
  );
}

function SessionRow({ s, selected }: { s: SessionView; selected: boolean }) {
  const marker = selected ? "› " : "  ";
  const style = statusStyle(s.status);
  return (
    <Text color={selected ? "cyan" : undefined}>
      {marker}    <Text color={style.color} dimColor={style.dim}>{style.glyph}</Text>{" "}
      {s.title || s.id.slice(0, 8)}
      <Text dimColor> · {s.tool}:{s.model} · {s.location}{s.usesWorktree ? " wt" : ""}</Text>
      {" "}<Text color={style.color} dimColor={style.dim}>{style.label}</Text>
      {s.planning ? <Text color="magenta"> ·planning</Text> : null}
    </Text>
  );
}

function Dashboard({ client, onAction }: { client: DaemonClient; onAction: (a: Action) => void }) {
  const { exit } = useApp();
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<"list" | "newTask">("list");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try { setSnap(await client.request<Snapshot>("snapshot.get")); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 1000);
    const off = client.on((ev) => {
      if (ev.type === "session.status" || ev.type === "session.exit") void refresh();
    });
    return () => { clearInterval(t); off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = buildRows(snap);
  const clamped = Math.min(cursor, Math.max(0, rows.length - 1));
  const current = rows[clamped];

  const taskFor = (): Task | undefined =>
    current?.kind === "task" ? current.task
      : current?.kind === "session" ? snap.tasks.find((t) => t.id === current.session.taskId)
      : undefined;

  useInput((input, key) => {
    if (mode === "newTask") {
      if (key.escape) { setMode("list"); setDraft(""); return; }
      if (key.return) {
        const name = draft.trim();
        setMode("list"); setDraft("");
        if (name) client.request("task.create", { name }).then(refresh).catch(() => {});
        return;
      }
      if (key.backspace || key.delete) { setDraft((d) => d.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setDraft((d) => d + input);
      return;
    }

    if (input === "q" || (key.ctrl && input === "c")) { onAction({ type: "quit" }); exit(); return; }
    if (key.upArrow || input === "k") { setCursor((c) => Math.max(0, c - 1)); return; }
    if (key.downArrow || input === "j") { setCursor((c) => Math.min(rows.length - 1, c + 1)); return; }
    if (input === "r") { void refresh(); return; }
    if (input === "n") { setMode("newTask"); return; }

    if (input === "a") {
      const task = taskFor();
      if (task) {
        client.request("session.spawn", {
          taskId: task.id, tool: "claude", location: "local", cwd: process.cwd(),
          model: "auto", permissions: "full-access", usesWorktree: false,
        }).then(refresh).catch((e) => setError(String(e)));
      }
      return;
    }

    if (current?.kind === "session") {
      if (key.return) { onAction({ type: "attach", sessionId: current.session.id }); exit(); return; }
      if (input === "x") {
        client.request("session.close", { sessionId: current.session.id }).then(refresh).catch(() => {});
        return;
      }
    }
  });

  const openTasks = snap.tasks.filter((t) => t.status === "open").length;

  return (
    <Box flexDirection="column">
      <Text bold>
        agent-orchestrator <Text dimColor>· {openTasks} open · {snap.sessions.length} sessions</Text>
      </Text>
      {rows.length === 0 && <Text dimColor>no tasks yet — press n to create one</Text>}
      {rows.map((row, idx) =>
        row.kind === "task"
          ? <TaskRow key={`t-${row.task.id}`} row={row} selected={idx === clamped} />
          : <SessionRow key={`s-${row.session.id}`} s={row.session} selected={idx === clamped} />,
      )}
      {mode === "newTask" && <Text>new task name: {draft}▌</Text>}
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>↑/↓ move · enter attach · n new task · a add agent · x close · r refresh · q quit</Text>
    </Box>
  );
}

async function runDashboard(client: DaemonClient): Promise<Action> {
  let action: Action = { type: "quit" };
  const app = render(<Dashboard client={client} onAction={(a) => { action = a; }} />);
  await app.waitUntilExit();
  return action;
}

async function ensureDaemon(): Promise<DaemonClient> {
  const socket = paths().socket;
  try {
    return await connectDaemon(socket);
  } catch {
    // Spawn the daemon and wait for it to listen (design §3.1: the client auto-starts the daemon).
    const daemonEntry = new URL("../daemon/index.ts", import.meta.url).pathname;
    Bun.spawn([process.execPath, "run", daemonEntry], { stdio: ["ignore", "ignore", "ignore"] }).unref();
    const deadline = Date.now() + 5000;
    for (;;) {
      await Bun.sleep(150);
      try { return await connectDaemon(socket); }
      catch { if (Date.now() > deadline) throw new Error("daemon failed to start within 5s"); }
    }
  }
}

/** Open a URL in the OS browser (design §9.3: the client opens the Tailscale re-auth link). */
function openUrl(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  try { Bun.spawn([cmd, url], { stdio: ["ignore", "ignore", "ignore"] }).unref(); } catch { /* best effort */ }
}

export async function main(): Promise<void> {
  const client = await ensureDaemon();
  // session.openUrl must be handled even during raw attach (the attach can block on the very
  // Tailscale re-auth this event unblocks, design §8.4/§9.3).
  const offOpenUrl = client.on((ev) => {
    if (ev.type === "session.openUrl") openUrl((ev.data as { url: string }).url);
  });
  try {
    for (;;) {
      const action = await runDashboard(client);
      if (action.type === "quit") break;
      if (action.type === "attach") await attachSession(client, action.sessionId);
    }
  } finally {
    offOpenUrl();
    client.close();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
