#!/bin/bash
# this wont delete the data, so you wont need to rescan qr code
# if you have the debug flag in server.node.ts on, this should suffice to let you rerun x3dh


FULL_REDO=false #change to true to rebuild modules such as when libsignal updated

if [ "$FULL_REDO" = true ]; then
    pnpm prune
    pnpm clear cache
    rm -rf node_modules
    pnpm install
fi

pnpm run generate
#open -n ./release/mac-arm64/Signal.app
pnpm start