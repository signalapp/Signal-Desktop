// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { times } from 'lodash';
import * as remoteConfig from '../../RemoteConfig';
import { UUID } from '../../types/UUID';

import { isConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing';

describe('isConversationTooBigToRing', () => {
  let sinonSandbox: sinon.SinonSandbox;
  let getMaxGroupCallRingSizeStub: sinon.SinonStub;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();

    const getValueStub = sinonSandbox.stub(remoteConfig, 'getValue');
    getMaxGroupCallRingSizeStub = getValueStub.withArgs(
      'global.calling.maxGroupCallRingSize'
    );
  });

  const fakeMemberships = (count: number) =>
    times(count, () => ({ uuid: UUID.generate().toString(), isAdmin: false }));

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('returns false if there are no memberships (i.e., for a direct conversation)', () => {
    assert.isFalse(isConversationTooBigToRing({}));
    assert.isFalse(isConversationTooBigToRing({ memberships: [] }));
  });

  const textMaximum = (max: number): void => {
    for (let count = 1; count < max; count += 1) {
      const memberships = fakeMemberships(count);
      assert.isFalse(isConversationTooBigToRing({ memberships }));
    }
    for (let count = max; count < max + 5; count += 1) {
      const memberships = fakeMemberships(count);
      assert.isTrue(isConversationTooBigToRing({ memberships }));
    }
  };

  it('returns whether there are 16 or more people in the group, if there is nothing in remote config', () => {
    textMaximum(16);
  });

  it('returns whether there are 16 or more people in the group, if the remote config value is bogus', () => {
    getMaxGroupCallRingSizeStub.returns('uh oh');
    textMaximum(16);
  });

  it('returns whether there are 9 or more people in the group, if the remote config value is 9', () => {
    getMaxGroupCallRingSizeStub.returns('9');
    textMaximum(9);
  });
});
