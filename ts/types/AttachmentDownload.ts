// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { MIMETypeSchema, type MIMEType } from './MIME';
import type { AttachmentType } from './Attachment';
import {
  type JobManagerJobType,
  jobManagerJobSchema,
} from '../jobs/JobManager';
import { AttachmentDownloadSource } from '../sql/Interface';

export enum MediaTier {
  STANDARD = 'standard',
  BACKUP = 'backup',
}

export const attachmentDownloadTypeSchema = z.enum([
  'long-message',
  'attachment',
  'preview',
  'contact',
  'quote',
  'sticker',
]);

export type AttachmentDownloadJobTypeType = z.infer<
  typeof attachmentDownloadTypeSchema
>;

export type CoreAttachmentDownloadJobType = {
  attachment: AttachmentType;
  attachmentType: AttachmentDownloadJobTypeType;
  ciphertextSize: number;
  contentType: MIMEType;
  digest: string;
  isManualDownload?: boolean;
  messageId: string;
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
  attachmentType: attachmentDownloadTypeSchema,
  ciphertextSize: z.number(),
  contentType: MIMETypeSchema,
  digest: z.string(),
  isManualDownload: z.boolean().optional(),
  messageId: z.string(),
  messageIdForLogging: z.string().optional(),
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
