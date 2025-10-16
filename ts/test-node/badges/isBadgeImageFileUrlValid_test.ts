// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isBadgeImageFileUrlValid } from '../../badges/isBadgeImageFileUrlValid.std.js';

describe('isBadgeImageFileUrlValid', () => {
  const UPDATES_URL = 'https://updates2.signal.org/desktop';

  it('returns false for invalid URLs', () => {
    ['', 'uhh', 'http:'].forEach(url => {
      assert.isFalse(isBadgeImageFileUrlValid(url, UPDATES_URL));
    });
  });

  it("returns false if the URL doesn't start with the right prefix", () => {
    [
      'https://user:pass@updates2.signal.org/static/badges/foo',
      'https://signal.org/static/badges/foo',
      'https://updates.signal.org/static/badges/foo',
      'http://updates2.signal.org/static/badges/foo',
      'http://updates2.signal.org/static/badges/foo',
    ].forEach(url => {
      assert.isFalse(isBadgeImageFileUrlValid(url, UPDATES_URL));
    });
  });

  it('returns true for valid URLs', () => {
    [
      'https://updates2.signal.org/static/badges/foo',
      'https://updates2.signal.org/static/badges/foo.svg',
      'https://updates2.signal.org/static/badges/foo.txt',
    ].forEach(url => {
      assert.isTrue(isBadgeImageFileUrlValid(url, UPDATES_URL));
    });
  });
});
