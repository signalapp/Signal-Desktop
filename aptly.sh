#!/bin/bash
# Setup - creates the local repo which will be mirrored up to S3:
#   aptly repo create signal-desktop
#
# First run on a machine: uncomment the first two 'aptly publish snapshot' commands,
#   comment the other two. Sets up the two publish channels, one local, one to S3.
#
# Testing: comment out the lines with s3:$ENDPOINT to publish only locally
#
# Release:
#   NAME=signal-desktop(-beta) VERSION=X.X.X ./aptly.sh

echo "Releasing $NAME build version $VERSION"

REPO=signal-desktop
DISTRO=xenial
ENDPOINT=signal-desktop-apt # Matches endpoint name in .aptly.conf
SNAPSHOT=signal-desktop_v$VERSION
GPG_KEYID=57F6FB06

aptly repo add $REPO release/$NAME\_$VERSION\_*.deb
aptly snapshot create $SNAPSHOT from repo $REPO

# run these two only on first release to a given repo from a given machine
#   https://www.aptly.info/doc/aptly/publish/snapshot/
# aptly publish snapshot -gpg-key=$GPG_KEYID $SNAPSHOT
# aptly publish snapshot -gpg-key=$GPG_KEYID -config=.aptly.conf $SNAPSHOT s3:$ENDPOINT:

# these update already-published repos, run every time after that
#   https://www.aptly.info/doc/aptly/publish/switch/
aptly publish switch -gpg-key=$GPG_KEYID $DISTRO $SNAPSHOT
aptly publish switch -gpg-key=$GPG_KEYID -config=.aptly.conf $DISTRO s3:$ENDPOINT: $SNAPSHOT
