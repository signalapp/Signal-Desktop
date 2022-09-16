#!/bin/sh
# Copyright 2022 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

if [ -f ./node_modules/.bin/danger ]; then
  echo "Running with ./node_modules/.bin/danger"
  ./node_modules/.bin/danger $@
elif [ -f ./danger/node_modules/.bin/danger ]; then
  echo "Running with ./danger/node_modules/.bin/danger"
  ./danger/node_modules/.bin/danger $@
else
  echo "Danger not found, did you run yarn in either the root or danger/ dir?"
  exit 1
fi
