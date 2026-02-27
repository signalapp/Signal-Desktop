#!/usr/bin/env bash
# Copyright 2026 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

set -euo pipefail

if [[ -z "${MAS_PROVISIONING_PROFILE:-}" ]]; then
  echo "MAS_PROVISIONING_PROFILE is required" >&2
  exit 1
fi

# Electron Builder applies `mac` config first and then `masDev`.
# Override mac configuration during build to ensure consistency between
# the two sets of values, otherwise the mas-dev build will crash on launch.
SIGNAL_ENV="${SIGNAL_ENV:-production}" \
SKIP_SIGNING_SCRIPT=1 \
pnpm run build:electron \
  --config.directories.output=release \
  --mac mas-dev \
  --arm64 \
  --publish=never \
  --config.mac.entitlements=./build/entitlements.mas-dev.plist \
  --config.mac.entitlementsInherit=./build/entitlements.mas-dev.inherit.plist \
  --config.mac.preAutoEntitlements=false \
  --config.masDev.provisioningProfile="$MAS_PROVISIONING_PROFILE"
