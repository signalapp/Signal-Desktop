// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function getInitials(name?: string): string | undefined {
  if (!name) {
    return undefined;
  }

  const parsedName = name
    // remove all chars that are not letters or separators
    .replace(/[^\p{L}\p{Z}]+/gu, '')
    // replace all chars that are separators with a single ASCII space
    .replace(/\p{Z}+/gu, ' ')
    .trim();

  if (!parsedName) {
    return undefined;
  }

  // check if chars in the parsed string are initials
  if (
    Array.from(parsedName).length === 2 &&
    parsedName === parsedName.toUpperCase()
  ) {
    return parsedName;
  }

  const parts = parsedName.split(' ');
  const partsLen = parts.length;

  return partsLen === 1
    ? getFirstCharacter(parts[0])
    : // oxlint-disable-next-line typescript/no-non-null-assertion
      getFirstCharacter(parts[0]) + getFirstCharacter(parts[partsLen - 1]!);
}

// Unlike `charAt(0)`, this keeps letters outside the Basic Multilingual Plane
// (stored as surrogate pairs) intact.
function getFirstCharacter(part: string): string {
  const [first = ''] = part;
  return first;
}
