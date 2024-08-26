// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type ArtType } from '../constants';
import { type EncryptResult } from './crypto';

declare global {
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    uploadStickerPack(
      manifest: Uint8Array,
      stickers: ReadonlyArray<Uint8Array>,
      onProgres?: () => void
    ): Promise<string>;
    installStickerPack(packId: string, key: string): void;
    getFilePath(file: File): string;
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

export function getFilePath(file: File): string {
  return window.getFilePath(file);
}
