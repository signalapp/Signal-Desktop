// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UrlSource } from 'mediabunny';

export function createUrlSource(url: string): UrlSource {
  return new UrlSource(url, {
    fetchFn: (...args) => {
      const req = new Request(...args);
      if (req.url !== url) {
        throw new Error(`Unexpected media fetch of ${req.url}`);
      }
      return fetch(req);
    },
  });
}
