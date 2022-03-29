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
  } else if (emojiCount > 4) {
    return 'medium';
  } else if (emojiCount > 2) {
    return 'large';
  } else {
    return 'jumbo';
  }
}
