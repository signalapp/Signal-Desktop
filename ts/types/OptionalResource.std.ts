// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

export const OptionalResourceSchema = z.object({
  digest: z.string(),
  url: z.string(),
  size: z.number(),
});

export type OptionalResourceType = z.infer<typeof OptionalResourceSchema>;

export const OptionalResourcesDictSchema = z.record(
  z.string(),
  OptionalResourceSchema
);

export type OptionalResourcesDictType = z.infer<
  typeof OptionalResourcesDictSchema
>;
