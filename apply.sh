#!/bin/bash
FULL_REDO=true #change to true to rebuild modules such as when libsignal updated
RESET_KEYS=true

if [ "$FULL_REDO" = true ]; then
    pnpm prune
    pnpm clear cache
    rm -rf node_modules
    pnpm install
fi

if [ "$RESET_KEYS" = true ]; then
    rm -rf ~/Library/Application\ Support/Signal-development
fi
pnpm run generate
#open -n ./release/mac-arm64/Signal.app
pnpm start