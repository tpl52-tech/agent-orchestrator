/**
 * Alert dispatcher + Slack narrator (design §15.1).
 *
 * Detection is deterministic (the policy rules); the dedupe key encodes the transition; alerts are
 * kept forever. Dispatcher (opt-in AO_ALERTS=1; dry-run flag; NOT inherited by deploys): tick 60s,
 * debounce 30s from the newest pending alert (changes arrive in clusters), batch 20, mark notified
 * and increment attempts BEFORE invoking the narrator (a crash must not replay into a duplicate
 * burst), release on failure until attempts reach 5.
 *
 * The narrator is a shell script (deploy/alerts/narrate.sh) that pipes a rendered prompt + the alert
 * JSON into `claude -p ... --max-turns 1`, extracts the first JSON object, and posts to Slack via
 * conversations.open + chat.postMessage with a bot token to the configured member id (NO default
 * recipient — a default once DM'd someone else). Each alert payload includes what autonomy already
 * tried for that PR so the DM can say "nudged twice, still red". The persona groups/phrases/catches
 * duplicates — it does NOT judge whether alerts are real.
 */

export const ALERT_MAX_ATTEMPTS = 5;

export interface AlertDispatcher {
  stop(): void;
}

/** TODO(step 8): implement the debounce/batch/attempt loop + narrator invocation. */
export function startAlertDispatcher(): AlertDispatcher {
  throw new Error("alerts.startAlertDispatcher: not implemented (design §15.1)");
}
