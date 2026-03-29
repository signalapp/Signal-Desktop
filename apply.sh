#!/bin/bash
FULL_REDO=false #change to true to rebuild modules such as when libsignal updated

if [ "$FULL_REDO" = true ]; then
    pnpm prune
    pnpm clear cache
    rm -rf node_modules
    pnpm install
fi
rm -rf ~/Library/Application\ Support/Signal-development
pnpm run generate
#open -n ./release/mac-arm64/Signal.app
pnpm start