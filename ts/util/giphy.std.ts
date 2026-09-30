// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Giphy says the ?q= parameter can only be up to 50 "characters", this is most
// likely measured in code points, although its not clear if they mean
// URL-encoded or not. We can enforce this with UTF-8 byte length which should
// always be shorter.
export const GIPHY_SEARCH_QUERY_MAX_CODE_POINTS = 50;

const GIPHY_CDN_ORIGINS = new Set([
  'https://media0.giphy.com',
  'https://media1.giphy.com',
  'https://media2.giphy.com',
  'https://media3.giphy.com',
  'https://media4.giphy.com',
]);

export function isGiphyCdnUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return GIPHY_CDN_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}
