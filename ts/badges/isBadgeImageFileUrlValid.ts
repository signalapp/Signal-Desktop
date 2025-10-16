// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { maybeParseUrl } from '../util/url.std.js';

export function isBadgeImageFileUrlValid(
  url: string,
  updatesUrl: string
): boolean {
  const expectedPrefix = new URL('/static/badges', updatesUrl).href;
  return url.startsWith(expectedPrefix) && Boolean(maybeParseUrl(url));
}
