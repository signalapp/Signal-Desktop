#!/usr/bin/env bash

# do not set -x here because it will fail on non-debian  based distrib
# set -e

# Some distributions do not have unprivileged_userns_clone disabled.
# If that's the case, and we run an AppImage (deb is not impacted by this),
# the app won't start unless we start it with --no-sandbox.
# This bash script is the launcher script for AppImage only, and will at runtime check
# if we need to add the --no-sandbox before running the AppImage itself.

UNPRIVILEGED_USERNS_ENABLED=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/session-desktop-bin" "$([[ $UNPRIVILEGED_USERNS_ENABLED == 0 ]] && echo '--no-sandbox')" "$@"
