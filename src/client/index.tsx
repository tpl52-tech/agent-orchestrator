/**
 * TUI client entry (`ao`) — a thin Ink app (design §3.1, §19).
 *
 * MILESTONE 1: a minimal dashboard — a flat, human-ordered list of tasks and their sessions; navigate
 * with the arrows, Enter to attach (Ink is suspended for raw byte passthrough, then re-rendered on
 * detach), `n` to create a task, `a` to add an agent, `x` to close a session, `r` to refresh, `q` to
 * quit. Auto-starts the daemon if none is listening. The rich dashboard (status glyphs, PR rows,
 * focus view, usage/quota, the full keymap) is build step 2.
 */

import React, { useEffect, useState } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { connectDaemon, type DaemonClient } from "./daemon-client.ts";
import { attachSession } from "./attach.ts";
import { paths } from "../shared/paths.ts";
import type { Task, Session, SessionStatus } from "../shared/types.ts";

type SessionView = Session & { status: SessionStatus };
interface Snapshot { tasks: Task[]; sessions: SessionView[] }
type Action = { type: "quit" } | { type: "attach"; sessionId: string };

type Row =
  | { kind: "task"; task: Task }
  | { kind: "session"; session: SessionView };

function buildRows(snap: Snapshot): Row[] {
  const rows: Row[] = [];
  for (const task of snap.tasks) {
    rows.push({ kind: "task", task });
    for (const s of snap.sessions.filter((x) => x.taskId === task.id)) {
      rows.push({ kind: "session", session: s });
    }
  }
  return rows;
}

const EMPTY: Snapshot = { tasks: [], sessions: [] };

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
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = buildRows(snap);
  const clamped = Math.min(cursor, Math.max(0, rows.length - 1));
  const current = rows[clamped];

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
      const task = current?.kind === "task" ? current.task
        : current?.kind === "session" ? snap.tasks.find((t) => t.id === current.session.taskId) : undefined;
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

  return (
    <Box flexDirection="column">
      <Text bold>agent-orchestrator</Text>
      {rows.length === 0 && <Text dimColor>no tasks yet — press n to create one</Text>}
      {rows.map((row, idx) => {
        const sel = idx === clamped;
        const marker = sel ? "› " : "  ";
        if (row.kind === "task") {
          return (
            <Text key={`t-${row.task.id}`} color={sel ? "cyan" : undefined} bold>
              {marker}▸ {row.task.name} {row.task.status === "closed" ? "(closed)" : ""}
            </Text>
          );
        }
        const s = row.session;
        return (
          <Text key={`s-${s.id}`} color={sel ? "cyan" : undefined}>
            {marker}    {s.title || s.id.slice(0, 8)} · {s.tool} · {s.status}
          </Text>
        );
      })}
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

export async function main(): Promise<void> {
  const client = await ensureDaemon();
  try {
    for (;;) {
      const action = await runDashboard(client);
      if (action.type === "quit") break;
      if (action.type === "attach") await attachSession(client, action.sessionId);
    }
  } finally {
    client.close();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
