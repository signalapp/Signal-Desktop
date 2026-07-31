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
    manifest: Uint8Array<ArrayBuffer>,
    stickers: Readonly<Uint8Array<ArrayBuffer>>,
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

let onImportProgress: ((done: number, total: number) => void) | undefined;

ipcRenderer.on(
  'art-creator:onImportProgress',
  (_event, { done, total }: { done: number; total: number }) => {
    onImportProgress?.(done, total);
  }
);

contextBridge.exposeInMainWorld(
  'importStickerPack',
  async (
    link: string,
    newOnImportProgress: ((done: number, total: number) => void) | undefined
  ): Promise<unknown> => {
    onImportProgress = newOnImportProgress;

    try {
      return await ipcRenderer.invoke('art-creator:importStickerPack', {
        link,
      });
    } finally {
      onImportProgress = undefined;
    }
  }
);

contextBridge.exposeInMainWorld('getFilePath', (file: File) =>
  webUtils.getPathForFile(file)
);
