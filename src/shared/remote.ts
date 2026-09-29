/**
 * Remote command builders (design §9.1, §9.4).
 *
 * Local PTY runs:
 *   ssh -tt -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 <dest> "<cmd>"
 *
 * Remote command: export TERM=xterm-256color, LANG/LC_ALL UTF-8, prepend
 * $HOME/.local/bin:$HOME/.bun/bin to PATH (BatchMode shells source no rc files); cd '<cwd>';
 * exec tmux -u new-session -A -D -s 'ao-<id8>' '<agent cmd>' + session options (status off,
 * allow-passthrough on, window-size latest, history-limit 100000, aggressive-resize off,
 * automatic-rename off). The agent is wrapped `env -u TMUX TERM=xterm-256color ...` so it does
 * not detect tmux and downgrade its render. Everything is POSIX single-quoted.
 *
 * Subprocess hygiene (§9.4): every subprocess has a 45s hard deadline with SIGKILL and reader
 * cancellation in `finally`. ssh: BatchMode, ConnectTimeout=10, ServerAliveInterval=10,
 * ServerAliveCountMax=3. Exit code null on timeout; 255 distinguishes ssh's own failure from
 * the remote command's.
 */

export const SUBPROCESS_DEADLINE_MS = 45_000;

/** POSIX single-quote a token for embedding in a remote shell string. */
export function shellQuote(_token: string): string {
  throw new Error("remote.shellQuote: not implemented (design §9.1)");
}

export interface RemoteSpawnArgs {
  dest: string; // ssh destination
  cwd: string;
  tmuxSession: string; // ao-<id8>
  agentCmd: string[]; // the CLI argv to run inside tmux
}

/** Build the full `ssh ... "tmux new-session ..."` argv for a remote spawn (design §9.1). */
export function buildRemoteSpawn(_args: RemoteSpawnArgs): string[] {
  throw new Error("remote.buildRemoteSpawn: not implemented (design §9.1)");
}

/** Derive a remote home from the ssh user: /root for root, else /home/<user> (default ubuntu). */
export function remoteHome(_sshUser: string): string {
  throw new Error("remote.remoteHome: not implemented (design §7.2)");
}

/**
 * Tri-state liveness classification of a `tmux has-session` over ssh (design §9.2):
 * exit 0 -> alive; 255 -> ssh failed = "no answer", NEVER dead; other non-zero -> error.
 */
export type Liveness = "alive" | "no-answer" | "error";
export function classifyLiveness(_exitCode: number | null): Liveness {
  throw new Error("remote.classifyLiveness: not implemented (design §9.2)");
}
