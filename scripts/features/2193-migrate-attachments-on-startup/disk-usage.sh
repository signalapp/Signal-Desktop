#!/bin/bash
ROOT=$1

if [[ "$1" == "" ]]; then
    echo "Usage: $(basename "$0") <signal-profile-path>"
    exit 1
fi

while true
do
    echo -n "$(date -u +"%Y-%m-%dT%H:%M:%SZ    ")"
    du -sm "$ROOT/attachments.noindex"

    echo -n "$(date -u +"%Y-%m-%dT%H:%M:%SZ    ")"
    du -sm "$ROOT/IndexedDB"

    sleep 1
done
