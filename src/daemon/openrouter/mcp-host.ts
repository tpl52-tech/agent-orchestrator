/**
 * OpenRouter runtime MCP host (design §16).
 *
 * A minimal stdio JSON-RPC client: initialize -> initialized -> tools/list; tools/call; 20s startup,
 * 60s call timeouts; unimplemented methods answered with -32601 rather than dropped; stderr drained.
 * Servers from ~/.claude.json (allowlist: `linear`), the same file the CLIs use, so mcp-remote holds
 * the OAuth tokens. A CURATED 10 of Linear's 58 tools (~2.7K tokens vs ~18K), names <server>_<tool>,
 * writes gated by verb (get_/list_/search_ are reads). AO_MCP_ALL_TOOLS=1 sends everything.
 */

export const MCP_STARTUP_TIMEOUT_MS = 20_000;
export const MCP_CALL_TIMEOUT_MS = 60_000;

export interface McpTool {
  name: string; // <server>_<tool>
  isRead: boolean; // verb-gated: get_/list_/search_
  schema: unknown;
}

export interface McpHost {
  listTools(): Promise<McpTool[]>;
  call(name: string, args: unknown): Promise<unknown>;
  stop(): void;
}

/** TODO(step 10): implement the stdio JSON-RPC client + curated tool set. */
export function startMcpHost(): Promise<McpHost> {
  throw new Error("mcp-host.startMcpHost: not implemented (design §16)");
}
