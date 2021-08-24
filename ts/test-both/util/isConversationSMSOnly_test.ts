// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';

describe('isConversationSMSOnly', () => {
  it('returns false if passed an undefined type', () => {
    assert.isFalse(
      isConversationSMSOnly({
        type: undefined,
      })
    );
  });

  ['direct', 'private'].forEach(type => {
    it('returns false if passed an undefined discoveredUnregisteredAt', () => {
      assert.isFalse(
        isConversationSMSOnly({ type, discoveredUnregisteredAt: undefined })
      );
    });

    it('returns true if passed a very old discoveredUnregisteredAt', () => {
      assert.isTrue(
        isConversationSMSOnly({
          type,
          e164: 'e164',
          uuid: 'uuid',
          discoveredUnregisteredAt: 1,
        })
      );
    });

    it(`returns true if passed a time fewer than 6 hours ago and is ${type}`, () => {
      assert.isTrue(
        isConversationSMSOnly({
          type,
          e164: 'e164',
          uuid: 'uuid',
          discoveredUnregisteredAt: Date.now(),
        })
      );

      const fiveHours = 1000 * 60 * 60 * 5;
      assert.isTrue(
        isConversationSMSOnly({
          type,
          e164: 'e164',
          uuid: 'uuid',
          discoveredUnregisteredAt: Date.now() - fiveHours,
        })
      );
    });

    it(`returns true conversation is ${type} and has no uuid`, () => {
      assert.isTrue(isConversationSMSOnly({ type, e164: 'e164' }));
      assert.isFalse(isConversationSMSOnly({ type }));
    });
  });

  it('returns false for groups', () => {
    assert.isFalse(isConversationSMSOnly({ type: 'group' }));
  });
});
