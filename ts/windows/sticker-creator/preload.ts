// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('getCredentials', async () =>
  ipcRenderer.invoke('get-art-creator-auth')
);

contextBridge.exposeInMainWorld(
  'installStickerPack',
  (packId: string, key: string) =>
    ipcRenderer.invoke('install-sticker-pack', packId, key)
);
