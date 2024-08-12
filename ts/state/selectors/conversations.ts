/* eslint-disable no-restricted-syntax */
import { createSelector } from '@reduxjs/toolkit';
import { filter, isEmpty, isFinite, isNumber, pick, sortBy, toNumber } from 'lodash';

import {
  ConversationLookupType,
  ConversationsStateType,
  lookupQuote,
  MentionsMembersType,
  MessageModelPropsWithConvoProps,
  MessageModelPropsWithoutConvoProps,
  PropsForQuote,
  QuoteLookupType,
  ReduxConversationType,
  SortedMessageModelProps,
} from '../ducks/conversations';
import { StateType } from '../reducer';

import { ReplyingToMessageProps } from '../../components/conversation/composition/CompositionBox';
import { MessageAttachmentSelectorProps } from '../../components/conversation/message/message-content/MessageAttachment';
import { MessageContentSelectorProps } from '../../components/conversation/message/message-content/MessageContent';
import { MessageContentWithStatusSelectorProps } from '../../components/conversation/message/message-content/MessageContentWithStatus';
import { MessageTextSelectorProps } from '../../components/conversation/message/message-content/MessageText';
import { GenericReadableMessageSelectorProps } from '../../components/conversation/message/message-item/GenericReadableMessage';
import { hasValidIncomingRequestValues } from '../../models/conversation';
import { isOpenOrClosedGroup } from '../../models/conversationAttributes';
import { getConversationController } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { LocalizerType } from '../../types/Util';
import { BlockedNumberController } from '../../util';
import { Storage } from '../../util/storage';
import { getIntl } from './user';

import { MessageReactsSelectorProps } from '../../components/conversation/message/message-content/MessageReactions';
import { processQuoteAttachment } from '../../models/message';
import { isUsAnySogsFromCache } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { PubKey } from '../../session/types';
import { getSelectedConversationKey } from './selectedConversation';
import { getModeratorsOutsideRedux } from './sogsRoomInfo';
import { CONVERSATION_PRIORITIES } from '../../models/types';

export const getConversations = (state: StateType): ConversationsStateType => state.conversations;

export const getConversationLookup = (state: StateType): ConversationLookupType => {
  return state.conversations.conversationLookup;
};

export const getConversationsCount = createSelector(getConversationLookup, (state): number => {
  return Object.keys(state).length;
});

const getConversationQuotes = (state: StateType): QuoteLookupType | undefined => {
  return state.conversations.quotes;
};

export const getOurPrimaryConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): ReduxConversationType =>
    state.conversationLookup[Storage.get('primaryDevicePubKey') as string]
);

const getMessagesOfSelectedConversation = (
  state: StateType
): Array<MessageModelPropsWithoutConvoProps> => state.conversations.messages;

// Redux recommends to do filtered and deriving state in a selector rather than ourself
export const getSortedMessagesOfSelectedConversation = createSelector(
  getMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): Array<SortedMessageModelProps> => {
    if (messages.length === 0) {
      return [];
    }

    const convoId = messages[0].propsForMessage.convoId;
    const convo = getConversationController().get(convoId);

    if (!convo) {
      return [];
    }

    const isPublic = convo.isPublic() || false;
    const sortedMessage = sortMessages(messages, isPublic);

    return updateFirstMessageOfSeries(sortedMessage);
  }
);

export const hasSelectedConversationIncomingMessages = createSelector(
  getSortedMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): boolean => {
    return messages.some(m => m.propsForMessage.direction === 'incoming');
  }
);

export const getFirstUnreadMessageId = (state: StateType): string | undefined => {
  return state.conversations.firstUnreadMessageId;
};

export type MessagePropsType =
  | 'group-notification'
  | 'group-invitation'
  | 'data-extraction'
  | 'message-request-response'
  | 'timer-notification'
  | 'regular-message'
  | 'unread-indicator'
  | 'call-notification'
  | 'interaction-notification';

export const getSortedMessagesTypesOfSelectedConversation = createSelector(
  getSortedMessagesOfSelectedConversation,
  getFirstUnreadMessageId,
  (sortedMessages, firstUnreadId) => {
    const maxMessagesBetweenTwoDateBreaks = 5;
    // we want to show the date break if there is a large jump in time
    // remember that messages are sorted from the most recent to the oldest
    return sortedMessages.map((msg, index) => {
      const isFirstUnread = Boolean(firstUnreadId === msg.propsForMessage.id);
      const messageTimestamp = msg.propsForMessage.serverTimestamp || msg.propsForMessage.timestamp;
      // do not show the date break if we are the oldest message (no previous)
      // this is to smooth a bit the loading of older message (to avoid a jump once new messages are rendered)
      const previousMessageTimestamp =
        index + 1 >= sortedMessages.length
          ? 0
          : sortedMessages[index + 1].propsForMessage.serverTimestamp ||
            sortedMessages[index + 1].propsForMessage.timestamp;

      const showDateBreak =
        messageTimestamp - previousMessageTimestamp > maxMessagesBetweenTwoDateBreaks * 60 * 1000
          ? messageTimestamp
          : undefined;

      const common = { showUnreadIndicator: isFirstUnread, showDateBreak };

      if (msg.propsForDataExtractionNotification) {
        return {
          ...common,
          message: {
            messageType: 'data-extraction',
            props: { ...msg.propsForDataExtractionNotification, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForMessageRequestResponse) {
        return {
          ...common,
          message: {
            messageType: 'message-request-response',
            props: { ...msg.propsForMessageRequestResponse, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForGroupInvitation) {
        return {
          ...common,
          message: {
            messageType: 'group-invitation',
            props: { ...msg.propsForGroupInvitation, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForGroupUpdateMessage) {
        return {
          ...common,
          message: {
            messageType: 'group-notification',
            props: { ...msg.propsForGroupUpdateMessage, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForTimerNotification) {
        return {
          ...common,
          message: {
            messageType: 'timer-notification',
            props: { ...msg.propsForTimerNotification, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForCallNotification) {
        return {
          ...common,
          message: {
            messageType: 'call-notification',
            props: {
              ...msg.propsForCallNotification,
              messageId: msg.propsForMessage.id,
            },
          },
        };
      }

      if (msg.propsForInteractionNotification) {
        return {
          ...common,
          message: {
            messageType: 'interaction-notification',
            props: {
              ...msg.propsForInteractionNotification,
              messageId: msg.propsForMessage.id,
            },
          },
        };
      }

      return {
        showUnreadIndicator: isFirstUnread,
        showDateBreak,
        message: {
          messageType: 'regular-message',
          props: { messageId: msg.propsForMessage.id },
        },
      };
    });
  }
);

function getConversationTitle(
  conversation: ReduxConversationType,
  testingi18n?: LocalizerType
): string {
  if (conversation.displayNameInProfile) {
    return conversation.displayNameInProfile;
  }

  if (isOpenOrClosedGroup(conversation.type)) {
    return (testingi18n || window.i18n)('unknown');
  }
  return conversation.id;
}

const collator = new Intl.Collator();

export const _getConversationComparator = (testingi18n?: LocalizerType) => {
  return (left: ReduxConversationType, right: ReduxConversationType): number => {
    // Pin is the first criteria to check
    const leftPriority = left.priority || 0;
    const rightPriority = right.priority || 0;
    if (leftPriority > rightPriority) {
      return -1;
    }
    if (rightPriority > leftPriority) {
      return 1;
    }
    // Then if none are pinned, check other criteria
    const leftActiveAt = left.activeAt;
    const rightActiveAt = right.activeAt;
    if (leftActiveAt && !rightActiveAt) {
      return -1;
    }
    if (rightActiveAt && !leftActiveAt) {
      return 1;
    }
    if (leftActiveAt && rightActiveAt && leftActiveAt !== rightActiveAt) {
      return rightActiveAt - leftActiveAt;
    }
    const leftTitle = getConversationTitle(left, testingi18n).toLowerCase();
    const rightTitle = getConversationTitle(right, testingi18n).toLowerCase();

    return collator.compare(leftTitle, rightTitle);
  };
};

export const getConversationComparator = createSelector(getIntl, _getConversationComparator);

const _getLeftPaneConversationIds = (
  sortedConversations: Array<ReduxConversationType>
): Array<string> => {
  return sortedConversations
    .filter(conversation => {
      if (conversation.isBlocked) {
        return false;
      }

      // a non private conversation is always returned here
      if (!conversation.isPrivate) {
        return true;
      }

      // a private conversation not approved is a message request. Exclude them from the left pane lists
      if (!conversation.isApproved) {
        return false;
      }

      // a hidden contact conversation is only visible from the contact list, not from the global conversation list
      if (conversation.priority && conversation.priority <= CONVERSATION_PRIORITIES.default) {
        return false;
      }

      return true;
    })
    .map(m => m.id);
};

const _getContacts = (
  sortedConversations: Array<ReduxConversationType>
): Array<ReduxConversationType> => {
  return sortedConversations.filter(convo => {
    // a private conversation not approved is a message request. Include them in the list of contacts
    return !convo.isBlocked && convo.isPrivate && !convo.isMe;
  });
};

const _getGlobalUnreadCount = (sortedConversations: Array<ReduxConversationType>): number => {
  let globalUnreadCount = 0;
  for (const conversation of sortedConversations) {
    // Blocked conversation are now only visible from the settings, not in the conversation list, so don't add it neither to the contacts list nor the conversation list
    if (conversation.isBlocked) {
      continue;
    }

    // a private conversation not approved is a message request. Exclude them from the unread count
    if (conversation.isPrivate && !conversation.isApproved) {
      continue;
    }

    // a hidden contact conversation is only visible from the contact list, not from the global conversation list
    if (
      conversation.isPrivate &&
      conversation.priority &&
      conversation.priority <= CONVERSATION_PRIORITIES.default
    ) {
      // dont increase unread counter, don't push to convo list.
      continue;
    }

    if (
      isNumber(conversation.unreadCount) &&
      isFinite(conversation.unreadCount) &&
      conversation.unreadCount > 0 &&
      conversation.currentNotificationSetting !== 'disabled'
    ) {
      globalUnreadCount += conversation.unreadCount;
    }
  }
  return globalUnreadCount;
};

export const _getSortedConversations = (
  lookup: ConversationLookupType,
  comparator: (left: ReduxConversationType, right: ReduxConversationType) => number
): Array<ReduxConversationType> => {
  const values = Object.values(lookup);
  const sorted = values.sort(comparator);

  const sortedConversations: Array<ReduxConversationType> = [];

  for (const conversation of sorted) {
    // Remove all invalid conversations and conversatons of devices associated
    //  with cancelled attempted links
    if (!conversation.isPublic && !conversation.activeAt) {
      continue;
    }

    const isBlocked = BlockedNumberController.isBlocked(conversation.id);

    sortedConversations.push({
      ...conversation,
      isBlocked: isBlocked || undefined,
    });
  }

  return sortedConversations;
};

export const getSortedConversations = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversationKey,
  _getSortedConversations
);

/**
 *
 * @param sortedConversations List of conversations that are valid for both requests and regular conversation inbox
 * @returns A list of message request conversations.
 */
const _getConversationRequests = (
  sortedConversations: Array<ReduxConversationType>
): Array<ReduxConversationType> => {
  return filter(sortedConversations, conversation => {
    const { isApproved, isBlocked, isPrivate, isMe, activeAt, didApproveMe } = conversation;
    const isIncomingRequest = hasValidIncomingRequestValues({
      isApproved: isApproved || false,
      isBlocked: isBlocked || false,
      isPrivate: isPrivate || false,
      isMe: isMe || false,
      activeAt: activeAt || 0,
      didApproveMe: didApproveMe || false,
    });
    return isIncomingRequest;
  });
};

export const getConversationRequests = createSelector(
  getSortedConversations,
  _getConversationRequests
);

export const getConversationRequestsIds = createSelector(getConversationRequests, requests =>
  requests.map(m => m.id)
);

export const hasConversationRequests = (state: StateType) => {
  return !!getConversationRequests(state).length;
};

const _getUnreadConversationRequests = (
  sortedConversationRequests: Array<ReduxConversationType>
): Array<ReduxConversationType> => {
  return filter(sortedConversationRequests, conversation => {
    return Boolean(conversation && conversation.unreadCount && conversation.unreadCount > 0);
  });
};

export const getUnreadConversationRequests = createSelector(
  getConversationRequests,
  _getUnreadConversationRequests
);

/**
 * Returns all the conversation ids of private conversations which are
 * - private
 * - not me
 * - not blocked
 * - approved (or message requests are disabled)
 * - active_at is set to something truthy
 */
export const getLeftPaneConversationIds = createSelector(
  getSortedConversations,
  _getLeftPaneConversationIds
);

export const getLeftPaneConversationIdsCount = createSelector(
  getLeftPaneConversationIds,
  (convoIds: Array<string>) => {
    return convoIds.length;
  }
);

/**
 * Returns all the conversation ids of contacts which are
 * - private
 * - not me
 * - not blocked
 */
const getContacts = createSelector(getSortedConversations, _getContacts);

export const getContactsCount = createSelector(
  getContacts,
  (contacts: Array<ReduxConversationType>) => contacts.length
);

export type DirectContactsByNameType = {
  displayName?: string;
  id: string;
};

// make sure that createSelector is called here so this function is memoized
export const getSortedContacts = createSelector(
  getContacts,
  (contacts: Array<ReduxConversationType>): Array<DirectContactsByNameType> => {
    const us = UserUtils.getOurPubKeyStrFromCache();
    const extractedContacts = contacts
      .filter(m => m.id !== us)
      .map(m => {
        return {
          id: m.id,
          displayName: m.nickname || m.displayNameInProfile,
        };
      });

    const contactsStartingWithANumber = sortBy(
      extractedContacts.filter(
        m => !m.displayName || (m.displayName && m.displayName[0].match(/^[0-9]+$/))
      ),
      m => m.displayName || m.id
    );

    const contactsWithDisplayName = sortBy(
      extractedContacts.filter(m => !!m.displayName && !m.displayName[0].match(/^[0-9]+$/)),
      m => m.displayName?.toLowerCase()
    );

    return [...contactsWithDisplayName, ...contactsStartingWithANumber];
  }
);

export const getSortedContactsWithBreaks = createSelector(
  getSortedContacts,
  (contacts: Array<DirectContactsByNameType>): Array<DirectContactsByNameType | string> => {
    // add a break wherever needed
    const unknownSection = 'unknown';
    let currentChar = '';
    // if the item is a string we consider it to be a break of that string
    const contactsWithBreaks: Array<DirectContactsByNameType | string> = [];

    contacts.forEach(m => {
      if (
        !!m.displayName &&
        m.displayName[0].toLowerCase() !== currentChar &&
        !m.displayName[0].match(/^[0-9]+$/)
      ) {
        currentChar = m.displayName[0].toLowerCase();
        contactsWithBreaks.push(currentChar.toUpperCase());
      } else if (
        ((m.displayName && m.displayName[0].match(/^[0-9]+$/)) || !m.displayName) &&
        currentChar !== unknownSection
      ) {
        currentChar = unknownSection;
        contactsWithBreaks.push('#');
      }

      contactsWithBreaks.push(m);
    });

    contactsWithBreaks.unshift({
      id: UserUtils.getOurPubKeyStrFromCache(),
      displayName: window.i18n('noteToSelf'),
    });

    return contactsWithBreaks;
  }
);

export const getPrivateContactsPubkeys = createSelector(getSortedContacts, state =>
  state.map(m => m.id)
);

export const getGlobalUnreadMessageCount = createSelector(
  getSortedConversations,
  _getGlobalUnreadCount
);

export const getMessageInfoId = (state: StateType) => state.conversations.messageInfoId;

export const isRightPanelShowing = (state: StateType): boolean =>
  state.conversations.showRightPanel;

export const isMessageSelectionMode = (state: StateType): boolean =>
  state.conversations.selectedMessageIds.length > 0;

export const getSelectedMessageIds = (state: StateType): Array<string> =>
  state.conversations.selectedMessageIds;

export const getIsMessageSelectionMode = (state: StateType): boolean =>
  Boolean(getSelectedMessageIds(state).length);

export const getQuotedMessage = (state: StateType): ReplyingToMessageProps | undefined =>
  state.conversations.quotedMessage;

export const areMoreMessagesBeingFetched = (state: StateType): boolean =>
  state.conversations.areMoreMessagesBeingFetched || false;

export const getShowScrollButton = (state: StateType): boolean =>
  state.conversations.showScrollButton || false;

export const getQuotedMessageToAnimate = (state: StateType): string | undefined =>
  state.conversations.animateQuotedMessageId || undefined;

export const getShouldHighlightMessage = (state: StateType): boolean =>
  Boolean(state.conversations.animateQuotedMessageId && state.conversations.shouldHighlightMessage);

export const getNextMessageToPlayId = (state: StateType): string | undefined =>
  state.conversations.nextMessageToPlayId || undefined;

export const getMentionsInput = (state: StateType): MentionsMembersType =>
  state.conversations.mentionMembers;

/// Those calls are just related to ordering messages in the redux store.

function updateFirstMessageOfSeries(
  messageModelsProps: Array<MessageModelPropsWithoutConvoProps>
): Array<SortedMessageModelProps> {
  // messages are got from the more recent to the oldest, so we need to check if
  // the next messages in the list is still the same author.
  // The message is the first of the series if the next message is not from the same author
  const sortedMessageProps: Array<SortedMessageModelProps> = [];

  for (let i = 0; i < messageModelsProps.length; i++) {
    const currentSender = messageModelsProps[i].propsForMessage?.sender;
    // most recent message is at index 0, so the previous message sender is 1+index
    const previousSender =
      i < messageModelsProps.length - 1
        ? messageModelsProps[i + 1].propsForMessage?.sender
        : undefined;
    const nextSender = i > 0 ? messageModelsProps[i - 1].propsForMessage?.sender : undefined;
    // Handle firstMessageOfSeries for conditional avatar rendering

    sortedMessageProps.push({
      ...messageModelsProps[i],
      firstMessageOfSeries: !(i >= 0 && currentSender === previousSender),
      lastMessageOfSeries: currentSender !== nextSender,
    });
  }
  return sortedMessageProps;
}

function sortMessages(
  messages: Array<MessageModelPropsWithoutConvoProps>,
  isPublic: boolean
): Array<MessageModelPropsWithoutConvoProps> {
  // we order by serverTimestamp for public convos
  // be sure to update the sorting order to fetch messages from the DB too at getMessagesByConversation
  if (isPublic) {
    return messages.slice().sort((a, b) => {
      return (b.propsForMessage.serverTimestamp || 0) - (a.propsForMessage.serverTimestamp || 0);
    });
  }
  if (messages.some(n => !n.propsForMessage.timestamp && !n.propsForMessage.receivedAt)) {
    throw new Error('Found some messages without any timestamp set');
  }

  // for non public convos, we order by sent_at or received_at timestamp.
  // we assume that a message has either a sent_at or a received_at field set.
  const messagesSorted = messages
    .slice()
    .sort(
      (a, b) =>
        (b.propsForMessage.timestamp || b.propsForMessage.receivedAt || 0) -
        (a.propsForMessage.timestamp || a.propsForMessage.receivedAt || 0)
    );

  return messagesSorted;
}

/**
 * This returns the most recent message id in the database. This is not the most recent message shown,
 * but the most recent one, which could still not be loaded.
 */
export const getMostRecentMessageId = (state: StateType): string | null => {
  return state.conversations.mostRecentMessageId;
};

export const getMostRecentOutgoingMessageId = createSelector(
  getSortedMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): string | undefined => {
    return messages.find(m => m.propsForMessage.direction === 'outgoing')?.propsForMessage.id;
  }
);

export const getOldestMessageId = createSelector(
  getSortedMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): string | undefined => {
    const oldest =
      messages.length > 0 ? messages[messages.length - 1].propsForMessage.id : undefined;

    return oldest;
  }
);

export const getYoungestMessageId = createSelector(
  getSortedMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): string | undefined => {
    const youngest = messages.length > 0 ? messages[0].propsForMessage.id : undefined;

    return youngest;
  }
);

function getMessagesFromState(state: StateType) {
  return state.conversations.messages;
}

export function getLoadedMessagesLength(state: StateType) {
  return getMessagesFromState(state).length;
}

export function getSelectedHasMessages(state: StateType): boolean {
  return !isEmpty(getMessagesFromState(state));
}

export const isFirstUnreadMessageIdAbove = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    if (!state.firstUnreadMessageId) {
      return false;
    }

    const isNotPresent = !state.messages.some(
      m => m.propsForMessage.id === state.firstUnreadMessageId
    );

    return isNotPresent;
  }
);

const getMessageId = (_whatever: any, id: string | undefined) => id;

/**
 * A lot of our UI changes on the main panel need to happen quickly (composition box).
 */
export const getSelectedConversation = createSelector(
  getConversationLookup,
  getSelectedConversationKey,
  (lookup, selectedConvo) => {
    return selectedConvo ? lookup[selectedConvo] : undefined;
  }
);

export const getMessagePropsByMessageId = createSelector(
  getSortedMessagesOfSelectedConversation,
  getSelectedConversation,
  getMessageId,
  (
    messages: Array<SortedMessageModelProps>,
    selectedConvo,
    id
  ): MessageModelPropsWithConvoProps | undefined => {
    if (!id) {
      return undefined;
    }
    const foundMessageProps: SortedMessageModelProps | undefined = messages?.find(
      m => m?.propsForMessage?.id === id
    );

    if (!foundMessageProps || !foundMessageProps.propsForMessage.convoId) {
      return undefined;
    }
    const sender = foundMessageProps?.propsForMessage?.sender;

    // we can only show messages when the convo is selected.
    if (!selectedConvo || !sender) {
      return undefined;
    }

    const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
    const isGroup = !selectedConvo.isPrivate;
    const isPublic = selectedConvo.isPublic;

    const groupAdmins = (isGroup && selectedConvo.groupAdmins) || [];
    const weAreAdmin = groupAdmins.includes(ourPubkey) || false;

    const weAreModerator =
      (isPublic && getModeratorsOutsideRedux(selectedConvo.id).includes(ourPubkey)) || false;
    // A message is deletable if
    // either we sent it,
    // or the convo is not a public one (in this case, we will only be able to delete for us)
    // or the convo is public and we are an admin or moderator
    const isDeletable =
      sender === ourPubkey || !isPublic || (isPublic && (weAreAdmin || weAreModerator));

    // A message is deletable for everyone if
    // either we sent it no matter what the conversation type,
    // or the convo is public and we are an admin or moderator
    const isDeletableForEveryone =
      sender === ourPubkey || (isPublic && (weAreAdmin || weAreModerator)) || false;

    const isSenderAdmin = groupAdmins.includes(sender);

    const messageProps: MessageModelPropsWithConvoProps = {
      ...foundMessageProps,
      propsForMessage: {
        ...foundMessageProps.propsForMessage,
        isBlocked: !!selectedConvo.isBlocked,
        isPublic: !!isPublic,
        isSenderAdmin,
        isDeletable,
        isDeletableForEveryone,
        weAreAdmin,
        conversationType: selectedConvo.type,
        sender,
        isKickedFromGroup: selectedConvo.isKickedFromGroup || false,
      },
    };

    return messageProps;
  }
);

export const getMessageReactsProps = createSelector(
  getMessagePropsByMessageId,
  (props): MessageReactsSelectorProps | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const msgProps: MessageReactsSelectorProps = pick(props.propsForMessage, [
      'convoId',
      'conversationType',
      'reacts',
      'serverId',
    ]);

    if (msgProps.reacts) {
      // NOTE we don't want to render reactions that have 'senders' as an object this is a deprecated type used during development 25/08/2022
      const oldReactions = Object.values(msgProps.reacts).filter(
        reaction => !Array.isArray(reaction.senders)
      );

      if (oldReactions.length > 0) {
        msgProps.reacts = undefined;
        return msgProps;
      }

      const sortedReacts = Object.entries(msgProps.reacts).sort((a, b) => {
        return a[1].index < b[1].index ? -1 : a[1].index > b[1].index ? 1 : 0;
      });
      msgProps.sortedReacts = sortedReacts;
    }

    return msgProps;
  }
);

export const getMessageQuoteProps = createSelector(
  getConversationLookup,
  getMessagesOfSelectedConversation,
  getConversationQuotes,
  getMessagePropsByMessageId,
  (
    conversationLookup,
    messagesProps,
    quotesProps,
    msgGlobalProps
  ): { quote: PropsForQuote } | undefined => {
    if (!msgGlobalProps || isEmpty(msgGlobalProps)) {
      return undefined;
    }

    const msgProps = msgGlobalProps.propsForMessage;

    if (!msgProps.quote || isEmpty(msgProps.quote)) {
      return undefined;
    }

    const { id } = msgProps.quote;
    let { author } = msgProps.quote;

    if (!id || !author) {
      return undefined;
    }

    const isFromMe = isUsAnySogsFromCache(author) || false;

    // NOTE the quote lookup map always stores our messages using the unblinded pubkey
    if (isFromMe && PubKey.isBlinded(author)) {
      author = UserUtils.getOurPubKeyStrFromCache();
    }

    // NOTE: if the message is not found, we still want to render the quote
    const quoteNotFound = {
      quote: {
        id,
        author,
        isFromMe,
        referencedMessageNotFound: true,
      },
    };

    if (!quotesProps || isEmpty(quotesProps)) {
      return quoteNotFound;
    }

    const sourceMessage = lookupQuote(quotesProps, messagesProps, toNumber(id), author);
    if (!sourceMessage) {
      return quoteNotFound;
    }

    const sourceMsgProps = sourceMessage.propsForMessage;
    if (!sourceMsgProps || sourceMsgProps.isDeleted) {
      return quoteNotFound;
    }

    const convo = conversationLookup[sourceMsgProps.convoId];
    if (!convo) {
      return quoteNotFound;
    }

    const attachment = sourceMsgProps.attachments && sourceMsgProps.attachments[0];

    const quote: PropsForQuote = {
      text: sourceMsgProps.text,
      attachment: attachment ? processQuoteAttachment(attachment) : undefined,
      isFromMe,
      author: sourceMsgProps.sender,
      id: sourceMsgProps.id,
      referencedMessageNotFound: false,
      convoId: convo.id,
    };

    return {
      quote,
    };
  }
);

export const getMessageTextProps = createSelector(
  getMessagePropsByMessageId,
  (props): MessageTextSelectorProps | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const msgProps: MessageTextSelectorProps = pick(props.propsForMessage, [
      'direction',
      'status',
      'text',
      'isDeleted',
      'conversationType',
    ]);

    return msgProps;
  }
);

export const getMessageAttachmentProps = createSelector(
  getMessagePropsByMessageId,
  (props): MessageAttachmentSelectorProps | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const msgProps: MessageAttachmentSelectorProps = {
      attachments: props.propsForMessage.attachments || [],
      ...pick(props.propsForMessage, [
        'direction',
        'isTrustedForAttachmentDownload',
        'timestamp',
        'serverTimestamp',
        'sender',
        'convoId',
      ]),
    };

    return msgProps;
  }
);

export const getIsMessageSelected = createSelector(
  getMessagePropsByMessageId,
  getSelectedMessageIds,
  (props, selectedIds): boolean => {
    if (!props || isEmpty(props)) {
      return false;
    }

    const { id } = props.propsForMessage;

    return selectedIds.includes(id);
  }
);

export const getMessageContentSelectorProps = createSelector(
  getMessagePropsByMessageId,
  (props): MessageContentSelectorProps | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const msgProps: MessageContentSelectorProps = {
      ...pick(props.propsForMessage, [
        'direction',
        'serverTimestamp',
        'text',
        'timestamp',
        'previews',
        'quote',
        'attachments',
      ]),
    };

    return msgProps;
  }
);

export const getMessageContentWithStatusesSelectorProps = createSelector(
  getMessagePropsByMessageId,
  (props): MessageContentWithStatusSelectorProps | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const isGroup =
      props.propsForMessage.conversationType !== 'private' && !props.propsForMessage.isPublic;

    const msgProps: MessageContentWithStatusSelectorProps = {
      ...pick(props.propsForMessage, ['conversationType', 'direction', 'isDeleted']),
      isGroup,
    };

    return msgProps;
  }
);

export const getGenericReadableMessageSelectorProps = createSelector(
  getMessagePropsByMessageId,
  (props): GenericReadableMessageSelectorProps | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const msgProps: GenericReadableMessageSelectorProps = pick(props.propsForMessage, [
      'convoId',
      'direction',
      'conversationType',
      'expirationDurationMs',
      'expirationTimestamp',
      'isExpired',
      'isUnread',
      'receivedAt',
      'isKickedFromGroup',
      'isDeleted',
    ]);

    return msgProps;
  }
);

export const getOldTopMessageId = (state: StateType): string | null =>
  state.conversations.oldTopMessageId || null;

export const getOldBottomMessageId = (state: StateType): string | null =>
  state.conversations.oldBottomMessageId || null;

export const getIsSelectedConvoInitialLoadingInProgress = (state: StateType): boolean =>
  Boolean(getSelectedConversation(state)?.isInitialFetchingInProgress);

export function getCurrentlySelectedConversationOutsideRedux() {
  return window?.inboxStore?.getState().conversations.selectedConversation as string | undefined;
}
