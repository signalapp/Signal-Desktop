#!/bin/bash
# this wont delete the data, so you wont need to rescan qr code
# if you have the debug flag in server.node.ts on, this should suffice to let you rerun x3dh
pnpm run generate
#open -n ./release/mac-arm64/Signal.app
pnpm start