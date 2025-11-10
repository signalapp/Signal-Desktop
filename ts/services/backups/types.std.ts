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

export type BackupExportOptions =
  | { type: 'remote' | 'cross-client-integration-test'; level: BackupLevel }
  | {
      type: 'local-encrypted';
      localBackupSnapshotDir: string;
    };
export type BackupImportOptions = (
  | { type: 'remote' | 'cross-client-integration-test' }
  | {
      type: 'local-encrypted';
      localBackupSnapshotDir: string;
    }
) & {
  ephemeralKey?: Uint8Array;
  onProgress?: (currentBytes: number, totalBytes: number) => void;
};

export type LocalChatStyle = Readonly<{
  wallpaperPhotoPointer: Uint8Array | undefined;
  wallpaperPreset: number | undefined;
  color: ConversationColorType | undefined;
  customColorId: string | undefined;
  dimWallpaperInDarkMode: boolean | undefined;
  autoBubbleColor: boolean | undefined;
}>;

export type StatsType = {
  adHocCalls: number;
  callLinks: number;
  conversations: number;
  chatFolders: number;
  chats: number;
  distributionLists: number;
  messages: number;
  notificationProfiles: number;
  skippedMessages: number;
  stickerPacks: number;
  fixedDirectMessages: number;
};

export type ExportResultType = Readonly<{
  totalBytes: number;
  duration: number;
  stats: Readonly<StatsType>;
}>;

export type LocalBackupExportResultType = ExportResultType & {
  snapshotDir: string;
};
