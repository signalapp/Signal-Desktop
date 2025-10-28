// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import bindings from 'bindings';

let addon;
const subscribers = new Set();

function onIsMutedChange() {
  const newValue = isMuted();
  for (const fn of subscribers) {
    fn(newValue);
  }
}

function getAddon() {
  if (addon === undefined) {
    try {
      addon = bindings('mute-state-change');
      addon.onIsMutedChange(onIsMutedChange);
    } catch {
      // Windows, Linux, older macOS
      addon = {
        getIsMuted: () => undefined,
        setIsMuted: () => undefined,
      };
    }
  }

  return addon;
}

export function isMuted() {
  return getAddon().getIsMuted();
}

export function setIsMuted(newValue) {
  getAddon().setIsMuted(!!newValue);
}

export function subscribe(callback) {
  subscribers.add(callback);
}

export function unsubscribe(callback) {
  subscribers.delete(callback);
}
