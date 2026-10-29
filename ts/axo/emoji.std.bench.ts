// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, test } from 'vitest';
import { Emoji } from './emoji.std.ts';

describe('Emoji', () => {
  test('search', async ({ bench }) => {
    // Warm up the lazily built search index so it isn't part of the results
    Emoji.search('warmup');

    await bench.compare(
      bench('short query (exact)', () => {
        Emoji.search('o');
      }),
      bench('prefix query (fuzzy)', () => {
        Emoji.search('thinkin');
      }),
      bench('emoticon query', () => {
        Emoji.search(':D');
      }),
      bench('no results', () => {
        Emoji.search('thisshouldnotmatchanything');
      })
    );
  });
});
