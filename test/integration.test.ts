import { test, expect, describe, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon, type Daemon } from "../src/daemon/index.ts";
import { connectDaemon, type DaemonClient } from "../src/client/daemon-client.ts";
import type { Task, Session } from "../src/shared/types.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

let daemon: Daemon | null = null;
let client: DaemonClient | null = null;
let home: string | null = null;

afterEach(() => {
  client?.close();
  daemon?.stop();
  if (home) rmSync(home, { recursive: true, force: true });
  client = null; daemon = null; home = null;
});

async function waitFor(fn: () => boolean, timeoutMs = 4000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (fn()) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for condition");
}

describe("daemon <-> client end to end", () => {
  test("create task, spawn a PTY session, attach, exchange bytes, detach", async () => {
    home = mkdtempSync(join(tmpdir(), "ao-test-"));
    daemon = startDaemon(home);
    client = await connectDaemon(daemon.socketPath);

    // Create a task and confirm it round-trips through the snapshot.
    const task = await client.request<Task>("task.create", { name: "integration" });
    const snap = await client.request<{ tasks: Task[] }>("snapshot.get");
    expect(snap.tasks.map((t) => t.id)).toContain(task.id);

    // Collect PTY output.
    let output = "";
    client.onPtyOutput((_sid, bytes) => { output += dec.decode(bytes); });

    // Spawn a session backed by a small interactive script (command overrides the tool argv).
    const session = await client.request<Session>("session.spawn", {
      taskId: task.id,
      tool: "claude",
      location: "local",
      cwd: home,
      command: ["bash", "-c", 'printf "READY\\n"; read line; printf "ECHO:%s\\n" "$line"'],
    });
    expect(session.taskId).toBe(task.id);

    // Attach: replay + live output flow to this client.
    await client.request("session.attach", { sessionId: session.id, cols: 80, rows: 24 });
    await waitFor(() => output.includes("READY"));

    // Send a line of input; the script echoes it back.
    client.sendInput(session.id, enc.encode("hello\n"));
    await waitFor(() => output.includes("ECHO:hello"));

    await client.request("session.detach");

    // The session appears live in the session list with a runtime status.
    const sessions = await client.request<Array<Session & { status: string }>>("session.list", {});
    expect(sessions.find((s) => s.id === session.id)).toBeDefined();
  });

  test("rejects unsupported requests without crashing the daemon", async () => {
    home = mkdtempSync(join(tmpdir(), "ao-test-"));
    daemon = startDaemon(home);
    client = await connectDaemon(daemon.socketPath);
    await expect(client.request("usage.get")).rejects.toThrow(/Milestone 1/);
    // still alive afterward
    const snap = await client.request<{ tasks: unknown[] }>("snapshot.get");
    expect(Array.isArray(snap.tasks)).toBe(true);
  });
});
