// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { MuteExpiration } from '@signalapp/types';

import { isConversationMuted } from '../../util/isConversationMuted.std.ts';

describe('isConversationMuted', () => {
  it('returns false if passed an undefined expiry time', () => {
    assert.isFalse(isConversationMuted({}));
    assert.isFalse(isConversationMuted({ muteExpiresAt: undefined }));
  });

  it('returns false if passed a date in the past', () => {
    assert.isFalse(
      isConversationMuted({ muteExpiresAt: MuteExpiration.UNMUTED })
    );
    assert.isFalse(
      isConversationMuted({
        muteExpiresAt: MuteExpiration.fromNumber(Date.now() - 123),
      })
    );
  });

  it('returns true if passed a date in the future', () => {
    assert.isTrue(
      isConversationMuted({
        muteExpiresAt: MuteExpiration.fromNumber(Date.now() + 123),
      })
    );
    assert.isTrue(
      isConversationMuted({
        muteExpiresAt: MuteExpiration.fromNumber(Date.now() + 123456),
      })
    );
  });
});
