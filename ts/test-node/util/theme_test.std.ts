// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { Theme, themeClassName } from '../../util/theme.std.js';

describe('themeClassName', () => {
  it('returns "light-theme" when passed a light theme', () => {
    assert.strictEqual(themeClassName(Theme.Light), 'light-theme');
  });

  it('returns "dark-theme" when passed a dark theme', () => {
    assert.strictEqual(themeClassName(Theme.Dark), 'dark-theme');
  });
});
