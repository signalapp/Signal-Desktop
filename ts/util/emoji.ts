/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */
/* eslint-disable no-param-reassign */
/* eslint-disable import/no-mutable-exports  */
import { init, I18n } from 'emoji-mart';
import { FixedBaseEmoji, NativeEmojiData } from '../types/Reaction';
import { loadEmojiPanelI18n } from './i18n';

export type SizeClassType = 'default' | 'small' | 'medium' | 'large' | 'jumbo';

function getRegexUnicodeEmojis() {
  return /\p{Emoji_Presentation}/gu;
}

function getCountOfAllMatches(str: string) {
  const regex = getRegexUnicodeEmojis();

  const matches = str.match(regex);

  return matches?.length || 0;
}

function hasNormalCharacters(str: string) {
  const noEmoji = str.replace(getRegexUnicodeEmojis(), '').trim();
  return noEmoji.length > 0;
}

export function getEmojiSizeClass(str: string): SizeClassType {
  if (!str || !str.length) {
    return 'small';
  }
  if (hasNormalCharacters(str)) {
    return 'small';
  }

  const emojiCount = getCountOfAllMatches(str);
  if (emojiCount > 6) {
    return 'small';
  }
  if (emojiCount > 4) {
    return 'medium';
  }
  if (emojiCount > 2) {
    return 'large';
  }
  return 'jumbo';
}

export let nativeEmojiData: NativeEmojiData | null = null;
export let i18nEmojiData: typeof I18n | null = null;

export async function initialiseEmojiData(data: any): Promise<void> {
  const ariaLabels: Record<string, string> = {};
  Object.entries(data.emojis).forEach(([key, value]: [string, any]) => {
    value.search = `,${[
      [value.id, false],
      [value.name, true],
      [value.keywords, false],
      [value.emoticons, false],
    ]
      .map(([strings, split]) => {
        if (!strings) {
          return null;
        }
        return (Array.isArray(strings) ? strings : [strings])
          .map(string =>
            (split ? string.split(/[-|_|\s]+/) : [string]).map((s: string) => s.toLowerCase())
          )
          .flat();
      })
      .flat()
      .filter(a => a && a.trim())
      .join(',')})}`;

    (value as FixedBaseEmoji).skins.forEach(skin => {
      ariaLabels[skin.native] = value.name;
    });

    data.emojis[key] = value;
  });

  data.ariaLabels = ariaLabels;
  nativeEmojiData = data;

  i18nEmojiData = await loadEmojiPanelI18n();
  // Data needs to be initialised once per page load for the emoji components
  // See https://github.com/missive/emoji-mart#%EF%B8%8F%EF%B8%8F-headless-search
  await init({ data, i18n: i18nEmojiData });
}

// Synchronous version of Emoji Mart's SearchIndex.search()
// If we upgrade the package things will probably break
export function searchSync(query: string, args?: any): Array<any> {
  if (!nativeEmojiData) {
    window.log.error('No native emoji data found');
    return [];
  }

  if (!query || !query.trim().length) {
    return [];
  }

  const maxResults = args && args.maxResults ? args.maxResults : 90;
  const values = query
    .toLowerCase()
    .replace(/(\w)-/, '$1 ')
    .split(/[\s|,]+/)
    .filter((word: string, i: number, words: Array<string>) => {
      return word.trim() && words.indexOf(word) === i;
    });

  if (!values.length) {
    return [];
  }

  let pool: any = Object.values(nativeEmojiData.emojis);
  let results: Array<FixedBaseEmoji> = [];
  let scores: Record<string, number> = {};

  for (const value of values) {
    if (!pool.length) {
      break;
    }

    results = [];
    scores = {};

    for (const emoji of pool) {
      if (!emoji.search) {
        continue;
      }
      const score: number = emoji.search.indexOf(`,${value}`);
      if (score === -1) {
        continue;
      }

      results.push(emoji);
      scores[emoji.id] = scores[emoji.id] ? scores[emoji.id] : 0;
      scores[emoji.id] += emoji.id === value ? 0 : score + 1;
    }
    pool = results;
  }

  if (results.length < 2) {
    return results;
  }

  results.sort((a: FixedBaseEmoji, b: FixedBaseEmoji) => {
    const aScore = scores[a.id];
    const bScore = scores[b.id];

    if (aScore === bScore) {
      return a.id.localeCompare(b.id);
    }

    return aScore - bScore;
  });

  if (results.length > maxResults) {
    results = results.slice(0, maxResults);
  }
  return results;
}
