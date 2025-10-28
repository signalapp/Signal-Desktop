// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { convertUndefinedToNull } from '../../util/dropNull.std.js';
import { messageAttachmentTypeSchema } from '../../types/AttachmentDownload.std.js';
import { APPLICATION_OCTET_STREAM } from '../../types/MIME.std.js';
import type { MessageAttachmentDBType } from '../Interface.std.js';

const permissiveStringOrNull = z
  .string()
  .optional()
  .transform(convertUndefinedToNull)
  .catch(null);
const permissiveNumberOrNull = z
  .number()
  .optional()
  .transform(convertUndefinedToNull)
  .catch(null);
const permissiveAttachmentVersion = z
  .union([z.literal(1), z.literal(2)])
  .optional()
  .transform(convertUndefinedToNull)
  .catch(null);
const permissiveOptionalBool = z
  .union([z.literal(0), z.literal(1)])
  .optional()
  .transform(convertUndefinedToNull)
  .catch(null);

// A schema which converts invalid values to null, to handle bad data when
// attachments were stored in JSON
export const permissiveMessageAttachmentSchema = z.object({
  // Fields required to be NOT NULL
  messageId: z.string(),
  messageType: z.string(),
  editHistoryIndex: z.number(),
  attachmentType: messageAttachmentTypeSchema,
  orderInMessage: z.number(),
  conversationId: z.string(),
  sentAt: z.number().catch(0),
  receivedAt: z.number().catch(0),
  size: z.number().catch(0),
  contentType: z.string().catch(APPLICATION_OCTET_STREAM),

  // Fields allowing NULL
  receivedAtMs: permissiveNumberOrNull,
  duration: permissiveNumberOrNull,
  path: permissiveStringOrNull,
  clientUuid: permissiveStringOrNull,
  localKey: permissiveStringOrNull,
  plaintextHash: permissiveStringOrNull,
  caption: permissiveStringOrNull,
  blurHash: permissiveStringOrNull,
  height: permissiveNumberOrNull,
  width: permissiveNumberOrNull,
  digest: permissiveStringOrNull,
  key: permissiveStringOrNull,
  fileName: permissiveStringOrNull,
  downloadPath: permissiveStringOrNull,
  transitCdnKey: permissiveStringOrNull,
  transitCdnNumber: permissiveNumberOrNull,
  transitCdnUploadTimestamp: permissiveNumberOrNull,
  backupCdnNumber: permissiveNumberOrNull,
  incrementalMac: permissiveStringOrNull,
  incrementalMacChunkSize: permissiveNumberOrNull,
  thumbnailPath: permissiveStringOrNull,
  thumbnailSize: permissiveNumberOrNull,
  thumbnailContentType: permissiveStringOrNull,
  thumbnailLocalKey: permissiveStringOrNull,
  thumbnailVersion: permissiveAttachmentVersion,
  screenshotPath: permissiveStringOrNull,
  screenshotSize: permissiveNumberOrNull,
  screenshotContentType: permissiveStringOrNull,
  screenshotLocalKey: permissiveStringOrNull,
  screenshotVersion: permissiveAttachmentVersion,
  backupThumbnailPath: permissiveStringOrNull,
  backupThumbnailSize: permissiveNumberOrNull,
  backupThumbnailContentType: permissiveStringOrNull,
  backupThumbnailLocalKey: permissiveStringOrNull,
  backupThumbnailVersion: permissiveAttachmentVersion,
  storyTextAttachmentJson: permissiveStringOrNull,
  localBackupPath: permissiveStringOrNull,
  flags: permissiveNumberOrNull,
  error: permissiveOptionalBool,
  wasTooBig: permissiveOptionalBool,
  backfillError: permissiveOptionalBool,
  isCorrupted: permissiveOptionalBool,
  isViewOnce: permissiveOptionalBool,
  copiedFromQuotedAttachment: permissiveOptionalBool,
  version: permissiveAttachmentVersion,
  pending: permissiveOptionalBool,
}) satisfies z.ZodType<MessageAttachmentDBType, z.ZodTypeDef, unknown>;
