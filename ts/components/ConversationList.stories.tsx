// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext } from 'react';
import { times, omit } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, date, select, text } from '@storybook/addon-knobs';

import type { Row } from './ConversationList';
import { ConversationList, RowType } from './ConversationList';
import { MessageSearchResult } from './conversationList/MessageSearchResult';
import type { PropsData as ConversationListItemPropsType } from './conversationList/ConversationListItem';
import { MessageStatuses } from './conversationList/ConversationListItem';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { ThemeType } from '../types/Util';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { UUID } from '../types/UUID';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/ConversationList', module);

const defaultConversations: Array<ConversationListItemPropsType> = [
  getDefaultConversation({
    id: 'fred-convo',
    title: 'Fred Willard',
  }),
  getDefaultConversation({
    id: 'marc-convo',
    isSelected: true,
    unreadCount: 12,
    title: 'Marc Barraca',
    lastMessage: {
      deletedForEveryone: false,
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget libero egestas mattis sit amet vitae augue. Nam tincidunt congue enim, ut porta lorem lacinia consectetur. Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean ut gravida lorem. Ut turpis felis, pulvinar a semper sed, adipiscing id dolor. Pellentesque auctor nisi id magna consequat sagittis. Curabitur dapibus enim sit amet elit pharetra tincidunt feugiat nisl imperdiet. Ut convallis libero in urna ultrices accumsan. Donec sed odio eros. Donec viverra mi quis quam pulvinar at malesuada arcu rhoncus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. In rutrum accumsan ultricies. Mauris vitae nisi at sem facilisis semper ac in est.',
    },
  }),
  getDefaultConversation({
    id: 'long-name-convo',
    title:
      'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
  }),
  getDefaultConversation(),
];

const Wrapper = ({
  rows,
  scrollable,
}: Readonly<{ rows: ReadonlyArray<Row>; scrollable?: boolean }>) => {
  const theme = useContext(StorybookThemeContext);

  return (
    <ConversationList
      dimensions={{
        width: 300,
        height: 350,
      }}
      rowCount={rows.length}
      getPreferredBadge={() => undefined}
      getRow={(index: number) => rows[index]}
      shouldRecomputeRowHeights={false}
      i18n={i18n}
      onSelectConversation={action('onSelectConversation')}
      onClickArchiveButton={action('onClickArchiveButton')}
      onClickContactCheckbox={action('onClickContactCheckbox')}
      renderMessageSearchResult={(id: string) => (
        <MessageSearchResult
          body="Lorem ipsum wow"
          bodyRanges={[]}
          conversationId="marc-convo"
          from={defaultConversations[0]}
          getPreferredBadge={() => undefined}
          i18n={i18n}
          id={id}
          openConversationInternal={action('openConversationInternal')}
          sentAt={1587358800000}
          snippet="Lorem <<left>>ipsum<<right>> wow"
          theme={ThemeType.light}
          to={defaultConversations[1]}
        />
      )}
      scrollable={scrollable}
      showChooseGroupMembers={action('showChooseGroupMembers')}
      startNewConversationFromPhoneNumber={action(
        'startNewConversationFromPhoneNumber'
      )}
      startNewConversationFromUsername={action(
        'startNewConversationFromUsername'
      )}
      theme={theme}
    />
  );
};

story.add('Archive button', () => (
  <Wrapper
    rows={[{ type: RowType.ArchiveButton, archivedConversationsCount: 123 }]}
  />
));

story.add('Contact: note to self', () => (
  <Wrapper
    rows={[
      {
        type: RowType.Contact,
        contact: {
          ...defaultConversations[0],
          isMe: true,
          about: '🤠 should be ignored',
        },
      },
    ]}
  />
));

story.add('Contact: direct', () => (
  <Wrapper
    rows={[{ type: RowType.Contact, contact: defaultConversations[0] }]}
  />
));

story.add('Contact: direct with short about', () => (
  <Wrapper
    rows={[
      {
        type: RowType.Contact,
        contact: { ...defaultConversations[0], about: '🤠 yee haw' },
      },
    ]}
  />
));

story.add('Contact: direct with long about', () => (
  <Wrapper
    rows={[
      {
        type: RowType.Contact,
        contact: {
          ...defaultConversations[0],
          about:
            '🤠 Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget libero egestas mattis sit amet vitae augue.',
        },
      },
    ]}
  />
));

story.add('Contact: group', () => (
  <Wrapper
    rows={[
      {
        type: RowType.Contact,
        contact: { ...defaultConversations[0], type: 'group' },
      },
    ]}
  />
));

story.add('Contact checkboxes', () => (
  <Wrapper
    rows={[
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
    ]}
  />
));

story.add('Contact checkboxes: disabled', () => (
  <Wrapper
    rows={[
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
    ]}
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
    badges: [],
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
      deletedForEveryone: false,
    },
    lastUpdated: date(
      'lastUpdated',
      new Date(overrideProps.lastUpdated || Date.now() - 5 * 60 * 1000)
    ),
    sharedGroupNames: [],
  });

  const renderConversation = (
    overrideProps: Partial<ConversationListItemPropsType> = {}
  ) => (
    <Wrapper
      rows={[
        {
          type: RowType.Conversation,
          conversation: createConversation(overrideProps),
        },
      ]}
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
        deletedForEveryone: false,
      },
      name: 'Myself',
      title: 'Myself',
      isMe: true,
    })
  );

  story.add('Conversations: Message Statuses', () => (
    <Wrapper
      rows={MessageStatuses.map(status => ({
        type: RowType.Conversation,
        conversation: createConversation({
          lastMessage: { text: status, status, deletedForEveryone: false },
        }),
      }))}
    />
  ));

  story.add('Conversation: Typing Status', () =>
    renderConversation({
      typingContactId: UUID.generate().toString(),
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
      lastMessage: { deletedForEveryone: true },
    })
  );

  story.add('Conversation: Message Request', () =>
    renderConversation({
      acceptedMessageRequest: false,
      lastMessage: {
        text: 'A Message',
        status: 'delivered',
        deletedForEveryone: false,
      },
    })
  );

  story.add('Conversations: unread count', () => (
    <Wrapper
      rows={[4, 10, 34, 250].map(unreadCount => ({
        type: RowType.Conversation,
        conversation: createConversation({
          lastMessage: {
            text: 'Hey there!',
            status: 'delivered',
            deletedForEveryone: false,
          },
          unreadCount,
        }),
      }))}
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
        deletedForEveryone: false,
      },
      isSelected: true,
    })
  );

  story.add('Conversation: Emoji in Message', () =>
    renderConversation({
      lastMessage: {
        text: '🔥',
        status: 'read',
        deletedForEveryone: false,
      },
    })
  );

  story.add('Conversation: Link in Message', () =>
    renderConversation({
      lastMessage: {
        text: 'Download at http://signal.org',
        status: 'read',
        deletedForEveryone: false,
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
      <Wrapper
        rows={messages.map(messageText => ({
          type: RowType.Conversation,
          conversation: createConversation({
            lastMessage: {
              text: messageText,
              status: 'read',
              deletedForEveryone: false,
            },
          }),
        }))}
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
      <Wrapper
        rows={pairs.map(([lastUpdated, messageText]) => ({
          type: RowType.Conversation,
          conversation: createConversation({
            lastUpdated,
            lastMessage: {
              text: messageText,
              status: 'read',
              deletedForEveryone: false,
            },
          }),
        }))}
      />
    );
  });

  story.add('Conversation: Missing Date', () => {
    const row = {
      type: RowType.Conversation as const,
      conversation: omit(createConversation(), 'lastUpdated'),
    };

    return <Wrapper rows={[row]} />;
  });

  story.add('Conversation: Missing Message', () => {
    const row = {
      type: RowType.Conversation as const,
      conversation: omit(createConversation(), 'lastMessage'),
    };

    return <Wrapper rows={[row]} />;
  });

  story.add('Conversation: Missing Text', () =>
    renderConversation({
      lastMessage: {
        text: '',
        status: 'sent',
        deletedForEveryone: false,
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
        deletedForEveryone: false,
      },
    })
  );
}

story.add('Headers', () => (
  <Wrapper
    rows={[
      {
        type: RowType.Header,
        i18nKey: 'conversationsHeader',
      },
      {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
      },
      {
        type: RowType.Header,
        i18nKey: 'findByUsernameHeader',
      },
    ]}
  />
));

story.add('Start new conversation', () => (
  <Wrapper
    rows={[
      {
        type: RowType.StartNewConversation,
        phoneNumber: '+12345559876',
      },
    ]}
  />
));

story.add('Find by username', () => (
  <Wrapper
    rows={[
      {
        type: RowType.Header,
        i18nKey: 'findByUsernameHeader',
      },
      {
        type: RowType.UsernameSearchResult,
        username: 'jowerty',
        isFetchingUsername: false,
      },
      {
        type: RowType.UsernameSearchResult,
        username: 'jowerty',
        isFetchingUsername: true,
      },
    ]}
  />
));

story.add('Search results loading skeleton', () => (
  <Wrapper
    scrollable={false}
    rows={[
      { type: RowType.SearchResultsLoadingFakeHeader },
      ...times(99, () => ({
        type: RowType.SearchResultsLoadingFakeRow as const,
      })),
    ]}
  />
));

story.add('Kitchen sink', () => (
  <Wrapper
    rows={[
      {
        type: RowType.StartNewConversation,
        phoneNumber: '+12345559876',
      },
      {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      },
      {
        type: RowType.Contact,
        contact: defaultConversations[0],
      },
      {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
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
        type: RowType.Header,
        i18nKey: 'findByUsernameHeader',
      },
      {
        type: RowType.UsernameSearchResult,
        username: 'jowerty',
        isFetchingUsername: false,
      },
      {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 123,
      },
    ]}
  />
));
