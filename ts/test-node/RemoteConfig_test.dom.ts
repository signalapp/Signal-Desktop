// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import lodash from 'lodash';
import { normalizeAci } from '../util/normalizeAci.std.js';
import type { ConfigKeyType, ConfigListenerType } from '../RemoteConfig.dom.js';
import {
  getCountryCodeValue,
  getBucketValue,
  innerIsBucketValueEnabled,
  onChange,
  getValue,
  isEnabled,
} from '../RemoteConfig.dom.js';
import { updateRemoteConfig } from '../test-helpers/RemoteConfigStub.dom.js';

const { omit } = lodash;

describe('RemoteConfig', () => {
  const aci = normalizeAci('95b9729c-51ea-4ddb-b516-652befe78062', 'test');

  describe('#innerIsBucketValueEnabled', () => {
    // Note: bucketValue is 376321 for 'desktop.internalUser' key

    it('returns true for 100% wildcard', () => {
      assert.strictEqual(
        innerIsBucketValueEnabled(
          'desktop.internalUser',
          '*:1000000',
          '+12125550000',
          aci
        ),
        true
      );
    });

    it('returns true for 70% on country code 1', () => {
      assert.strictEqual(
        innerIsBucketValueEnabled(
          'desktop.internalUser',
          '1:700000',
          '+12125550000',
          aci
        ),
        true
      );
    });

    it('returns false for 30% on country code 1', () => {
      assert.strictEqual(
        innerIsBucketValueEnabled(
          'desktop.internalUser',
          '1:300000',
          '+12125550000',
          aci
        ),
        false
      );
    });
  });

  describe('#getCountryCodeValue', () => {
    it('returns undefined for empty value', () => {
      assert.strictEqual(getCountryCodeValue(1, '', 'flagName'), undefined);
    });

    it('throws for malformed flag', () => {
      assert.throws(
        () => getCountryCodeValue(1, 'hi:::', 'flagName'),
        "invalid number ''"
      );
    });

    it('throws for non-integer value', () => {
      assert.throws(
        () => getCountryCodeValue(1, '1:cd', 'flagName'),
        "invalid number 'cd'"
      );
    });

    it('returns wildcard value if no other codes', () => {
      assert.strictEqual(getCountryCodeValue(1, '*:56,2:74', 'flagName'), 56);
    });

    it('returns value for specific codes, instead of wildcard', () => {
      assert.strictEqual(getCountryCodeValue(1, '*:56,1:74', 'flagName'), 74);
    });

    it('returns undefined if no wildcard or specific value', () => {
      assert.strictEqual(
        getCountryCodeValue(1, '2:56,3:74', 'flagName'),
        undefined
      );
    });
  });

  describe('#getBucketValue', () => {
    it('returns undefined for empty value', () => {
      const flagName = 'research.megaphone.1';

      assert.strictEqual(getBucketValue(aci, flagName), 222732);
    });
  });

  describe('#getValue', () => {
    it('returns value if enabled', async () => {
      await updateRemoteConfig([]);

      assert.equal(getValue('desktop.internalUser'), undefined);

      await updateRemoteConfig([
        { name: 'desktop.internalUser', value: 'yes' },
      ]);
      assert.equal(getValue('desktop.internalUser'), 'yes');
    });

    it('does not return disabled value', async () => {
      await updateRemoteConfig([]);
      assert.equal(getValue('desktop.internalUser'), undefined);
    });
  });

  describe('#isEnabled', () => {
    it('is false for missing flag', async () => {
      await updateRemoteConfig([]);
      assert.equal(isEnabled('desktop.internalUser'), false);
    });

    it('is false for disabled flag', async () => {
      await updateRemoteConfig([]);
      assert.equal(isEnabled('desktop.internalUser'), false);
    });

    it('is true for enabled flag', async () => {
      await updateRemoteConfig([
        { name: 'desktop.internalUser', value: 'yes' },
      ]);
      assert.equal(isEnabled('desktop.internalUser'), true);
    });

    it('is true for true string flag', async () => {
      await updateRemoteConfig([
        { name: 'desktop.internalUser', value: 'true' },
      ]);
      assert.equal(isEnabled('desktop.internalUser'), true);
    });

    it('is false for false string flag', async () => {
      await updateRemoteConfig([
        { name: 'desktop.internalUser', value: 'false' },
      ]);
      assert.equal(isEnabled('desktop.internalUser'), false);
    });

    it('reflects the value of an unknown flag in the config', async () => {
      assert.equal(
        isEnabled('desktop.unknownFlagName' as ConfigKeyType),
        false
      );
      await updateRemoteConfig([
        { name: 'desktop.unknownFlagName', value: 'unknownFlagValue' },
      ]);
      assert.equal(isEnabled('desktop.unknownFlagName' as ConfigKeyType), true);
    });
  });

  describe('#onChange', () => {
    it('triggers listener on known flag change', async () => {
      await updateRemoteConfig([]);

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const listener = sinon.spy<ConfigListenerType>(() => {});
      onChange('desktop.internalUser', listener);

      await updateRemoteConfig([
        { name: 'desktop.internalUser', value: 'yes' },
      ]);
      await updateRemoteConfig([]);
      await updateRemoteConfig([
        { name: 'desktop.internalUser', value: 'yes' },
      ]);

      const calls = listener
        .getCalls()
        .map(call => omit(call.firstArg, 'enabledAt'));
      assert.deepEqual(calls, [
        { name: 'desktop.internalUser', value: 'yes', enabled: true },
        { name: 'desktop.internalUser', enabled: false },
        { name: 'desktop.internalUser', value: 'yes', enabled: true },
      ]);
    });
  });
});
