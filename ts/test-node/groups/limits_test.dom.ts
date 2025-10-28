// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { updateRemoteConfig } from '../../test-helpers/RemoteConfigStub.dom.js';

import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits.dom.js';

const RECOMMENDED_SIZE_KEY = 'global.groupsv2.maxGroupSize';
const HARD_LIMIT_KEY = 'global.groupsv2.groupSizeHardLimit';

describe('group limit utilities', () => {
  describe('getGroupSizeRecommendedLimit', () => {
    it('throws if the value in remote config is not defined', async () => {
      await updateRemoteConfig([]);
      assert.throws(getGroupSizeRecommendedLimit);
    });

    it('throws if the value in remote config is not a parseable integer', async () => {
      await updateRemoteConfig([
        { name: RECOMMENDED_SIZE_KEY, value: 'uh oh' },
      ]);
      assert.throws(getGroupSizeRecommendedLimit);
    });

    it('returns the value in remote config, parsed as an integer', async () => {
      await updateRemoteConfig([{ name: RECOMMENDED_SIZE_KEY, value: '123' }]);
      assert.strictEqual(getGroupSizeRecommendedLimit(), 123);
    });
  });

  describe('getGroupSizeHardLimit', () => {
    it('throws if the value in remote config is not defined', async () => {
      await updateRemoteConfig([]);
      assert.throws(getGroupSizeHardLimit);
    });

    it('throws if the value in remote config is not a parseable integer', async () => {
      await updateRemoteConfig([{ name: HARD_LIMIT_KEY, value: 'uh oh' }]);
      assert.throws(getGroupSizeHardLimit);
    });

    it('returns the value in remote config, parsed as an integer', async () => {
      await updateRemoteConfig([{ name: HARD_LIMIT_KEY, value: '123' }]);
      assert.strictEqual(getGroupSizeHardLimit(), 123);
    });
  });
});
