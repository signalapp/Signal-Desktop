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

export type StandardAttachmentBackupJobType = {
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
    version?: 1 | 2;
    localKey?: string;
  };
};

export type ThumbnailAttachmentBackupJobType = {
  type: 'thumbnail';
  mediaName: `${string}_thumbnail`;
  receivedAt: number;
  data: {
    fullsizePath: string | null;
    fullsizeSize: number;
    contentType: MIMEType;
    version?: 1 | 2;
    localKey?: string;
  };
};

const standardBackupJobDataSchema = z.object({
  type: z.literal('standard'),
  mediaName: z.string(),
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
    version: z.union([z.literal(1), z.literal(2)]).optional(),
    localKey: z.string().optional(),
  }),
});

const thumbnailMediaNameSchema = z
  .string()
  .refine((mediaName: string): mediaName is `${string}_thumbnail` => {
    return mediaName.endsWith('_thumbnail');
  });

const thumbnailBackupJobDataSchema = z.object({
  type: z.literal('thumbnail'),
  mediaName: thumbnailMediaNameSchema,
  data: z.object({
    fullsizePath: z.string(),
    fullsizeSize: z.number(),
    contentType: MIMETypeSchema,
    version: z.union([z.literal(1), z.literal(2)]).optional(),
    localKey: z.string().optional(),
  }),
});

export const attachmentBackupJobSchema = z
  .object({
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
  mediaName: thumbnailMediaNameSchema,
  type: z.literal('standard'),
  json: thumbnailBackupJobDataSchema.omit({ type: true }),
});

export type AttachmentBackupJobType = CoreAttachmentBackupJobType &
  JobManagerJobType;
