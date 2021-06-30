// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  isEndSession,
  isGroupUpdate,
  isIncoming,
  isOutgoing,
} from '../../../state/selectors/message';

describe('state/selectors/messages', () => {
  describe('isEndSession', () => {
    it('checks if it is end of the session', () => {
      assert.isFalse(isEndSession({}));
      assert.isFalse(isEndSession({ flags: undefined }));
      assert.isFalse(isEndSession({ flags: 0 }));
      assert.isFalse(isEndSession({ flags: 2 }));
      assert.isFalse(isEndSession({ flags: 4 }));

      assert.isTrue(isEndSession({ flags: 1 }));
    });
  });

  describe('isGroupUpdate', () => {
    it('checks if is group update', () => {
      assert.isFalse(isGroupUpdate({}));
      assert.isFalse(isGroupUpdate({ group_update: undefined }));

      assert.isTrue(isGroupUpdate({ group_update: { left: 'You' } }));
    });
  });

  describe('isIncoming', () => {
    it('checks if is incoming message', () => {
      assert.isFalse(isIncoming({ type: 'outgoing' }));
      assert.isFalse(isIncoming({ type: 'call-history' }));

      assert.isTrue(isIncoming({ type: 'incoming' }));
    });
  });

  describe('isOutgoing', () => {
    it('checks if is outgoing message', () => {
      assert.isFalse(isOutgoing({ type: 'incoming' }));
      assert.isFalse(isOutgoing({ type: 'call-history' }));

      assert.isTrue(isOutgoing({ type: 'outgoing' }));
    });
  });
});
