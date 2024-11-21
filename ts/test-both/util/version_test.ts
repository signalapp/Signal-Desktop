// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { useFakeTimers } from 'sinon';
import * as semver from 'semver';

import {
  generateTaggedVersion,
  isAlpha,
  isAxolotl,
  isNightly,
  isBeta,
  isProduction,
  isStaging,
} from '../../util/version';

describe('version utilities', () => {
  describe('isProduction', () => {
    it('returns false for anything non-basic version number', () => {
      assert.isFalse(isProduction('1.2.3-1'));
      assert.isFalse(isProduction('1.2.3-alpha.1'));
      assert.isFalse(isProduction('1.2.3-beta.1'));
      assert.isFalse(isProduction('1.2.3-rc'));
    });

    it('returns true for production version strings', () => {
      assert.isTrue(isProduction('1.2.3'));
      assert.isTrue(isProduction('5.10.0'));
    });
  });

  describe('isBeta', () => {
    it('returns false for non-beta version strings', () => {
      assert.isFalse(isBeta('1.2.3'));
      assert.isFalse(isBeta('1.2.3-alpha'));
      assert.isFalse(isBeta('1.2.3-alpha.1'));
      assert.isFalse(isBeta('1.2.3-rc.1'));
    });

    it('returns true for beta version strings', () => {
      assert.isTrue(isBeta('1.2.3-beta'));
      assert.isTrue(isBeta('1.2.3-beta.1'));
    });
  });

  describe('isAlpha', () => {
    it('returns false for non-alpha version strings', () => {
      assert.isFalse(isAlpha('1.2.3'));
      assert.isFalse(isAlpha('1.2.3-staging.1'));
      assert.isFalse(isAlpha('1.2.3-beta'));
      assert.isFalse(isAlpha('1.2.3-beta.1'));
      assert.isFalse(isAlpha('1.2.3-rc.1'));
    });

    it('returns true for Alpha version strings', () => {
      assert.isTrue(isAlpha('1.2.3-alpha'));
      assert.isTrue(isAlpha('1.2.3-alpha.1'));
    });
  });

  describe('isAxolotl', () => {
    it('returns false for non-axolotl version strings', () => {
      assert.isFalse(isAxolotl('1.2.3'));
      assert.isFalse(isAxolotl('1.2.3-staging.1'));
      assert.isFalse(isAxolotl('1.2.3-beta'));
      assert.isFalse(isAxolotl('1.2.3-beta.1'));
      assert.isFalse(isAxolotl('1.2.3-rc.1'));
    });

    it('returns true for Axolotl version strings', () => {
      assert.isTrue(isAxolotl('1.2.3-axolotl'));
      assert.isTrue(isAxolotl('1.2.3-axolotl.1'));
    });
  });

  describe('isNightly', () => {
    it('returns false for non-nightly version strings', () => {
      assert.isFalse(isNightly('1.2.3'));
      assert.isFalse(isNightly('1.2.3-beta.1'));
      assert.isFalse(isNightly('1.2.3-staging.1'));
    });

    it('returns true for nightly version strings', () => {
      assert.isTrue(isNightly('1.2.3-alpha.1'));
      assert.isTrue(isNightly('1.2.3-axolotl.1'));
    });
  });

  describe('isStaging', () => {
    it('returns false for non-staging version strings', () => {
      assert.isFalse(isStaging('1.2.3'));
      assert.isFalse(isStaging('1.2.3-alpha.1'));
      assert.isFalse(isStaging('1.2.3-beta'));
      assert.isFalse(isStaging('1.2.3-beta.1'));
      assert.isFalse(isStaging('1.2.3-rc.1'));
    });

    it('returns true for Staging version strings', () => {
      assert.isTrue(isStaging('1.2.3-staging'));
      assert.isTrue(isStaging('1.2.3-staging.1'));
      assert.isTrue(isStaging('1.2.3-staging.1232.23-adsfs'));
    });
  });

  describe('generateTaggedVersion', () => {
    beforeEach(function (this: Mocha.Context) {
      // This isn't a hook.
      this.clock = useFakeTimers();
    });

    afterEach(function (this: Mocha.Context) {
      this.clock.restore();
    });

    it('uses the current date and provided shortSha', function (this: Mocha.Context) {
      this.clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());

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

    it('same production version is semver.gt', function (this: Mocha.Context) {
      const currentVersion = '5.12.0-beta.1';
      const shortSha = '07f0efc45';

      this.clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
      const actual = generateTaggedVersion({
        release: 'alpha',
        currentVersion,
        shortSha,
      });

      assert.isTrue(semver.gt('5.12.0', actual));
    });

    it('same beta version is semver.gt', function (this: Mocha.Context) {
      const currentVersion = '5.12.0-beta.1';
      const shortSha = '07f0efc45';

      this.clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
      const actual = generateTaggedVersion({
        release: 'alpha',
        currentVersion,
        shortSha,
      });

      assert.isTrue(semver.gt(currentVersion, actual));
    });

    it('build earlier same day is semver.lt', function (this: Mocha.Context) {
      const currentVersion = '5.12.0-beta.1';
      const shortSha = '07f0efc45';

      this.clock.setSystemTime(new Date('2021-07-23T00:22:55.692Z').getTime());
      const actualEarlier = generateTaggedVersion({
        release: 'alpha',
        currentVersion,
        shortSha,
      });

      this.clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
      const actualLater = generateTaggedVersion({
        release: 'alpha',
        currentVersion,
        shortSha,
      });

      assert.isTrue(semver.lt(actualEarlier, actualLater));
    });

    it('build previous day is semver.lt', function (this: Mocha.Context) {
      const currentVersion = '5.12.0-beta.1';
      const shortSha = '07f0efc45';

      this.clock.setSystemTime(new Date('2021-07-22T01:22:55.692Z').getTime());
      const actualEarlier = generateTaggedVersion({
        release: 'alpha',
        currentVersion,
        shortSha,
      });

      this.clock.setSystemTime(new Date('2021-07-23T01:22:55.692Z').getTime());
      const actualLater = generateTaggedVersion({
        release: 'alpha',
        currentVersion,
        shortSha,
      });

      assert.isTrue(semver.lt(actualEarlier, actualLater));
    });
  });
});
