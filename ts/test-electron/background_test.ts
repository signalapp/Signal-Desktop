// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { pick } from 'lodash';

import { isOverHourIntoPast, cleanupSessionResets } from '../background';

describe('#isOverHourIntoPast', () => {
  it('returns false for now', () => {
    assert.isFalse(isOverHourIntoPast(Date.now()));
  });
  it('returns false for 5 minutes ago', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    assert.isFalse(isOverHourIntoPast(fiveMinutesAgo));
  });
  it('returns true for 65 minutes ago', () => {
    const sixtyFiveMinutesAgo = Date.now() - 65 * 60 * 1000;
    assert.isTrue(isOverHourIntoPast(sixtyFiveMinutesAgo));
  });
});

describe('#cleanupSessionResets', () => {
  it('leaves empty object alone', async () => {
    await window.storage.put('sessionResets', {});
    await cleanupSessionResets();
    const actual = window.storage.get('sessionResets');

    const expected = {};
    assert.deepEqual(actual, expected);
  });
  it('filters out any timestamp older than one hour', async () => {
    const startValue = {
      one: Date.now() - 1,
      two: Date.now(),
      three: Date.now() - 65 * 60 * 1000,
    };
    await window.storage.put('sessionResets', startValue);
    await cleanupSessionResets();
    const actual = window.storage.get('sessionResets');

    const expected = pick(startValue, ['one', 'two']);
    assert.deepEqual(actual, expected);
  });
  it('filters out falsey items', async () => {
    const startValue = {
      one: 0,
      two: Date.now(),
    };
    await window.storage.put('sessionResets', startValue);
    await cleanupSessionResets();
    const actual = window.storage.get('sessionResets');

    const expected = pick(startValue, ['two']);
    assert.deepEqual(actual, expected);

    assert.deepEqual(Object.keys(startValue), ['two']);
  });
});
