/**
 * TUI client entry (`ao`) — a thin Ink app (design §3.1, §19).
 *
 * Holds NO durable state. Renders a 1-second snapshot; attaches to a live agent by raw byte
 * passthrough (dashboard OR attached, toggled like tmux). Auto-starts the daemon if none is
 * listening. Reconnect with 500ms->5s backoff forever after a first successful connect; pending
 * requests failed on close; unsolicited events dropped during raw attach except session.openUrl.
 */

export async function main(): Promise<void> {
  throw new Error("client.main: not implemented — see BUILD.md build step 1/2 (design §19)");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
