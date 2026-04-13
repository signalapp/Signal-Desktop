// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

const LocaleEmojiSchema = z.object({
  emoji: z.string(),
  shortName: z.string(),
  tags: z.string().array(),
  rank: z.number(),
});

export type LocaleEmojiType = z.infer<typeof LocaleEmojiSchema>;

export const LocaleEmojiListSchema = LocaleEmojiSchema.array();

export type LocaleEmojiListType = z.infer<typeof LocaleEmojiListSchema>;

export enum EmojiSkinTone {
  None = 'EmojiSkinTone.None',
  Type1 = 'EmojiSkinTone.Type1', // 1F3FB
  Type2 = 'EmojiSkinTone.Type2', // 1F3FC
  Type3 = 'EmojiSkinTone.Type3', // 1F3FD
  Type4 = 'EmojiSkinTone.Type4', // 1F3FE
  Type5 = 'EmojiSkinTone.Type5', // 1F3FF
}
