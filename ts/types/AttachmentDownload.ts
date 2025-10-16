// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { MIMETypeSchema, type MIMEType } from './MIME.std.js';
import type { AttachmentType } from './Attachment.std.js';
import {
  type JobManagerJobType,
  jobManagerJobSchema,
} from '../jobs/JobManager.std.js';
import { AttachmentDownloadSource } from '../sql/Interface.std.js';

export enum MediaTier {
  STANDARD = 'standard',
  BACKUP = 'backup',
}

export const messageAttachmentTypeSchema = z.enum([
  'long-message',
  'attachment',
  'preview',
  'contact',
  'quote',
  'sticker',
]);

export type MessageAttachmentType = z.infer<typeof messageAttachmentTypeSchema>;

export type CoreAttachmentDownloadJobType = {
  attachment: AttachmentType;
  attachmentType: MessageAttachmentType;
  ciphertextSize: number;
  contentType: MIMEType;
  attachmentSignature: string;
  isManualDownload?: boolean;
  messageId: string;
  originalSource: AttachmentDownloadSource;
  receivedAt: number;
  sentAt: number;
  size: number;
  source: AttachmentDownloadSource;
};

export type AttachmentDownloadJobType = CoreAttachmentDownloadJobType &
  JobManagerJobType;

export const coreAttachmentDownloadJobSchema = z.object({
  attachment: z
    .object({ size: z.number(), contentType: MIMETypeSchema })
    .passthrough(),
  attachmentType: messageAttachmentTypeSchema,
  ciphertextSize: z.number(),
  contentType: MIMETypeSchema,
  attachmentSignature: z.string(),
  isManualDownload: z.boolean().optional(),
  messageId: z.string(),
  messageIdForLogging: z.string().optional(),
  originalSource: z.nativeEnum(AttachmentDownloadSource),
  receivedAt: z.number(),
  sentAt: z.number(),
  size: z.number(),
  source: z.nativeEnum(AttachmentDownloadSource),
});

export const attachmentDownloadJobSchema = coreAttachmentDownloadJobSchema.and(
  jobManagerJobSchema
) satisfies z.ZodType<
  Omit<AttachmentDownloadJobType, 'attachment' | 'contentType'> & {
    contentType: string;
    attachment: Record<string, unknown>;
  }
>;

export enum AttachmentDownloadUrgency {
  IMMEDIATE = 'immediate',
  STANDARD = 'standard',
}
