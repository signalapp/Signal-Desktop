#!/bin/bash

# Copyright 2017-2021 Signal Messenger, LLC
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

# FIRST RUN 
# echo
# echo "aptly.sh: Setting up repo and mirror"
# aptly repo create signal-desktop
# aptly mirror create -ignore-signatures backfill-mirror https://updates.signal.org/desktop/apt xenial

echo
echo "aptly.sh: Fetching latest released files so we don't erase anything"
aptly mirror update -ignore-signatures backfill-mirror
aptly repo import backfill-mirror signal-desktop signal-desktop signal-desktop-beta

echo
echo "aptly.sh: Adding newly-built deb to repo"
aptly repo add "$REPO" release/"$NAME"_"$VERSION"_*.deb

echo
echo "aptly.sh: Creating a snapshot from the current state of the repo"
aptly snapshot create "$SNAPSHOT" from repo "$REPO"

# FIRST RUN - https://www.aptly.info/doc/aptly/publish/snapshot/
# echo
# echo "aptly.sh: Setting up local publish with current snapshot"
# aptly publish snapshot -gpg-key="$GPG_KEYID" -distribution="$CURRENT" "$SNAPSHOT"

# LATER RUNS - https://www.aptly.info/doc/aptly/publish/switch/
echo
echo "aptly.sh: Switching local publish to current snapshot"
aptly publish switch -gpg-key="$GPG_KEYID" "$CURRENT" "$SNAPSHOT"

echo
echo "aptly.sh: Syncing local publish to s3"
/usr/bin/aws s3 sync ~/.aptly/public/pool/ s3://updates.signal.org/desktop/apt/pool/
/usr/bin/aws s3 sync ~/.aptly/public/dists/ s3://updates.signal.org/desktop/apt/dists/

echo
echo "aptly.sh: Complete!"
