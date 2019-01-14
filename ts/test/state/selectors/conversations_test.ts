import { assert } from 'chai';

import { ConversationLookupType } from '../../../state/ducks/conversations';
import {
  _getConversationComparator,
  _getLeftPaneList,
} from '../../../state/selectors/conversations';

describe('state/selectors/conversations', () => {
  describe('#getLeftPaneList', () => {
    it('sorts conversations based on timestamp then by intl-friendly title', () => {
      const i18n = (key: string) => key;
      const regionCode = 'US';
      const conversations: ConversationLookupType = {
        id1: {
          id: 'id1',
          activeAt: Date.now(),
          name: 'No timestamp',
          timestamp: 0,
          phoneNumber: 'notused',

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          unreadCount: 1,
          isSelected: false,
          isTyping: false,
        },
        id2: {
          id: 'id2',
          activeAt: Date.now(),
          name: 'B',
          timestamp: 20,
          phoneNumber: 'notused',

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          unreadCount: 1,
          isSelected: false,
          isTyping: false,
        },
        id3: {
          id: 'id3',
          activeAt: Date.now(),
          name: 'C',
          timestamp: 20,
          phoneNumber: 'notused',

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          unreadCount: 1,
          isSelected: false,
          isTyping: false,
        },
        id4: {
          id: 'id4',
          activeAt: Date.now(),
          name: 'Á',
          timestamp: 20,
          phoneNumber: 'notused',

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          unreadCount: 1,
          isSelected: false,
          isTyping: false,
        },
        id5: {
          id: 'id5',
          activeAt: Date.now(),
          name: 'First!',
          timestamp: 30,
          phoneNumber: 'notused',

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          unreadCount: 1,
          isSelected: false,
          isTyping: false,
        },
      };
      const comparator = _getConversationComparator(i18n, regionCode);
      const list = _getLeftPaneList(conversations, comparator);

      assert.strictEqual(list[0].name, 'First!');
      assert.strictEqual(list[1].name, 'Á');
      assert.strictEqual(list[2].name, 'B');
      assert.strictEqual(list[3].name, 'C');
      assert.strictEqual(list[4].name, 'No timestamp');
    });
  });
});
