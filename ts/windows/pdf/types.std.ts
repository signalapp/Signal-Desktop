// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod/mini';

const PDFAccountKeysPropsSchema = z.object({
  view: z.literal('account-keys'),
  serviceId: z.union([z.string(), z.undefined()]),
  backupKey: z.union([z.string(), z.undefined()]),
});

export const PDFWindowPropsSchema = z.union([PDFAccountKeysPropsSchema]);

export type PDFWindowPropsType = z.infer<typeof PDFWindowPropsSchema>;
