#!/usr/bin/env bash

set -e

if [[ "$TRAVIS_OS_NAME" == "linux" ]]; then
  export DISPLAY=:99.0
  sh -e /etc/init.d/xvfb start
  sleep 3
fi

grunt test

NODE_ENV=production grunt test-release:$TRAVIS_OS_NAME
