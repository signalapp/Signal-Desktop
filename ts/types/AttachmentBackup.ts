// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import {
  type JobManagerJobType,
  jobManagerJobSchema,
} from '../jobs/JobManager';
import { type MIMEType, MIMETypeSchema } from './MIME';

export type CoreAttachmentBackupJobType =
  | StandardAttachmentBackupJobType
  | ThumbnailAttachmentBackupJobType;

type StandardAttachmentBackupJobType = {
  type: 'standard';
  mediaName: string;
  receivedAt: number;
  data: {
    path: string | null;
    contentType: MIMEType;
    keys: string;
    digest: string;
    iv: string;
    transitCdnInfo?: {
      cdnKey: string;
      cdnNumber: number;
      uploadTimestamp?: number;
    };
    size: number;
  };
};

type ThumbnailAttachmentBackupJobType = {
  type: 'thumbnail';
  mediaName: string;
  receivedAt: number;
  data: {
    fullsizePath: string | null;
    contentType: MIMEType;
    keys: string;
  };
};

const standardBackupJobDataSchema = z.object({
  type: z.literal('standard'),
  data: z.object({
    path: z.string(),
    size: z.number(),
    contentType: MIMETypeSchema,
    keys: z.string(),
    iv: z.string(),
    digest: z.string(),
    transitCdnInfo: z
      .object({
        cdnKey: z.string(),
        cdnNumber: z.number(),
        uploadTimestamp: z.number().optional(),
      })
      .optional(),
  }),
});

const thumbnailBackupJobDataSchema = z.object({
  type: z.literal('thumbnail'),
  data: z.object({
    fullsizePath: z.string(),
    contentType: MIMETypeSchema,
    keys: z.string(),
  }),
});

export const attachmentBackupJobSchema = z
  .object({
    mediaName: z.string(),
    receivedAt: z.number(),
  })
  .and(
    z.discriminatedUnion('type', [
      standardBackupJobDataSchema,
      thumbnailBackupJobDataSchema,
    ])
  )
  .and(jobManagerJobSchema) satisfies z.ZodType<
  AttachmentBackupJobType,
  z.ZodTypeDef,
  // With branded types, we need to specify that the input type of the schema is just a
  // string
  Omit<AttachmentBackupJobType, 'data'> & {
    data: Omit<AttachmentBackupJobType['data'], 'contentType'> & {
      contentType: string;
    };
  }
>;

export const thumbnailBackupJobRecordSchema = z.object({
  mediaName: z.string(),
  type: z.literal('standard'),
  json: thumbnailBackupJobDataSchema.omit({ type: true }),
});

export type AttachmentBackupJobType = CoreAttachmentBackupJobType &
  JobManagerJobType;
