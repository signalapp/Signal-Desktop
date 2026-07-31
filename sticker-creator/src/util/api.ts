// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import b64 from 'base64-js';

import { type ArtType } from '../constants';
import { type EncryptResult } from './crypto';
import type { ArtImageData } from '../types.d';
import type { InitializePackPayload } from '../slices/art';

declare global {
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    uploadStickerPack(
      manifest: Uint8Array<ArrayBuffer>,
      stickers: ReadonlyArray<Uint8Array<ArrayBuffer>>,
      onProgres?: () => void
    ): Promise<string>;
    installStickerPack(packId: string, key: string): void;
    getFilePath(file: File): string;
    importStickerPack(
      link: string,
      onProgress?: (done: number, total: number) => void
    ): Promise<
      | { contents: StickerPackContents }
      | { error: 'invalidLink' | 'importFailed' }
      | undefined
    >;
  }
}

export type UploadOptions = Readonly<{
  artType: ArtType;
  onProgress?: () => void;
}>;

export class APIError extends Error {
  constructor(message: string, public readonly errorMessageI18nKey: string) {
    super(message);
  }
}

export type UploadResult = Readonly<{
  key: string;
  packId: string;
}>;

export async function upload(
  encryptResult: EncryptResult,
  { onProgress }: UploadOptions
): Promise<UploadResult> {
  const { encryptedManifest, encryptedImages, key } = encryptResult;

  const packId = await window.uploadStickerPack(
    encryptedManifest,
    encryptedImages,
    onProgress
  );

  window.installStickerPack(packId, key);

  return {
    key,
    packId,
  };
}

export type ImportedSticker = Readonly<{
  id: number;
  emoji?: string;
  data: Uint8Array<ArrayBuffer>;
  contentType: string;
}>;

export type StickerPackContents = Readonly<{
  title: string;
  author: string;
  coverStickerId?: number;
  coverImage?: ImportedSticker;
  stickers: ReadonlyArray<ImportedSticker>;
}>;

export async function importPack(
  link: string,
  onProgress?: (done: number, total: number) => void
): Promise<StickerPackContents> {
  const result = await window.importStickerPack(link, onProgress);
  if (result && 'contents' in result) {
    return result.contents;
  }

  const key =
    result?.error === 'invalidLink'
      ? 'StickerCreator--Toasts--invalidPackLink'
      : 'StickerCreator--Toasts--errorImporting';
  throw new APIError(`importPack: ${result?.error ?? 'no result'}`, key);
}

function toImageData({ id, data, contentType }: ImportedSticker): ArtImageData {
  return {
    buffer: data,
    contentType,
    src: `data:${contentType};base64,${b64.fromByteArray(data)}`,
    path: `imported:${id}`,
  };
}

export function toInitializePackPayload(
  contents: StickerPackContents
): InitializePackPayload {
  const stickers = contents.stickers.map(sticker => {
    const imageData = toImageData(sticker);
    return {
      path: imageData.path,
      emoji: sticker.emoji
        ? { emoji: sticker.emoji, name: '', sheetX: -1, sheetY: -1 }
        : undefined,
      imageData,
    };
  });

  const coverIndex = contents.stickers.findIndex(
    ({ id }) => id === contents.coverStickerId
  );

  return {
    title: contents.title,
    author: contents.author,
    cover: contents.coverImage
      ? toImageData(contents.coverImage)
      : stickers[coverIndex]?.imageData,
    stickers,
  };
}

export function getFilePath(file: File): string {
  return window.getFilePath(file);
}
