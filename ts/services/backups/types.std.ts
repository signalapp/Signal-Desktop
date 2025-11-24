// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString, PniString } from '../../types/ServiceId.std.js';
import type { ConversationColorType } from '../../types/Colors.std.js';
import type {
  CoreAttachmentBackupJobType,
  CoreAttachmentLocalBackupJobType,
} from '../../types/AttachmentBackup.std.js';

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

export type OnProgressCallback = (
  currentBytes: number,
  totalBytes: number
) => void;

export type BackupExportOptions =
  | {
      type: 'remote' | 'cross-client-integration-test';
      level: BackupLevel;
    }
  | {
      type: 'plaintext-export';
    }
  | {
      type: 'local-encrypted';
      snapshotDir: string;
    };

export type BackupImportOptions = (
  | { type: 'remote' | 'cross-client-integration-test' }
  | {
      type: 'local-encrypted';
      localBackupSnapshotDir: string;
    }
) & {
  ephemeralKey?: Uint8Array;
  onProgress?: OnProgressCallback;
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
  attachmentBackupJobs: ReadonlyArray<
    CoreAttachmentBackupJobType | CoreAttachmentLocalBackupJobType
  >;
  totalBytes: number;
  duration: number;
  stats: Readonly<StatsType>;
}>;

export type LocalBackupExportResultType = ExportResultType & {
  snapshotDir: string;
};
