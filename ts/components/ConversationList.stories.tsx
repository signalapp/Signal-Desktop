// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times, omit } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, date, select, text } from '@storybook/addon-knobs';

import { ConversationList, PropsType, RowType, Row } from './ConversationList';
import { MessageSearchResult } from './conversationList/MessageSearchResult';
import {
  PropsData as ConversationListItemPropsType,
  MessageStatuses,
} from './conversationList/ConversationListItem';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/ConversationList', module);

const defaultConversations: Array<ConversationListItemPropsType> = [
  {
    id: 'fred-convo',
    isSelected: false,
    lastUpdated: Date.now(),
    markedUnread: false,
    title: 'Fred Willard',
    type: 'direct',
  },
  {
    id: 'marc-convo',
    isSelected: true,
    lastUpdated: Date.now(),
    markedUnread: false,
    unreadCount: 12,
    title: 'Marc Barraca',
    type: 'direct',
  },
  {
    id: 'long-name-convo',
    isSelected: false,
    lastUpdated: Date.now(),
    markedUnread: false,
    title:
      'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
    type: 'direct',
  },
  getDefaultConversation(),
];

const createProps = (rows: ReadonlyArray<Row>): PropsType => ({
  dimensions: {
    width: 300,
    height: 350,
  },
  rowCount: rows.length,
  getRow: (index: number) => rows[index],
  shouldRecomputeRowHeights: false,
  i18n,
  onSelectConversation: action('onSelectConversation'),
  onClickArchiveButton: action('onClickArchiveButton'),
  onClickContactCheckbox: action('onClickContactCheckbox'),
  renderMessageSearchResult: (id: string, style: React.CSSProperties) => (
    <MessageSearchResult
      body="Lorem ipsum wow"
      bodyRanges={[]}
      conversationId="marc-convo"
      from={defaultConversations[0]}
      i18n={i18n}
      id={id}
      openConversationInternal={action('openConversationInternal')}
      sentAt={1587358800000}
      snippet="Lorem <<left>>ipsum<<right>> wow"
      style={style}
      to={defaultConversations[1]}
    />
  ),
  showChooseGroupMembers: action('showChooseGroupMembers'),
  startNewConversationFromPhoneNumber: action(
    'startNewConversationFromPhoneNumber'
  ),
});

story.add('Archive button', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 123,
      },
    ])}
  />
));

story.add('Contact: note to self', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.Contact,
        contact: {
          ...defaultConversations[0],
          isMe: true,
          about: '🤠 should be ignored',
        },
      },
    ])}
  />
));

story.add('Contact: direct', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.Contact,
        contact: defaultConversations[0],
      },
    ])}
  />
));

story.add('Contact: direct with short about', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.Contact,
        contact: { ...defaultConversations[0], about: '🤠 yee haw' },
      },
    ])}
  />
));

story.add('Contact: direct with long about', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.Contact,
        contact: {
          ...defaultConversations[0],
          about:
            '🤠 Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget libero egestas mattis sit amet vitae augue.',
        },
      },
    ])}
  />
));

story.add('Contact: group', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.Contact,
        contact: { ...defaultConversations[0], type: 'group' },
      },
    ])}
  />
));

story.add('Contact checkboxes', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.ContactCheckbox,
        contact: defaultConversations[0],
        isChecked: true,
      },
      {
        type: RowType.ContactCheckbox,
        contact: defaultConversations[1],
        isChecked: false,
      },
      {
        type: RowType.ContactCheckbox,
        contact: {
          ...defaultConversations[2],
          about: '😃 Hola',
        },
        isChecked: true,
      },
    ])}
  />
));

story.add('Contact checkboxes: disabled', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.ContactCheckbox,
        contact: defaultConversations[0],
        isChecked: false,
        disabledReason: ContactCheckboxDisabledReason.MaximumContactsSelected,
      },
      {
        type: RowType.ContactCheckbox,
        contact: defaultConversations[1],
        isChecked: false,
        disabledReason: ContactCheckboxDisabledReason.NotCapable,
      },
      {
        type: RowType.ContactCheckbox,
        contact: defaultConversations[2],
        isChecked: true,
        disabledReason: ContactCheckboxDisabledReason.MaximumContactsSelected,
      },
      {
        type: RowType.ContactCheckbox,
        contact: defaultConversations[3],
        isChecked: true,
        disabledReason: ContactCheckboxDisabledReason.AlreadyAdded,
      },
    ])}
  />
));

{
  const createConversation = (
    overrideProps: Partial<ConversationListItemPropsType> = {}
  ): ConversationListItemPropsType => ({
    ...overrideProps,
    acceptedMessageRequest: boolean(
      'acceptedMessageRequest',
      overrideProps.acceptedMessageRequest !== undefined
        ? overrideProps.acceptedMessageRequest
        : true
    ),
    isMe: boolean('isMe', overrideProps.isMe || false),
    avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
    id: overrideProps.id || '',
    isSelected: boolean('isSelected', overrideProps.isSelected || false),
    title: text('title', overrideProps.title || 'Some Person'),
    name: overrideProps.name || 'Some Person',
    type: overrideProps.type || 'direct',
    markedUnread: boolean('markedUnread', overrideProps.markedUnread || false),
    lastMessage: overrideProps.lastMessage || {
      text: text('lastMessage.text', 'Hi there!'),
      status: select(
        'status',
        MessageStatuses.reduce((m, s) => ({ ...m, [s]: s }), {}),
        'read'
      ),
    },
    lastUpdated: date(
      'lastUpdated',
      new Date(overrideProps.lastUpdated || Date.now() - 5 * 60 * 1000)
    ),
  });

  const renderConversation = (
    overrideProps: Partial<ConversationListItemPropsType> = {}
  ) => (
    <ConversationList
      {...createProps([
        {
          type: RowType.Conversation,
          conversation: createConversation(overrideProps),
        },
      ])}
    />
  );

  story.add('Conversation: name', () => renderConversation());

  story.add('Conversation: name and avatar', () =>
    renderConversation({
      avatarPath: '/fixtures/kitten-1-64-64.jpg',
    })
  );

  story.add('Conversation: with yourself', () =>
    renderConversation({
      lastMessage: {
        text: 'Just a second',
        status: 'read',
      },
      name: 'Myself',
      title: 'Myself',
      isMe: true,
    })
  );

  story.add('Conversations: Message Statuses', () => (
    <ConversationList
      {...createProps(
        MessageStatuses.map(status => ({
          type: RowType.Conversation,
          conversation: createConversation({
            lastMessage: { text: status, status },
          }),
        }))
      )}
    />
  ));

  story.add('Conversation: Typing Status', () =>
    renderConversation({
      typingContact: {
        name: 'Someone Here',
      },
    })
  );

  story.add('Conversation: With draft', () =>
    renderConversation({
      shouldShowDraft: true,
      draftPreview: "I'm in the middle of typing this...",
    })
  );

  story.add('Conversation: Deleted for everyone', () =>
    renderConversation({
      lastMessage: {
        status: 'sent',
        text: 'You should not see this!',
        deletedForEveryone: true,
      },
    })
  );

  story.add('Conversation: Message Request', () =>
    renderConversation({
      acceptedMessageRequest: false,
      lastMessage: {
        text: 'A Message',
        status: 'delivered',
      },
    })
  );

  story.add('Conversations: unread count', () => (
    <ConversationList
      {...createProps(
        [4, 10, 250].map(unreadCount => ({
          type: RowType.Conversation,
          conversation: createConversation({
            lastMessage: { text: 'Hey there!', status: 'delivered' },
            unreadCount,
          }),
        }))
      )}
    />
  ));

  story.add('Conversation: marked unread', () =>
    renderConversation({ markedUnread: true })
  );

  story.add('Conversation: Selected', () =>
    renderConversation({
      lastMessage: {
        text: 'Hey there!',
        status: 'read',
      },
      isSelected: true,
    })
  );

  story.add('Conversation: Emoji in Message', () =>
    renderConversation({
      lastMessage: {
        text: '🔥',
        status: 'read',
      },
    })
  );

  story.add('Conversation: Link in Message', () =>
    renderConversation({
      lastMessage: {
        text: 'Download at http://signal.org',
        status: 'read',
      },
    })
  );

  story.add('Conversation: long name', () => {
    const name =
      'Long contact name. Esquire. The third. And stuff. And more! And more!';

    return renderConversation({
      name,
      title: name,
    });
  });

  story.add('Conversation: Long Message', () => {
    const messages = [
      "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      `Many lines. This is a many-line message.
Line 2 is really exciting but it shouldn't be seen.
Line three is even better.
Line 4, well.`,
    ];

    return (
      <ConversationList
        {...createProps(
          messages.map(messageText => ({
            type: RowType.Conversation,
            conversation: createConversation({
              lastMessage: {
                text: messageText,
                status: 'read',
              },
            }),
          }))
        )}
      />
    );
  });

  story.add('Conversations: Various Times', () => {
    const pairs: Array<[number, string]> = [
      [Date.now() - 5 * 60 * 60 * 1000, 'Five hours ago'],
      [Date.now() - 24 * 60 * 60 * 1000, 'One day ago'],
      [Date.now() - 7 * 24 * 60 * 60 * 1000, 'One week ago'],
      [Date.now() - 365 * 24 * 60 * 60 * 1000, 'One year ago'],
    ];

    return (
      <ConversationList
        {...createProps(
          pairs.map(([lastUpdated, messageText]) => ({
            type: RowType.Conversation,
            conversation: createConversation({
              lastUpdated,
              lastMessage: {
                text: messageText,
                status: 'read',
              },
            }),
          }))
        )}
      />
    );
  });

  story.add('Conversation: Missing Date', () => {
    const row = {
      type: RowType.Conversation as const,
      conversation: omit(createConversation(), 'lastUpdated'),
    };

    return <ConversationList {...createProps([row])} />;
  });

  story.add('Conversation: Missing Message', () => {
    const row = {
      type: RowType.Conversation as const,
      conversation: omit(createConversation(), 'lastMessage'),
    };

    return <ConversationList {...createProps([row])} />;
  });

  story.add('Conversation: Missing Text', () =>
    renderConversation({
      lastMessage: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text: undefined as any,
        status: 'sent',
      },
    })
  );

  story.add('Conversation: Muted Conversation', () =>
    renderConversation({
      muteExpiresAt: Date.now() + 1000 * 60 * 60,
    })
  );

  story.add('Conversation: At Mention', () =>
    renderConversation({
      title: 'The Rebellion',
      type: 'group',
      lastMessage: {
        text: '@Leia Organa I know',
        status: 'read',
      },
    })
  );
}

story.add('Headers', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.Header,
        i18nKey: 'conversationsHeader',
      },
      {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
      },
    ])}
  />
));

story.add('Start new conversation', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.StartNewConversation,
        phoneNumber: '+12345559876',
      },
    ])}
  />
));

story.add('Search results loading skeleton', () => (
  <ConversationList
    scrollable={false}
    {...createProps([
      { type: RowType.SearchResultsLoadingFakeHeader },
      ...times(99, () => ({
        type: RowType.SearchResultsLoadingFakeRow as const,
      })),
    ])}
  />
));

story.add('Kitchen sink', () => (
  <ConversationList
    {...createProps([
      {
        type: RowType.StartNewConversation,
        phoneNumber: '+12345559876',
      },
      {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
      },
      {
        type: RowType.Contact,
        contact: defaultConversations[0],
      },
      {
        type: RowType.Conversation,
        conversation: defaultConversations[1],
      },
      {
        type: RowType.MessageSearchResult,
        messageId: '123',
      },
      {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 123,
      },
    ])}
  />
));
