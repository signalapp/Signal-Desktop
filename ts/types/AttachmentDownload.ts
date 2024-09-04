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
  messageId: string;
  receivedAt: number;
  sentAt: number;
  attachmentType: AttachmentDownloadJobTypeType;
  attachment: AttachmentType;
  digest: string;
  contentType: MIMEType;
  size: number;
  ciphertextSize: number;
  source: AttachmentDownloadSource;
};

export type AttachmentDownloadJobType = CoreAttachmentDownloadJobType &
  JobManagerJobType;

export const coreAttachmentDownloadJobSchema = z.object({
  messageId: z.string(),
  receivedAt: z.number(),
  sentAt: z.number(),
  attachmentType: attachmentDownloadTypeSchema,
  attachment: z
    .object({ size: z.number(), contentType: MIMETypeSchema })
    .passthrough(),
  digest: z.string(),
  contentType: MIMETypeSchema,
  size: z.number(),
  ciphertextSize: z.number(),
  messageIdForLogging: z.string().optional(),
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
