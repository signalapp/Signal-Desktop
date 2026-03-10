// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as RemoteConfig from '../RemoteConfig.dom.js';

const GIPHY_CDN_ORIGINS = new Set([
  'https://media0.giphy.com',
  'https://media1.giphy.com',
  'https://media2.giphy.com',
  'https://media3.giphy.com',
  'https://media4.giphy.com',
]);

const TENOR_CDN_ORIGINS = new Set(['https://media.tenor.com']);

export function getGifCdnUrlOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    return url.origin;
  } catch {
    return null;
  }
}

export function isGiphyCdnUrlOrigin(origin: string): boolean {
  return GIPHY_CDN_ORIGINS.has(origin);
}

export function isTenorCdnUrlOrigin(origin: string): boolean {
  return TENOR_CDN_ORIGINS.has(origin);
}

export function isTenorCdnUrlOriginAllowed(): boolean {
  return RemoteConfig.isEnabled('desktop.recentGifs.allowLegacyTenorCdnUrls');
}

export function isGifCdnUrlOriginAllowed(origin: string): boolean {
  if (isGiphyCdnUrlOrigin(origin)) {
    return true;
  }
  if (isTenorCdnUrlOrigin(origin)) {
    return isTenorCdnUrlOriginAllowed();
  }
  return false;
}
