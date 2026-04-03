// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { assert } from 'chai';
import { useFakeTimers } from 'sinon';
import * as semver from 'semver';
import { generateTaggedVersion } from './generateTaggedVersion.mjs';

/** @import { SinonFakeTimers } from 'sinon' */

describe('generateTaggedVersion', () => {
  /** @type {SinonFakeTimers} */
  let clock;

  beforeEach(() => {
    clock = useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('uses the current date and provided shortSha', () => {
    clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());

    const currentVersion = '5.12.0-beta.1';
    const shortSha = '07f0efc45';

    const expected = '5.12.0-alpha.20210723.01-07f0efc45';
    const actual = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    assert.strictEqual(expected, actual);
  });

  it('same production version is semver.gt', () => {
    const currentVersion = '5.12.0-beta.1';
    const shortSha = '07f0efc45';

    clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
    const actual = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    assert.isTrue(semver.gt('5.12.0', actual));
  });

  it('same beta version is semver.gt', () => {
    const currentVersion = '5.12.0-beta.1';
    const shortSha = '07f0efc45';

    clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
    const actual = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    assert.isTrue(semver.gt(currentVersion, actual));
  });

  it('build earlier same day is semver.lt', () => {
    const currentVersion = '5.12.0-beta.1';
    const shortSha = '07f0efc45';

    clock.setSystemTime(new Date('2021-07-23T00:22:55.692Z').getTime());
    const actualEarlier = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
    const actualLater = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    assert.isTrue(semver.lt(actualEarlier, actualLater));
  });

  it('build previous day is semver.lt', () => {
    const currentVersion = '5.12.0-beta.1';
    const shortSha = '07f0efc45';

    clock.setSystemTime(new Date('2021-07-22T01:22:55.692Z').getTime());
    const actualEarlier = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
    const actualLater = generateTaggedVersion({
      release: 'alpha',
      currentVersion,
      shortSha,
    });

    assert.isTrue(semver.lt(actualEarlier, actualLater));
  });
});
