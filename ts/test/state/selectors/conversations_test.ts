import { assert } from 'chai';
import * as sinon from 'sinon';

import { ConversationLookupType } from '../../../state/ducks/conversations';
import {
  _getConversationComparator,
  _getLeftPaneLists,
} from '../../../state/selectors/conversations';

describe('state/selectors/conversations', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalAsAny = global as any;

  beforeEach(function beforeEach() {
    this.oldWindow = globalAsAny.window;
    globalAsAny.window = {};

    window.ConversationController = {
      getPinnedConversationIds: sinon.stub().returns([]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  afterEach(function afterEach() {
    if (this.oldWindow === undefined) {
      delete globalAsAny.window;
    } else {
      globalAsAny.window = this.oldWindow;
    }
  });

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

    describe('given pinned conversations', () => {
      beforeEach(() => {
        (window.ConversationController
          .getPinnedConversationIds as sinon.SinonStub).returns([
          'pin1',
          'pin2',
          'pin3',
        ]);
      });

      it('sorts pinned conversations based on order in storage', () => {
        const data: ConversationLookupType = {
          pin2: {
            id: 'pin2',
            e164: '+18005551111',
            activeAt: Date.now(),
            name: 'Pin Two',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin Two',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          },
          pin3: {
            id: 'pin3',
            e164: '+18005551111',
            activeAt: Date.now(),
            name: 'Pin Three',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin Three',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          },
          pin1: {
            id: 'pin1',
            e164: '+18005551111',
            activeAt: Date.now(),
            name: 'Pin One',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin One',
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
        const { pinnedConversations } = _getLeftPaneLists(data, comparator);

        assert.strictEqual(pinnedConversations[0].name, 'Pin One');
        assert.strictEqual(pinnedConversations[1].name, 'Pin Two');
        assert.strictEqual(pinnedConversations[2].name, 'Pin Three');
      });
    });
  });
});
