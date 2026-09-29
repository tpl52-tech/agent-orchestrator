#!/bin/sh
# Slack narrator (design §15.1). Deployed to ~/agent-orchestrator-alerts/ (on the box when a devbox
# is configured, else locally). Invoked by the alert dispatcher.
#
# Must: pipe a rendered persona prompt + the alert JSON into `claude -p ... --max-turns 1`, extract
# the FIRST JSON object from the output, and post to Slack via conversations.open + chat.postMessage
# with a bot token from ~/.agent-orchestrator-alerts.env to the configured member id.
#
#   - NO default recipient (a default once DM'd someone else).
#   - Verdict shape: { "dm": "...", "delivered": [...], "suppressed": [...] }; ids the LLM forgot are
#     treated as suppressed.
#   - The persona GROUPS/PHRASES/catches duplicates; it does NOT judge whether alerts are real.
#     Terse, lead with ticket/PR, say what changed, no emoji.
#
# TODO (design §15.1): implement. Requires SLACK_BOT_TOKEN + AO_ALERT_SLACK_ID in the env file.
set -eu

echo "narrate.sh: not implemented (scaffold) — see design §15.1" >&2
exit 1
