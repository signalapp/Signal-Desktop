// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import { resolveCanonicalLocales } from '../../util/resolveCanonicalLocales';

describe('resolveCanonicalLocales', () => {
  it('returns an array of canonical locales', () => {
    assert.deepEqual(
      resolveCanonicalLocales(['EN', 'EN-US', 'EN-GB', 'FR', 'FR-FR']),
      ['en', 'en-US', 'en-GB', 'fr', 'fr-FR']
    );
  });

  it('removes invalid locales', () => {
    assert.deepEqual(resolveCanonicalLocales(['!@#$', 'POSIX', 'en']), ['en']);
  });

  it('defaults to en if no valid locales are provided', () => {
    assert.deepEqual(resolveCanonicalLocales(['!@#$']), ['en']);
  });
});
