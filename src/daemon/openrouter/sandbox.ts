/**
 * OpenRouter runtime sandbox — KERNEL enforcement, not string checks (design §16).
 *
 * macOS: a seatbelt profile (deny default; allow exec/fork; read everywhere; write ONLY under
 * WORKDIR and a per-session scratch inside cwd with TMPDIR redirected; cwd realpath'd because the
 * kernel matches resolved paths; unix sockets allowed for DNS; remote IP denied unless full-access;
 * parameters passed as `-D`, never interpolated).
 *
 * Linux: bubblewrap (root read-only bind, cwd writable, minimal /dev + /proc, --unshare-pid,
 * --die-with-parent, --unshare-net when denied; needs unprivileged userns or setuid bwrap).
 *
 * Policy: ask = confine + no network + approve every command/write/edit/non-read MCP call;
 * auto-edits = confine + no network + no approvals; full-access = unconfined. Missing sandbox ->
 * LOUD banner. Missing approver -> DENY (fail-open once made an unattended daemon full-access).
 */

import type { Permissions } from "../../shared/types.ts";

export interface SandboxSpec {
  argv: string[]; // the wrapped command to exec
}

/** Build the sandbox-wrapped argv for a command under a permission policy (design §16). */
export function wrapSandbox(_cmd: string[], _cwd: string, _perms: Permissions): SandboxSpec {
  throw new Error("sandbox.wrapSandbox: not implemented (design §16)");
}
