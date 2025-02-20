// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EmojiPickerCategory } from './data/emojis';
import type { StickerPackType } from '../../state/ducks/stickers';

export enum FunPickerTabKey {
  Emoji = 'Emoji',
  Stickers = 'Stickers',
  Gifs = 'Gifs',
}

export enum FunGifsCategory {
  Trending = 'Trending',
  Celebrate = 'Celebrate',
  Love = 'Love',
  ThumbsUp = 'ThumbsUp',
  Surprised = 'Surprised',
  Excited = 'Excited',
  Sad = 'Sad',
  Angry = 'Angry',
}

export enum FunSectionCommon {
  SearchResults = 'SearchResults',
  Recents = 'Recents',
}

export enum FunStickersSectionBase {
  StickersSetup = 'StickersSetup',
}

export type FunStickersPackSection = `StickerPack:${string}` & {
  FunStickersPackSection: never;
};

export function toFunStickersPackSection(
  pack: StickerPackType
): FunStickersPackSection {
  return `StickerPack:${pack.id}` as FunStickersPackSection;
}

export type FunEmojisSection = FunSectionCommon | EmojiPickerCategory;
export type FunStickersSection =
  | FunSectionCommon
  | FunStickersSectionBase
  | FunStickersPackSection;
export type FunGifsSection = FunSectionCommon | FunGifsCategory;

export const FunEmojisSectionOrder: ReadonlyArray<
  FunSectionCommon.Recents | EmojiPickerCategory
> = [
  FunSectionCommon.Recents,
  EmojiPickerCategory.SmileysAndPeople,
  EmojiPickerCategory.AnimalsAndNature,
  EmojiPickerCategory.FoodAndDrink,
  EmojiPickerCategory.Activities,
  EmojiPickerCategory.TravelAndPlaces,
  EmojiPickerCategory.Objects,
  EmojiPickerCategory.Symbols,
  EmojiPickerCategory.Flags,
];

export const FunGifsSectionOrder: ReadonlyArray<
  FunSectionCommon.Recents | FunGifsCategory
> = [
  FunSectionCommon.Recents,
  FunGifsCategory.Trending,
  FunGifsCategory.Celebrate,
  FunGifsCategory.Love,
  FunGifsCategory.ThumbsUp,
  FunGifsCategory.Surprised,
  FunGifsCategory.Excited,
  FunGifsCategory.Sad,
  FunGifsCategory.Angry,
];
