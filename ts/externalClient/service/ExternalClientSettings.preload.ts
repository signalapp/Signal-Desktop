// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';

import { itemStorage } from '../../textsecure/Storage.preload.ts';
import type { ExternalClientAppType } from '../rendererChannel.std.ts';
import {
  LIST_APPS_CHANNEL,
  REFRESH_CHANNEL,
  REMOVE_APP_CHANNEL,
} from '../rendererChannel.std.ts';

// What the settings page needs. Main owns the grants and the server; the
// renderer only stores the on/off item and asks main to act on it.

export async function setExternalClientsEnabled(value: boolean): Promise<void> {
  // Main reads the item from the database, so it must be written first.
  await itemStorage.put('externalClientsEnabled', value);
  ipc.send(REFRESH_CHANNEL);
}

export async function listExternalClientApps(): Promise<
  ReadonlyArray<ExternalClientAppType>
> {
  return ipc.invoke(LIST_APPS_CHANNEL);
}

export async function removeExternalClientApp(id: string): Promise<void> {
  await ipc.invoke(REMOVE_APP_CHANNEL, id);
}
