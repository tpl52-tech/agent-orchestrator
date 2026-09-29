/**
 * Ticket parsing & seed expansion (design §7.3, §12.2).
 *
 * Ticket extraction: 2-6 letters, hyphen, 1-6 digits, word-bounded, team key in the allowlist;
 * max 4 per call; branch checked first. GitHub-issue provider matches `<PREFIX>-<digits>`.
 * Bare-ticket detection gates seed expansion. Ticket URLs are built from the configured
 * workspace slug, NEVER defaulted.
 */

import type { Tool, TicketProvider } from "./types.ts";

/** Extract ticket ids from text, filtered to the allowed team keys. Max 4. */
export function extractTickets(
  _text: string,
  _teamKeys: string[],
  _provider: TicketProvider,
): string[] {
  throw new Error("ticket.extractTickets: not implemented (design §12.2)");
}

/** True iff the trimmed text is exactly one bare ticket id with a known team key. */
export function isBareTicket(_text: string, _teamKeys: string[]): boolean {
  throw new Error("ticket.isBareTicket: not implemented (design §7.1)");
}

/**
 * Expand a bare ticket into the per-tool workflow prompt (design §7.3): read the ticket via
 * the tool's own Linear MCP mechanics; blocked-check; implement + graded self-review to grade A
 * (<=3 cycles); open the PR and post a `THERMO GRADE: <A-F>` line; drive to green CI + approval.
 * The trailing "approved by ..." sentence is rewritten to match the profile's review policy.
 * TODO(step 3): implement per-tool templates.
 */
export function expandTicketSeed(_ticket: string, _tool: Tool): string {
  throw new Error("ticket.expandTicketSeed: not implemented (design §7.3)");
}

/** Build a ticket URL from the configured workspace slug (never defaulted). */
export function ticketUrl(_ticket: string, _workspaceSlug: string): string {
  throw new Error("ticket.ticketUrl: not implemented (design §12.2)");
}
