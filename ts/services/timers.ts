// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as getGuid } from 'uuid';

type TimeoutType = {
  timestamp: number;
  uuid: string;
};

const timeoutStore: Map<string, () => void> = new Map();
const allTimeouts: Set<TimeoutType> = new Set();

setInterval(() => {
  if (!allTimeouts.size) {
    return;
  }

  const now = Date.now();

  allTimeouts.forEach((timeout: TimeoutType) => {
    const { timestamp, uuid } = timeout;

    if (now >= timestamp) {
      if (timeoutStore.has(uuid)) {
        const callback = timeoutStore.get(uuid);
        if (callback) {
          callback();
        }
        timeoutStore.delete(uuid);
      }

      allTimeouts.delete(timeout);
    }
  });
}, 100);

export function onTimeout(
  timestamp: number,
  callback: () => void,
  id?: string
): string {
  if (id && timeoutStore.has(id)) {
    throw new ReferenceError(`onTimeout: ${id} already exists`);
  }

  let uuid = id || getGuid();
  while (timeoutStore.has(uuid)) {
    uuid = getGuid();
  }

  timeoutStore.set(uuid, callback);
  allTimeouts.add({
    timestamp,
    uuid,
  });

  return uuid;
}

export function removeTimeout(uuid: string): void {
  if (timeoutStore.has(uuid)) {
    timeoutStore.delete(uuid);
  }

  allTimeouts.forEach((timeout: TimeoutType) => {
    if (uuid === timeout.uuid) {
      allTimeouts.delete(timeout);
    }
  });
}
