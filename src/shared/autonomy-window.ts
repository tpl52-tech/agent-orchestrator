/**
 * Autonomy window, kill switch, extension (design §13.7).
 *
 * Acting is confined to 09:00-21:00 Mon-Fri in the configured zone (monitoring runs around the
 * clock; the gate lives in the ACTUATOR, not the monitor). Timezone conversion via
 * Intl.DateTimeFormat with hourCycle "h23" (hour12:false can render midnight as 24, holding the
 * window open overnight). The devbox is UTC and the laptop Eastern.
 *
 * Kill switch: an AUTONOMY_OFF file (a file, not a daemon call, because it must work when the
 * daemon is wedged). Extension: an AUTONOMY_UNTIL file with an epoch-ms deadline, capped at 12h,
 * read live; past timestamps self-heal, garbage never opens.
 */

export interface WindowConfig {
  timeZone: string;
  startHour: number;
  endHour: number;
}

export const AUTONOMY_EXTENSION_CAP_MS = 12 * 60 * 60 * 1000;

/** True iff `now` falls inside the acting window in the configured zone (design §13.7). */
export function withinWindow(_now: number, _cfg: WindowConfig): boolean {
  throw new Error("autonomy-window.withinWindow: not implemented (design §13.7)");
}

/** Parse an AUTONOMY_UNTIL deadline; reject garbage and past timestamps (returns null). */
export function parseExtensionDeadline(_raw: string, _now: number): number | null {
  throw new Error("autonomy-window.parseExtensionDeadline: not implemented (design §13.7)");
}

export type WindowLabel = "9-9" | "off-hours" | "weekend" | "off" | string; // e.g. "+2h00m"

/** Produce the header window label the TUI renders (design §19). */
export function windowLabel(_now: number, _cfg: WindowConfig, _extensionUntil: number | null): WindowLabel {
  throw new Error("autonomy-window.windowLabel: not implemented (design §13.7, §19)");
}
