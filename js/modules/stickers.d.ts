// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function maybeDeletePack(packId: string): Promise<void>;

export function downloadStickerPack(
  packId: string,
  packKey: string,
  options?: {
    finalStatus?: 'installed' | 'downloaded';
    messageId?: string;
    fromSync?: boolean;
  }
): Promise<void>;

export function isPackIdValid(packId: unknown): packId is string;

export function redactPackId(packId: string): string;
