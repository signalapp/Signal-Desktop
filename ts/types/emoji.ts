// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

export const LocaleEmojiSchema = z.object({
  emoji: z.string(),
  shortName: z.string(),
  tags: z.string().array(),
  rank: z.number(),
});

export type LocaleEmojiType = z.infer<typeof LocaleEmojiSchema>;

export const LocaleEmojiListSchema = LocaleEmojiSchema.array();

export type LocaleEmojiListType = z.infer<typeof LocaleEmojiListSchema>;
