// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer, webUtils } from 'electron';

let onProgress: (() => void) | undefined;

ipcRenderer.on('art-creator:onUploadProgress', () => {
  onProgress?.();
});

contextBridge.exposeInMainWorld(
  'uploadStickerPack',
  async (
    manifest: Uint8Array,
    stickers: Readonly<Uint8Array>,
    newOnProgress: (() => void) | undefined
  ): Promise<string> => {
    onProgress = newOnProgress;

    return ipcRenderer.invoke('art-creator:uploadStickerPack', {
      manifest,
      stickers,
    });
  }
);

contextBridge.exposeInMainWorld(
  'installStickerPack',
  (packId: string, key: string) =>
    ipcRenderer.invoke('install-sticker-pack', packId, key)
);

contextBridge.exposeInMainWorld('getFilePath', (file: File) =>
  webUtils.getPathForFile(file)
);
