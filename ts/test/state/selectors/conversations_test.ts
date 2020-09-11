import { assert } from 'chai';

import { ConversationLookupType } from '../../../state/ducks/conversations';
import {
  _getConversationComparator,
  _getLeftPaneLists,
} from '../../../state/selectors/conversations';

describe('state/selectors/conversations', () => {
  describe('#getLeftPaneList', () => {
    it('sorts conversations based on timestamp then by intl-friendly title', () => {
      const data: ConversationLookupType = {
        id1: {
          id: 'id1',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'No timestamp',
          timestamp: 0,
          inboxPosition: 0,
          phoneNumber: 'notused',
          isArchived: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'No timestamp',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        },
        id2: {
          id: 'id2',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'B',
          timestamp: 20,
          inboxPosition: 21,
          phoneNumber: 'notused',
          isArchived: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'B',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        },
        id3: {
          id: 'id3',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'C',
          timestamp: 20,
          inboxPosition: 22,
          phoneNumber: 'notused',
          isArchived: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'C',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        },
        id4: {
          id: 'id4',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'Á',
          timestamp: 20,
          inboxPosition: 20,
          phoneNumber: 'notused',
          isArchived: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'A',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        },
        id5: {
          id: 'id5',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'First!',
          timestamp: 30,
          inboxPosition: 30,
          phoneNumber: 'notused',
          isArchived: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'First!',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        },
      };
      const comparator = _getConversationComparator();
      const { conversations } = _getLeftPaneLists(data, comparator);

      assert.strictEqual(conversations[0].name, 'First!');
      assert.strictEqual(conversations[1].name, 'Á');
      assert.strictEqual(conversations[2].name, 'B');
      assert.strictEqual(conversations[3].name, 'C');
      assert.strictEqual(conversations[4].name, 'No timestamp');
    });
  });
});
