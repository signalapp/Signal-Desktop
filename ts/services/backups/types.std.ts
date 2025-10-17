// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString, PniString } from '../../types/ServiceId.std.js';
import type { ConversationColorType } from '../../types/Colors.std.js';

// Duplicated here to allow loading it in a non-node environment
export enum BackupLevel {
  Free = 200,
  Paid = 201,
}

export function backupLevelFromNumber(
  num: number | undefined
): BackupLevel | null {
  if (Object.values(BackupLevel).includes(num as BackupLevel)) {
    return num as BackupLevel;
  }
  return null;
}

export type AboutMe = {
  aci: AciString;
  pni?: PniString;
  e164?: string;
};

export enum BackupType {
  Ciphertext = 'Ciphertext',
  TestOnlyPlaintext = 'TestOnlyPlaintext',
}

export type LocalChatStyle = Readonly<{
  wallpaperPhotoPointer: Uint8Array | undefined;
  wallpaperPreset: number | undefined;
  color: ConversationColorType | undefined;
  customColorId: string | undefined;
  dimWallpaperInDarkMode: boolean | undefined;
  autoBubbleColor: boolean | undefined;
}>;
