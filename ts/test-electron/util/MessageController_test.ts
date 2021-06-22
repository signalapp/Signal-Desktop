// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { MessageModel } from '../../models/messages';

import { MessageController } from '../../util/MessageController';

describe('MessageController', () => {
  describe('filterBySentAt', () => {
    it('returns an empty iterable if no messages match', () => {
      const mc = new MessageController();

      assert.isEmpty([...mc.filterBySentAt(123)]);
    });

    it('returns all messages that match the timestamp', () => {
      const mc = new MessageController();
      const message1 = new MessageModel({
        conversationId: 'xyz',
        id: 'abc',
        received_at: 1,
        sent_at: 1234,
        timestamp: 9999,
        type: 'incoming',
      });
      const message2 = new MessageModel({
        conversationId: 'xyz',
        id: 'def',
        received_at: 2,
        sent_at: 1234,
        timestamp: 9999,
        type: 'outgoing',
      });
      const message3 = new MessageModel({
        conversationId: 'xyz',
        id: 'ignored',
        received_at: 3,
        sent_at: 5678,
        timestamp: 9999,
        type: 'outgoing',
      });
      mc.register(message1.id, message1);
      mc.register(message2.id, message2);
      // We deliberately register this message twice for testing.
      mc.register(message2.id, message2);
      mc.register(message3.id, message3);

      assert.sameMembers([...mc.filterBySentAt(1234)], [message1, message2]);

      mc.unregister(message2.id);

      assert.sameMembers([...mc.filterBySentAt(1234)], [message1]);
    });
  });
});
