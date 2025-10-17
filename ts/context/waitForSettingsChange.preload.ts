// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';

import { explodePromise } from '../util/explodePromise.std.js';

let preferencesChangeResolvers = new Array<() => void>();

ipc.on('preferences-changed', _event => {
  const resolvers = preferencesChangeResolvers;
  preferencesChangeResolvers = [];

  for (const resolve of resolvers) {
    resolve();
  }
});

export function waitForSettingsChange(): Promise<void> {
  const { promise, resolve } = explodePromise<void>();

  preferencesChangeResolvers.push(resolve);

  return promise;
}
