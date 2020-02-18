#!/usr/bin/env bash

if [ -z "$MAC_CERTIFICATE" ]; then
  echo "MAC_CERTIFICATE not set. Ignoring."
else
  export CSC_LINK="$MAC_CERTIFICATE"
  echo "MAC_CERTIFICATE found."
fi

if [ -z "$MAC_CERTIFICATE_PASSWORD" ]; then
  echo "MAC_CERTIFICATE_PASSWORD not set. Ignoring."
else
  export CSC_KEY_PASSWORD="$MAC_CERTIFICATE_PASSWORD"
  echo "MAC_CERTIFICATE_PASSWORD found."
fi
