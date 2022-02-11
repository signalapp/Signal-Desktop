// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { times } from 'lodash';
import { updateRemoteConfig } from '../helpers/RemoteConfigStub';
import { UUID } from '../../types/UUID';

import { isConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing';

const CONFIG_KEY = 'global.calling.maxGroupCallRingSize';

describe('isConversationTooBigToRing', () => {
  const fakeMemberships = (count: number) =>
    times(count, () => ({ uuid: UUID.generate().toString(), isAdmin: false }));

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

  it('returns whether there are 16 or more people in the group, if there is nothing in remote config', async () => {
    await updateRemoteConfig([]);
    textMaximum(16);
  });

  it('returns whether there are 16 or more people in the group, if the remote config value is bogus', async () => {
    await updateRemoteConfig([
      { name: CONFIG_KEY, value: 'uh oh', enabled: true },
    ]);
    textMaximum(16);
  });

  it('returns whether there are 9 or more people in the group, if the remote config value is 9', async () => {
    await updateRemoteConfig([{ name: CONFIG_KEY, value: '9', enabled: true }]);
    textMaximum(9);
  });
});
