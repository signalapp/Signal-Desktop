// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import z from 'zod';

export const OptionalResourceSchema = z.object({
  digest: z.string(),
  url: z.string(),
  size: z.number(),
});

/** @typedef {z.infer<typeof OptionalResourceSchema>} OptionalResourceType */

export const OptionalResourcesDictSchema = z.record(
  z.string(),
  OptionalResourceSchema
);

/** @typedef {z.infer<typeof OptionalResourcesDictSchema>} OptionalResourcesDictType */
