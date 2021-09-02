// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as remoteConfig from '../../RemoteConfig';

import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits';

describe('group limit utilities', () => {
  let sinonSandbox: sinon.SinonSandbox;
  let getRecommendedLimitStub: sinon.SinonStub;
  let getHardLimitStub: sinon.SinonStub;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();

    const getValueStub = sinonSandbox.stub(remoteConfig, 'getValue');
    getRecommendedLimitStub = getValueStub.withArgs(
      'global.groupsv2.maxGroupSize'
    );
    getHardLimitStub = getValueStub.withArgs(
      'global.groupsv2.groupSizeHardLimit'
    );
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('getGroupSizeRecommendedLimit', () => {
    it('throws if the value in remote config is not defined', () => {
      getRecommendedLimitStub.returns(undefined);
      assert.throws(getGroupSizeRecommendedLimit);
    });

    it('throws if the value in remote config is not a parseable integer', () => {
      getRecommendedLimitStub.returns('uh oh');
      assert.throws(getGroupSizeRecommendedLimit);
    });

    it('returns the value in remote config, parsed as an integer', () => {
      getRecommendedLimitStub.returns('123');
      assert.strictEqual(getGroupSizeRecommendedLimit(), 123);
    });
  });

  describe('getGroupSizeHardLimit', () => {
    it('throws if the value in remote config is not defined', () => {
      getHardLimitStub.returns(undefined);
      assert.throws(getGroupSizeHardLimit);
    });

    it('throws if the value in remote config is not a parseable integer', () => {
      getHardLimitStub.returns('uh oh');
      assert.throws(getGroupSizeHardLimit);
    });

    it('returns the value in remote config, parsed as an integer', () => {
      getHardLimitStub.returns('123');
      assert.strictEqual(getGroupSizeHardLimit(), 123);
    });
  });
});
