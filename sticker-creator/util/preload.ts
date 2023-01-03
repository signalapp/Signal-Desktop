// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ProcessStickerImageErrorType,
  StickerImageData,
} from '../window/phase3-sticker-functions';

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    processStickerImage: ProcessStickerImageFn;
    encryptAndUpload: EncryptAndUploadFn;
    ProcessStickerImageError: ProcessStickerImageErrorType;
  }
}

export { StickerImageData };

type ProcessStickerImageFn = (
  path: string | undefined
) => Promise<StickerImageData>;

export type StickerData = { imageData?: StickerImageData; emoji?: string };
export type PackMetaData = { packId: string; key: string };

export type EncryptAndUploadFn = (
  manifest: { title: string; author: string },
  stickers: Array<StickerData>,
  cover: StickerImageData,
  onProgress?: () => unknown
) => Promise<PackMetaData>;

export const { encryptAndUpload, processStickerImage } = window;
