#!/bin/bash
# Setup:
#   aptly repo create signal-desktop
#
# Release:
#   VERSION=X.X.X ./aptly.sh

REPO=signal-desktop
DISTRO=xenial
ENDPOINT=signal-desktop-apt # Matches endpoint name in .aptly.conf
DEB_PATH=release
SNAPSHOT=signal-desktop_v$VERSION
GPG_KEYID=57F6FB06
aptly repo add $REPO $DEB_PATH/$REPO\_$VERSION\_*.deb

aptly snapshot create $SNAPSHOT from repo $REPO
aptly publish switch -gpg-key=$GPG_KEYID $DISTRO $SNAPSHOT
aptly publish switch -gpg-key=$GPG_KEYID -config=.aptly.conf $DISTRO s3:$ENDPOINT: $SNAPSHOT
