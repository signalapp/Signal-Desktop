// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import type { LinkPreviewForUIType } from './message/LinkPreviews.std.js';
import type { MIMEType } from './MIME.std.js';
import type {
  WithOptionalProperties,
  WithRequiredProperties,
} from './Util.std.js';
import type { SignalService as Proto } from '../protobuf/index.std.js';

export type ThumbnailType = EphemeralAttachmentFields & {
  size: number;
  contentType: MIMEType;
  path?: string;
  plaintextHash?: string;
  width?: number;
  height?: number;
  version?: 1 | 2;
  localKey?: string; // AES + MAC
};

export type ScreenshotType = WithOptionalProperties<ThumbnailType, 'size'>;
export type BackupThumbnailType = WithOptionalProperties<ThumbnailType, 'size'>;

// These fields do not get saved to the DB.
export type EphemeralAttachmentFields = {
  totalDownloaded?: number;
  data?: Uint8Array;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage?: boolean;
  /** For messages not already on disk, this will be a data url */
  url?: string;
  incrementalUrl?: string;
  screenshotData?: Uint8Array;
  /** @deprecated Legacy field */
  screenshotPath?: string;

  /** @deprecated Legacy field. Used only for downloading old attachment */
  id?: number;
  /** @deprecated Legacy field, used long ago for migrating attachments to disk. */
  schemaVersion?: number;
  /** @deprecated Legacy field, replaced by cdnKey */
  cdnId?: string;
  /** @deprecated Legacy fields, no longer needed */
  iv?: never;
  isReencryptableToSameDigest?: never;
  reencryptionInfo?: never;
};

/**
 * Adding a field to AttachmentType requires:
 * 1) adding a column to message_attachments
 * 2) updating MessageAttachmentDBReferenceType and MESSAGE_ATTACHMENT_COLUMNS
 * 3) saving data to the proper column
 */
export type AttachmentType = EphemeralAttachmentFields & {
  error?: boolean;
  blurHash?: string;
  caption?: string;
  clientUuid?: string;
  contentType: MIMEType;
  digest?: string;
  fileName?: string;
  plaintextHash?: string;
  uploadTimestamp?: number;
  size: number;
  duration?: number;
  pending?: boolean;
  width?: number;
  height?: number;
  path?: string;
  screenshot?: ScreenshotType;
  flags?: number;
  thumbnail?: ThumbnailType;
  isCorrupted?: boolean;
  cdnNumber?: number;
  cdnKey?: string;
  downloadPath?: string;
  key?: string;

  textAttachment?: TextAttachmentType;
  wasTooBig?: boolean;

  // If `true` backfill is unavailable
  backfillError?: boolean;

  incrementalMac?: string;
  chunkSize?: number;
  backupCdnNumber?: number;
  localBackupPath?: string;

  // See app/attachment_channel.ts
  version?: 1 | 2;
  localKey?: string; // AES + MAC
  thumbnailFromBackup?: BackupThumbnailType;

  /** For quote attachments, if copied from the referenced attachment */
  copied?: boolean;
};

export type LocalAttachmentV2Type = Readonly<{
  version: 2;
  path: string;
  localKey: string;
  plaintextHash: string;
  size: number;
}>;

export type AddressableAttachmentType = Readonly<{
  version?: 1 | 2;
  path: string;
  localKey?: string;
  size?: number;
  contentType: MIMEType;

  // In-memory data, for outgoing attachments that are not saved to disk.
  data?: Uint8Array;
}>;

export type AttachmentForUIType = AttachmentType & {
  isPermanentlyUndownloadable: boolean;
  thumbnailFromBackup?: {
    url?: string;
  };
};

export type UploadedAttachmentType = Proto.IAttachmentPointer &
  Readonly<{
    // Required fields
    cdnKey: string;
    key: Uint8Array;
    size: number;
    digest: Uint8Array;
    contentType: string;
    plaintextHash: string;
  }>;

export type AttachmentWithHydratedData = AttachmentType & {
  data: Uint8Array;
};

export enum TextAttachmentStyleType {
  DEFAULT = 0,
  REGULAR = 1,
  BOLD = 2,
  SERIF = 3,
  SCRIPT = 4,
  CONDENSED = 5,
}

export type TextAttachmentType = {
  text?: string | null;
  textStyle?: number | null;
  textForegroundColor?: number | null;
  textBackgroundColor?: number | null;
  preview?: LinkPreviewForUIType;
  gradient?: {
    startColor?: number | null;
    endColor?: number | null;
    angle?: number | null;
    colors?: ReadonlyArray<number> | null;
    positions?: ReadonlyArray<number> | null;
  } | null;
  color?: number | null;
};

export type BaseAttachmentDraftType = {
  blurHash?: string;
  contentType: MIMEType;
  screenshotContentType?: MIMEType;
  size: number;
  flags?: number;
};

// An ephemeral attachment type, used between user's request to add the attachment as
//   a draft and final save on disk and in conversation.draftAttachments.
export type InMemoryAttachmentDraftType =
  | ({
      data: Uint8Array;
      clientUuid: string;
      pending: false;
      screenshotData?: Uint8Array;
      duration?: number;
      fileName?: string;
      path?: string;
    } & BaseAttachmentDraftType)
  | {
      contentType: MIMEType;
      clientUuid: string;
      fileName?: string;
      path?: string;
      pending: true;
      size: number;
      duration?: number;
    };

// What's stored in conversation.draftAttachments
export type AttachmentDraftType =
  | ({
      url?: string;
      screenshot?: ScreenshotType;
      // Legacy field
      screenshotPath?: string;
      pending: false;
      // Old draft attachments may have a caption, though they are no longer editable
      //   because we removed the caption editor.
      caption?: string;
      fileName?: string;
      path: string;
      width?: number;
      height?: number;
      clientUuid: string;
      version?: 2;
      localKey?: string;
    } & BaseAttachmentDraftType)
  | {
      clientUuid: string;
      contentType: MIMEType;
      fileName?: string;
      path?: string;
      pending: true;
      size: number;
    };

export enum AttachmentVariant {
  Default = 'Default',
  ThumbnailFromBackup = 'thumbnailFromBackup',
}

export type BackupableAttachmentType = WithRequiredProperties<
  AttachmentType,
  'plaintextHash' | 'key'
>;

export type AttachmentDownloadableFromTransitTier = WithRequiredProperties<
  AttachmentType,
  'key' | 'digest' | 'cdnKey' | 'cdnNumber'
>;

export type LocallySavedAttachment = WithRequiredProperties<
  AttachmentType,
  'path'
>;

// Used for display

export class AttachmentSizeError extends Error {}

// Used for downlaods

export class AttachmentPermanentlyUndownloadableError extends Error {
  constructor(message: string) {
    super(`AttachmentPermanentlyUndownloadableError: ${message}`);
  }
}
