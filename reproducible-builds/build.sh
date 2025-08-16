#!/bin/sh
# Copyright 2024 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

# Usage:
# ./build.sh [ dev (default) | public (prod and beta builds) | alpha | test | staging ] [ Build timestamp override. Defaults to latest git commit or 1. ]

# First we prepare the docker container in which our build scripts will run. This container includes
# all build dependencies at specific versions.
# We set SOURCE_DATE_EPOCH to make system build timestamps deterministic.
docker build -t signal-desktop --build-arg SOURCE_DATE_EPOCH=1 --build-arg NODE_VERSION=$(cat ../.nvmrc) .

# Before performing the actual build, go to the project root.
cd ..

# Prepare the timestamp of the actual build based on the latest git commit.
source_date_epoch=1
if [ "$2" != "" ]; then
  echo "Using override timestamp for SOURCE_DATE_EPOCH."
  source_date_epoch=$(($2))
else
  git_timestamp=$(git log -1 --pretty=%ct)
  if [ "${git_timestamp}" != "" ]; then
    echo "At commit: $(git log -1 --oneline)"
    echo "Setting SOURCE_DATE_EPOCH to latest commit's timestamp."
    source_date_epoch=$((git_timestamp))
  else
    echo "Can't get latest commit timestamp. Defaulting to 1."
    source_date_epoch=1
  fi
fi

# Perform the build by mounting the project into the container and passing in the 1st command line
# arg to select the build type (e.g. "public"). The container runs docker-entrypoint.sh.
# After the process is finished, the resulting package is located in the ./release/ directory.
# npm cache set to tmp to fix permissions issues.
docker run --rm \
  -v "$(pwd)":/project \
  -w /project \
  --user "$(id -u):$(id -g)" \
  -e NPM_CONFIG_CACHE=/tmp/.npm-cache \
  -e PNPM_HOME=/tmp/.pnpm-home \
  -e SOURCE_DATE_EPOCH=$source_date_epoch \
  signal-desktop $1
