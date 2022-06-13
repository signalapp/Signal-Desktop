// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'sharp';

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    processStickerImage: ProcessStickerImageFn;
    encryptAndUpload: EncryptAndUploadFn;
  }
}

export type StickerImageData = {
  buffer: Buffer;
  src: string;
  path: string;
  meta: Metadata;
};

type ProcessStickerImageFn = (
  path: string | undefined
) => Promise<StickerImageData>;

export type StickerData = { imageData?: StickerImageData; emoji?: string };
export type PackMetaData = { packId: string; key: string };

export type EncryptAndUploadFn = (
  manifest: { title: string; author: string },
  stickers: Array<StickerData>,
  cover: StickerImageData | undefined,
  onProgress?: () => unknown
) => Promise<PackMetaData>;

export const { encryptAndUpload, processStickerImage } = window;
