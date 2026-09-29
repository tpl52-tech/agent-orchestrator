#!/bin/sh
# Box report (box -> Mac) (design §17.4). One-shot, READ-ONLY. Pulled by the Mac every 15s.
#
# Must print JSON:
#   { "observedAt": <epoch-ms>,
#     "autonomy": { "enabled", "dryRun", "actions", "killed", "window", "restartPending", "daemonAlive" },
#     "counts": { ... },
#     "actions": [ up to 40 joined audit rows ] }
#
# daemonAlive comes from systemd (file/DB state looks healthy even when the process is stopped);
# restartPending when the env file is newer than the loaded-at marker. Read the box store via a
# one-shot read-only sqlite process (design invariant: exactly one writer per file).
set -eu

echo '{ "error": "report.sh: not implemented (scaffold) — see design §17.4" }'
exit 0
