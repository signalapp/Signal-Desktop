// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString, PniString } from '../../types/ServiceId';
import type { ConversationColorType } from '../../types/Colors';

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
