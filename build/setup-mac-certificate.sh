#!/usr/bin/env bash

if [ -z "$MAC_CERTIFICATE" ]; then
  export CSC_LINK="$MAC_CERTIFICATE"
  echo "MAC_CERTIFICATE found."
else
  echo "MAC_CERTIFICATE not set. Ignoring."
fi

if [ -z "$MAC_CERTIFICATE_PASSWORD" ]; then
  export CSC_KEY_PASSWORD="$MAC_CERTIFICATE_PASSWORD"
  echo "MAC_CERTIFICATE_PASSWORD found."
else
  echo "MAC_CERTIFICATE_PASSWORD not set. Ignoring."
fi
