#!/bin/bash
# Setup:
#   aptly repo create signal-desktop
#
# Release:
#   aptly repo add signal-desktop path/to/signal-desktop_X.X.X_amd64.deb
#   VERSION=vX.X.X ./aptly.sh

REPO=signal-desktop
DISTRO=xenial
ENDPOINT=signal-desktop-apt # Matches endpoint name in .aptly.conf
DEB_PATH=pack
SNAPSHOT=signal-desktop_v$VERSION
GPG_KEYID=57F6FB06
aptly repo add $REPO $DEB_PATH/$REPO\_$VERSION\_*.deb

while true; do
    read -p "Create snapshot?" yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit;;
        * ) echo "Please answer yes or no.";
    esac
done
aptly snapshot create $SNAPSHOT from repo $REPO
while true; do
    read -p "Deploy snapshot?" yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit;;
        * ) echo "Please answer yes or no.";
    esac
done
aptly publish switch -gpg-key=$GPG_KEYID $DISTRO $SNAPSHOT
aptly publish switch -gpg-key=$GPG_KEYID -config=.aptly.conf $DISTRO s3:$ENDPOINT: $SNAPSHOT
