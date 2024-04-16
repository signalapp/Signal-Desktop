// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { MIMETypeSchema, type MIMEType } from './MIME';
import type { AttachmentType } from './Attachment';

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

export type AttachmentDownloadJobType = {
  messageId: string;
  receivedAt: number;
  sentAt: number;
  attachmentType: AttachmentDownloadJobTypeType;
  attachment: AttachmentType;
  attempts: number;
  active: boolean;
  retryAfter: number | null;
  lastAttemptTimestamp: number | null;
  digest: string;
  contentType: MIMEType;
  size: number;
};

export const attachmentDownloadJobSchema = z.object({
  messageId: z.string(),
  receivedAt: z.number(),
  sentAt: z.number(),
  attachmentType: attachmentDownloadTypeSchema,
  attachment: z
    .object({ size: z.number(), contentType: MIMETypeSchema })
    .passthrough(),
  attempts: z.number(),
  active: z.boolean(),
  retryAfter: z.number().nullable(),
  lastAttemptTimestamp: z.number().nullable(),
  digest: z.string(),
  contentType: MIMETypeSchema,
  size: z.number(),
  messageIdForLogging: z.string().optional(),
}) satisfies z.ZodType<
  Omit<AttachmentDownloadJobType, 'attachment' | 'contentType'> & {
    contentType: string;
    attachment: Record<string, unknown>;
  }
>;
