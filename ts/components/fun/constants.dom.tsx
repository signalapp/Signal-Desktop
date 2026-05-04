// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';
import { Emoji } from '../../axo/emoji.std.ts';

export enum FunPickerTabKey {
  EmojisTab = 'EmojisTab',
  StickersTab = 'Stickers',
  GifsTab = 'Gifs',
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

export enum FunEmojisBase {
  ThisMessage = 'ThisMessage',
}

export enum FunSectionCommon {
  SearchResults = 'SearchResults',
  Recents = 'Recents',
}

export enum FunStickersSectionBase {
  StickersSetup = 'StickersSetup',
  Featured = 'Featured',
}

export type FunTimeStickerStyle = 'analog' | 'digital';

export const FunTimeStickerStylesOrder: ReadonlyArray<FunTimeStickerStyle> = [
  'analog',
  'digital',
];

export type FunStickersPackSection = `StickerPack:${string}` & {
  FunStickersPackSection: never;
};

export function toFunStickersPackSection(
  pack: StickerPackType
): FunStickersPackSection {
  return `StickerPack:${pack.id}` as FunStickersPackSection;
}

export type FunEmojisSection =
  | FunSectionCommon
  | Emoji.Category
  | FunEmojisBase;
export type FunStickersSection =
  | FunSectionCommon
  | FunStickersSectionBase
  | FunStickersPackSection;
export type FunGifsSection = FunSectionCommon | FunGifsCategory;

export const FunEmojisSectionOrder: ReadonlyArray<
  FunSectionCommon.Recents | FunEmojisBase.ThisMessage | Emoji.Category
> = [
  FunEmojisBase.ThisMessage,
  FunSectionCommon.Recents,
  Emoji.Category.SMILIES_AND_PEOPLE,
  Emoji.Category.ANIMALS_AND_NATURE,
  Emoji.Category.FOOD_AND_DRINK,
  Emoji.Category.ACTIVITIES,
  Emoji.Category.TRAVEL_AND_PLACES,
  Emoji.Category.OBJECTS,
  Emoji.Category.SYMBOLS,
  Emoji.Category.FLAGS,
];
