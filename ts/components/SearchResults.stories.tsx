// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { SearchResults } from './SearchResults';
import {
  MessageSearchResult,
  PropsDataType as MessageSearchResultPropsType,
} from './MessageSearchResult';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import {
  gifUrl,
  landscapeGreenUrl,
  landscapePurpleUrl,
  pngUrl,
} from '../storybook/Fixtures';

const i18n = setupI18n('en', enMessages);

const messageLookup: Map<string, MessageSearchResultPropsType> = new Map();

const CONTACT = 'contact' as const;
const CONTACTS_HEADER = 'contacts-header' as const;
const CONVERSATION = 'conversation' as const;
const CONVERSATIONS_HEADER = 'conversations-header' as const;
const DIRECT = 'direct' as const;
const GROUP = 'group' as const;
const MESSAGE = 'message' as const;
const MESSAGES_HEADER = 'messages-header' as const;
const SENT = 'sent' as const;
const START_NEW_CONVERSATION = 'start-new-conversation' as const;
const SMS_MMS_NOT_SUPPORTED = 'sms-mms-not-supported-text' as const;

messageLookup.set('1-guid-guid-guid-guid-guid', {
  id: '1-guid-guid-guid-guid-guid',
  conversationId: '(202) 555-0015',
  sentAt: Date.now() - 5 * 60 * 1000,
  snippet: '<<left>>Everyone<<right>>! Get in!',

  from: {
    phoneNumber: '(202) 555-0020',
    title: '(202) 555-0020',
    isMe: true,
    color: 'blue',
    avatarPath: gifUrl,
  },
  to: {
    phoneNumber: '(202) 555-0015',
    title: 'Mr. Fire 🔥',
    name: 'Mr. Fire 🔥',
  },
});

messageLookup.set('2-guid-guid-guid-guid-guid', {
  id: '2-guid-guid-guid-guid-guid',
  conversationId: '(202) 555-0016',
  sentAt: Date.now() - 20 * 60 * 1000,
  snippet: 'Why is <<left>>everyone<<right>> so frustrated?',
  from: {
    phoneNumber: '(202) 555-0016',
    name: 'Jon ❄️',
    title: 'Jon ❄️',
    color: 'green',
  },
  to: {
    phoneNumber: '(202) 555-0020',
    title: '(202) 555-0020',
    isMe: true,
  },
});

messageLookup.set('3-guid-guid-guid-guid-guid', {
  id: '3-guid-guid-guid-guid-guid',
  conversationId: 'EveryoneGroupID',
  sentAt: Date.now() - 24 * 60 * 1000,
  snippet: 'Hello, <<left>>everyone<<right>>! Woohooo!',
  from: {
    phoneNumber: '(202) 555-0011',
    name: 'Someone',
    title: 'Someone',
    color: 'green',
    avatarPath: pngUrl,
  },
  to: {
    phoneNumber: '(202) 555-0016',
    name: "Y'all 🌆",
    title: "Y'all 🌆",
  },
});

messageLookup.set('4-guid-guid-guid-guid-guid', {
  id: '4-guid-guid-guid-guid-guid',
  conversationId: 'EveryoneGroupID',
  sentAt: Date.now() - 24 * 60 * 1000,
  snippet: 'Well, <<left>>everyone<<right>>, happy new year!',
  from: {
    phoneNumber: '(202) 555-0020',
    title: '(202) 555-0020',
    isMe: true,
    color: 'light_green',
    avatarPath: gifUrl,
  },
  to: {
    phoneNumber: '(202) 555-0016',
    name: "Y'all 🌆",
    title: "Y'all 🌆",
  },
});

const defaultProps = {
  discussionsLoading: false,
  height: 700,
  items: [],
  i18n,
  messagesLoading: false,
  noResults: false,
  openConversationInternal: action('open-conversation-internal'),
  regionCode: 'US',
  renderMessageSearchResult(id: string): JSX.Element {
    const messageProps = messageLookup.get(id) as MessageSearchResultPropsType;

    return (
      <MessageSearchResult
        {...messageProps}
        i18n={i18n}
        openConversationInternal={action(
          'MessageSearchResult-open-conversation-internal'
        )}
      />
    );
  },
  searchConversationName: undefined,
  searchTerm: '1234567890',
  selectedConversationId: undefined,
  selectedMessageId: undefined,
  startNewConversation: action('start-new-conversation'),
  width: 320,
};

const conversations = [
  {
    type: CONVERSATION,
    data: {
      id: '+12025550011',
      phoneNumber: '(202) 555-0011',
      name: 'Everyone 🌆',
      title: 'Everyone 🌆',
      type: GROUP,
      color: 'signal-blue' as const,
      avatarPath: landscapeGreenUrl,
      isMe: false,
      lastUpdated: Date.now() - 5 * 60 * 1000,
      unreadCount: 0,
      isSelected: false,
      lastMessage: {
        text: 'The rabbit hopped silently in the night.',
        status: SENT,
      },
      markedUnread: false,
    },
  },
  {
    type: CONVERSATION,
    data: {
      id: '+12025550012',
      phoneNumber: '(202) 555-0012',
      name: 'Everyone Else 🔥',
      title: 'Everyone Else 🔥',
      color: 'pink' as const,
      type: DIRECT,
      avatarPath: landscapePurpleUrl,
      isMe: false,
      lastUpdated: Date.now() - 5 * 60 * 1000,
      unreadCount: 0,
      isSelected: false,
      lastMessage: {
        text: "What's going on?",
        status: SENT,
      },
      markedUnread: false,
    },
  },
];

const contacts = [
  {
    type: CONTACT,
    data: {
      id: '+12025550013',
      phoneNumber: '(202) 555-0013',
      name: 'The one Everyone',
      title: 'The one Everyone',
      color: 'blue' as const,
      type: DIRECT,
      avatarPath: gifUrl,
      isMe: false,
      lastUpdated: Date.now() - 10 * 60 * 1000,
      unreadCount: 0,
      isSelected: false,
      markedUnread: false,
    },
  },
  {
    type: CONTACT,
    data: {
      id: '+12025550014',
      phoneNumber: '(202) 555-0014',
      name: 'No likey everyone',
      title: 'No likey everyone',
      type: DIRECT,
      color: 'red' as const,
      isMe: false,
      lastUpdated: Date.now() - 11 * 60 * 1000,
      unreadCount: 0,
      isSelected: false,
      markedUnread: false,
    },
  },
];

const messages = [
  {
    type: MESSAGE,
    data: '1-guid-guid-guid-guid-guid',
  },
  {
    type: MESSAGE,
    data: '2-guid-guid-guid-guid-guid',
  },
  {
    type: MESSAGE,
    data: '3-guid-guid-guid-guid-guid',
  },
  {
    type: MESSAGE,
    data: '4-guid-guid-guid-guid-guid',
  },
];

const messagesMany = Array.from(Array(100), (_, i) => messages[i % 4]);

const permutations = [
  {
    title: 'SMS/MMS Not Supported Text',
    props: {
      items: [
        {
          type: START_NEW_CONVERSATION,
          data: undefined,
        },
        {
          type: SMS_MMS_NOT_SUPPORTED,
          data: undefined,
        },
      ],
    },
  },
  {
    title: 'All Result Types',
    props: {
      items: [
        {
          type: CONVERSATIONS_HEADER,
          data: undefined,
        },
        ...conversations,
        {
          type: CONTACTS_HEADER,
          data: undefined,
        },
        ...contacts,
        {
          type: MESSAGES_HEADER,
          data: undefined,
        },
        ...messages,
      ],
    },
  },
  {
    title: 'Start new Conversation',
    props: {
      items: [
        {
          type: START_NEW_CONVERSATION,
          data: undefined,
        },
        {
          type: CONVERSATIONS_HEADER,
          data: undefined,
        },
        ...conversations,
        {
          type: CONTACTS_HEADER,
          data: undefined,
        },
        ...contacts,
        {
          type: MESSAGES_HEADER,
          data: undefined,
        },
        ...messages,
      ],
    },
  },
  {
    title: 'No Conversations',
    props: {
      items: [
        {
          type: CONTACTS_HEADER,
          data: undefined,
        },
        ...contacts,
        {
          type: MESSAGES_HEADER,
          data: undefined,
        },
        ...messages,
      ],
    },
  },
  {
    title: 'No Contacts',
    props: {
      items: [
        {
          type: CONVERSATIONS_HEADER,
          data: undefined,
        },
        ...conversations,
        {
          type: MESSAGES_HEADER,
          data: undefined,
        },
        ...messages,
      ],
    },
  },
  {
    title: 'No Messages',
    props: {
      items: [
        {
          type: CONVERSATIONS_HEADER,
          data: undefined,
        },
        ...conversations,
        {
          type: CONTACTS_HEADER,
          data: undefined,
        },
        ...contacts,
      ],
    },
  },
  {
    title: 'No Results',
    props: {
      noResults: true,
    },
  },
  {
    title: 'No Results, Searching in Conversation',
    props: {
      noResults: true,
      searchInConversationName: 'Everyone 🔥',
      searchTerm: 'something',
    },
  },
  {
    title: 'Searching in Conversation no search term',
    props: {
      noResults: true,
      searchInConversationName: 'Everyone 🔥',
      searchTerm: '',
    },
  },
  {
    title: 'Lots of results',
    props: {
      items: [
        {
          type: CONVERSATIONS_HEADER,
          data: undefined,
        },
        ...conversations,
        {
          type: CONTACTS_HEADER,
          data: undefined,
        },
        ...contacts,
        {
          type: MESSAGES_HEADER,
          data: undefined,
        },
        ...messagesMany,
      ],
    },
  },
  {
    title: 'Messages, no header',
    props: {
      items: messages,
    },
  },
];

storiesOf('Components/SearchResults', module).add('Iterations', () => {
  return permutations.map(({ props, title }) => (
    <>
      <h3>{title}</h3>
      <div className="module-left-pane">
        <SearchResults {...defaultProps} {...props} />
      </div>
      <hr />
    </>
  ));
});
