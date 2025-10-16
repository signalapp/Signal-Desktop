// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isConversationNameKnown } from '../../util/isConversationNameKnown.std.js';

describe('isConversationNameKnown', () => {
  describe('for direct conversations', () => {
    it('returns true if the conversation has a name', () => {
      assert.isTrue(
        isConversationNameKnown({
          type: 'direct',
          name: 'Jane Doe',
        })
      );
    });

    it('returns true if the conversation has a profile name', () => {
      assert.isTrue(
        isConversationNameKnown({
          type: 'direct',
          profileName: 'Jane Doe',
        })
      );
    });

    it('returns true if the conversation has an E164', () => {
      assert.isTrue(
        isConversationNameKnown({
          type: 'direct',
          e164: '+16505551234',
        })
      );
    });

    it('returns false if the conversation has none of the above', () => {
      assert.isFalse(isConversationNameKnown({ type: 'direct' }));
    });
  });

  describe('for group conversations', () => {
    it('returns true if the conversation has a name', () => {
      assert.isTrue(
        isConversationNameKnown({
          type: 'group',
          name: 'Tahoe Trip',
        })
      );
    });

    it('returns true if the conversation lacks a name', () => {
      assert.isFalse(isConversationNameKnown({ type: 'group' }));
    });
  });
});
