import { assert } from 'chai';
import {
  CONVERSATION_PRIORITIES,
  ConversationTypeEnum,
} from '../../../../models/conversationAttributes';

import { ConversationLookupType } from '../../../../state/ducks/conversations';
import {
  _getConversationComparator,
  _getSortedConversations,
} from '../../../../state/selectors/conversations';

describe('state/selectors/conversations', () => {
  describe('#getSortedConversationsList', () => {
    it('sorts conversations based on timestamp then by intl-friendly title', () => {
      const i18n = (key: string) => key;
      const data: ConversationLookupType = {
        id1: {
          id: 'id1',
          activeAt: 0,
          displayNameInProfile: 'No timestamp',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          expireTimer: 0,
          priority: CONVERSATION_PRIORITIES.default,
        },
        id2: {
          id: 'id2',
          activeAt: 20,
          displayNameInProfile: 'B',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          expireTimer: 0,
          priority: CONVERSATION_PRIORITIES.default,
        },
        id3: {
          id: 'id3',
          activeAt: 20,
          displayNameInProfile: 'C',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          expireTimer: 0,
          priority: CONVERSATION_PRIORITIES.default,
        },
        id4: {
          id: 'id4',
          activeAt: 20,
          displayNameInProfile: 'Á',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          expireTimer: 0,
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
        },
        id5: {
          id: 'id5',
          activeAt: 30,
          displayNameInProfile: 'First!',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          isPublic: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
        },
      };
      const comparator = _getConversationComparator(i18n);
      const conversations = _getSortedConversations(data, comparator);

      assert.strictEqual(conversations[0].displayNameInProfile, 'First!');
      assert.strictEqual(conversations[1].displayNameInProfile, 'Á');
      assert.strictEqual(conversations[2].displayNameInProfile, 'B');
      assert.strictEqual(conversations[3].displayNameInProfile, 'C');
    });
  });

  describe('#getSortedConversationsWithPinned', () => {
    it('sorts conversations based on pin, timestamp then by intl-friendly title', () => {
      const i18n = (key: string) => key;
      const data: ConversationLookupType = {
        id1: {
          id: 'id1',
          activeAt: 0,
          displayNameInProfile: 'No timestamp',

          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
          isPublic: false,
        },
        id2: {
          id: 'id2',
          activeAt: 20,
          displayNameInProfile: 'B',

          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],

          priority: CONVERSATION_PRIORITIES.default,
          isPublic: false,
        },
        id3: {
          id: 'id3',
          activeAt: 20,

          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          displayNameInProfile: 'C',

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.pinned,
          isPublic: false,
        },
        id4: {
          id: 'id4',
          activeAt: 20,
          displayNameInProfile: 'Á',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.pinned,
          isPublic: false,
        },
        id5: {
          id: 'id5',
          activeAt: 30,
          displayNameInProfile: 'First!',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          left: false,

          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
          isPublic: false,
        },
      };
      const comparator = _getConversationComparator(i18n);
      const conversations = _getSortedConversations(data, comparator);

      assert.strictEqual(conversations[0].displayNameInProfile, 'Á');
      assert.strictEqual(conversations[1].displayNameInProfile, 'C');
      assert.strictEqual(conversations[2].displayNameInProfile, 'First!');
      assert.strictEqual(conversations[3].displayNameInProfile, 'B');
    });
  });
});
