#!/bin/bash
# Copyright 2017 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

# First run on a machine - uncomment the two 'first run' sections below, comment out the 'later runs' section.
#
# Release:
#   NAME=signal-desktop(-beta) VERSION=X.X.X ./aptly.sh

set -e
set -u
set -o pipefail

echo
echo "aptly.sh: Releasing $NAME build version $VERSION"

REPO=signal-desktop
CURRENT=xenial
SNAPSHOT="signal-desktop_v$VERSION"
GPG_KEYID=57F6FB06
APTLY_SOURCE=${APTLY_SOURCE:-desktop/apt}

FIRST_RUN=false

if [ ! -d ~/.aptly/public ] ; then
  echo
  echo "aptly.sh: Detected first run, creating repo"
  aptly repo create signal-desktop
  FIRST_RUN=true
fi

echo
echo "aptly.sh: Adding newly-built deb to repo"
aptly repo add "$REPO" release/"$NAME"_"$VERSION"_*.deb

echo
echo "aptly.sh: Creating a snapshot from the current state of the repo"
aptly snapshot create "$SNAPSHOT" from repo "$REPO"

if [ "$FIRST_RUN" = true ] ; then
  # https://www.aptly.info/doc/aptly/publish/snapshot/
  echo
  echo "aptly.sh: (first run) Setting up local publish with current snapshot"
  aptly publish snapshot -gpg-key="$GPG_KEYID" -distribution="$CURRENT" "$SNAPSHOT"
else
  # https://www.aptly.info/doc/aptly/publish/switch/
  echo
  echo "aptly.sh: (later runs) Switching local publish to current snapshot"
  aptly publish switch -gpg-key="$GPG_KEYID" "$CURRENT" "$SNAPSHOT"
fi

echo
echo "aptly.sh: Syncing local publish to s3"
aws s3 sync ~/.aptly/public/pool/ "s3://updates.signal.org/$APTLY_SOURCE/pool/"
aws s3 sync ~/.aptly/public/dists/ "s3://updates.signal.org/$APTLY_SOURCE/dists/"

echo
echo "aptly.sh: Complete!"
