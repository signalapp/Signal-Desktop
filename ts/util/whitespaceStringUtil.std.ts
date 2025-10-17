// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const WHITESPACE = new Set([
  ' ',
  '\u200E', // left-to-right mark
  '\u200F', // right-to-left mark
  '\u2007', // figure space
  '\u200B', // zero-width space
  '\u2800', // braille blank
]);

export function trim(str: string): string {
  let start = 0;
  let end = str.length - 1;

  for (start; start < str.length; start += 1) {
    const char = str[start];
    if (!WHITESPACE.has(char)) {
      break;
    }
  }

  for (end; end > 0; end -= 1) {
    const char = str[end];
    if (!WHITESPACE.has(char)) {
      break;
    }
  }

  if (start > 0 || end < str.length - 1) {
    return str.substring(start, end + 1);
  }

  return str;
}

export function isWhitespace(str: string): boolean {
  for (let i = 0; i < str.length; i += 1) {
    const char = str[i];
    if (!WHITESPACE.has(char)) {
      return false;
    }
  }

  return true;
}
