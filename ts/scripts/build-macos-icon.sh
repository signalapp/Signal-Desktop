#!/bin/bash
# Copyright 2024 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

# This script generates the macOS icon with dark mode support
# It must be run on macOS as it requires the iconutil command

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ICONSET_DIR="$ROOT_DIR/build/icons/mac/icon.iconset"
ICNS_FILE="$ROOT_DIR/build/icons/mac/icon.icns"

echo "Building macOS icon with dark mode support..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "Warning: This script must be run on macOS to generate the .icns file"
  echo "The iconset has been generated and can be converted on macOS using:"
  echo "  iconutil -c icns build/icons/mac/icon.iconset -o build/icons/mac/icon.icns"
  exit 0
fi

# Check if iconutil is available
if ! command -v iconutil &> /dev/null; then
  echo "Error: iconutil command not found"
  echo "iconutil is required to generate .icns files on macOS"
  exit 1
fi

# Check if iconset directory exists
if [ ! -d "$ICONSET_DIR" ]; then
  echo "Error: Iconset directory not found: $ICONSET_DIR"
  echo "Please run: node ts/scripts/generate-dark-mode-icons.node.js"
  exit 1
fi

# Backup existing icon if it exists
if [ -f "$ICNS_FILE" ]; then
  echo "Backing up existing icon to icon.icns.backup"
  cp "$ICNS_FILE" "$ICNS_FILE.backup"
fi

# Generate the .icns file
echo "Generating icon.icns from iconset..."
iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"

if [ $? -eq 0 ]; then
  echo "✓ Successfully generated icon.icns with dark mode support!"
  echo "  Location: $ICNS_FILE"
  
  # Show file size
  SIZE=$(du -h "$ICNS_FILE" | cut -f1)
  echo "  Size: $SIZE"
else
  echo "✗ Failed to generate icon.icns"
  exit 1
fi
