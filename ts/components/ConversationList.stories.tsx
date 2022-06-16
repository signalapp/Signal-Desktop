// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext } from 'react';
import { times, omit } from 'lodash';

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
import { makeFakeLookupConversationWithoutUuid } from '../test-both/helpers/fakeLookupConversationWithoutUuid';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ConversationList',
};

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
          sentAt={1587358800000}
          showConversation={action('showConversation')}
          snippet="Lorem <<left>>ipsum<<right>> wow"
          theme={ThemeType.light}
          to={defaultConversations[1]}
        />
      )}
      scrollable={scrollable}
      lookupConversationWithoutUuid={makeFakeLookupConversationWithoutUuid()}
      showChooseGroupMembers={action('showChooseGroupMembers')}
      showUserNotFoundModal={action('showUserNotFoundModal')}
      setIsFetchingUUID={action('setIsFetchingUUID')}
      showConversation={action('showConversation')}
      theme={theme}
    />
  );
};

export const _ArchiveButton = (): JSX.Element => (
  <Wrapper
    rows={[{ type: RowType.ArchiveButton, archivedConversationsCount: 123 }]}
  />
);

_ArchiveButton.story = {
  name: 'Archive button',
};

export const ContactNoteToSelf = (): JSX.Element => (
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
);

ContactNoteToSelf.story = {
  name: 'Contact: note to self',
};

export const ContactDirect = (): JSX.Element => (
  <Wrapper
    rows={[{ type: RowType.Contact, contact: defaultConversations[0] }]}
  />
);

ContactDirect.story = {
  name: 'Contact: direct',
};

export const ContactDirectWithShortAbout = (): JSX.Element => (
  <Wrapper
    rows={[
      {
        type: RowType.Contact,
        contact: { ...defaultConversations[0], about: '🤠 yee haw' },
      },
    ]}
  />
);

ContactDirectWithShortAbout.story = {
  name: 'Contact: direct with short about',
};

export const ContactDirectWithLongAbout = (): JSX.Element => (
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
);

ContactDirectWithLongAbout.story = {
  name: 'Contact: direct with long about',
};

export const ContactGroup = (): JSX.Element => (
  <Wrapper
    rows={[
      {
        type: RowType.Contact,
        contact: { ...defaultConversations[0], type: 'group' },
      },
    ]}
  />
);

ContactGroup.story = {
  name: 'Contact: group',
};

export const ContactCheckboxes = (): JSX.Element => (
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
);

ContactCheckboxes.story = {
  name: 'Contact checkboxes',
};

export const ContactCheckboxesDisabled = (): JSX.Element => (
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
);

ContactCheckboxesDisabled.story = {
  name: 'Contact checkboxes: disabled',
};

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

export const ConversationName = (): JSX.Element => renderConversation();

ConversationName.story = {
  name: 'Conversation: name',
};

export const ConversationNameAndAvatar = (): JSX.Element =>
  renderConversation({
    avatarPath: '/fixtures/kitten-1-64-64.jpg',
  });

ConversationNameAndAvatar.story = {
  name: 'Conversation: name and avatar',
};

export const ConversationWithYourself = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: 'Just a second',
      status: 'read',
      deletedForEveryone: false,
    },
    name: 'Myself',
    title: 'Myself',
    isMe: true,
  });

ConversationWithYourself.story = {
  name: 'Conversation: with yourself',
};

export const ConversationsMessageStatuses = (): JSX.Element => (
  <Wrapper
    rows={MessageStatuses.map(status => ({
      type: RowType.Conversation,
      conversation: createConversation({
        lastMessage: { text: status, status, deletedForEveryone: false },
      }),
    }))}
  />
);

ConversationsMessageStatuses.story = {
  name: 'Conversations: Message Statuses',
};

export const ConversationTypingStatus = (): JSX.Element =>
  renderConversation({
    typingContactId: UUID.generate().toString(),
  });

ConversationTypingStatus.story = {
  name: 'Conversation: Typing Status',
};

export const ConversationWithDraft = (): JSX.Element =>
  renderConversation({
    shouldShowDraft: true,
    draftPreview: "I'm in the middle of typing this...",
  });

ConversationWithDraft.story = {
  name: 'Conversation: With draft',
};

export const ConversationDeletedForEveryone = (): JSX.Element =>
  renderConversation({
    lastMessage: { deletedForEveryone: true },
  });

ConversationDeletedForEveryone.story = {
  name: 'Conversation: Deleted for everyone',
};

export const ConversationMessageRequest = (): JSX.Element =>
  renderConversation({
    acceptedMessageRequest: false,
    lastMessage: {
      text: 'A Message',
      status: 'delivered',
      deletedForEveryone: false,
    },
  });

ConversationMessageRequest.story = {
  name: 'Conversation: Message Request',
};

export const ConversationsUnreadCount = (): JSX.Element => (
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
);

ConversationsUnreadCount.story = {
  name: 'Conversations: unread count',
};

export const ConversationMarkedUnread = (): JSX.Element =>
  renderConversation({ markedUnread: true });

ConversationMarkedUnread.story = {
  name: 'Conversation: marked unread',
};

export const ConversationSelected = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: 'Hey there!',
      status: 'read',
      deletedForEveryone: false,
    },
    isSelected: true,
  });

ConversationSelected.story = {
  name: 'Conversation: Selected',
};

export const ConversationEmojiInMessage = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: '🔥',
      status: 'read',
      deletedForEveryone: false,
    },
  });

ConversationEmojiInMessage.story = {
  name: 'Conversation: Emoji in Message',
};

export const ConversationLinkInMessage = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: 'Download at http://signal.org',
      status: 'read',
      deletedForEveryone: false,
    },
  });

ConversationLinkInMessage.story = {
  name: 'Conversation: Link in Message',
};

export const ConversationLongName = (): JSX.Element => {
  const name =
    'Long contact name. Esquire. The third. And stuff. And more! And more!';

  return renderConversation({
    name,
    title: name,
  });
};

ConversationLongName.story = {
  name: 'Conversation: long name',
};

export const ConversationLongMessage = (): JSX.Element => {
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
};

ConversationLongMessage.story = {
  name: 'Conversation: Long Message',
};

export const ConversationsVariousTimes = (): JSX.Element => {
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
};

ConversationsVariousTimes.story = {
  name: 'Conversations: Various Times',
};

export const ConversationMissingDate = (): JSX.Element => {
  const row = {
    type: RowType.Conversation as const,
    conversation: omit(createConversation(), 'lastUpdated'),
  };

  return <Wrapper rows={[row]} />;
};

ConversationMissingDate.story = {
  name: 'Conversation: Missing Date',
};

export const ConversationMissingMessage = (): JSX.Element => {
  const row = {
    type: RowType.Conversation as const,
    conversation: omit(createConversation(), 'lastMessage'),
  };

  return <Wrapper rows={[row]} />;
};

ConversationMissingMessage.story = {
  name: 'Conversation: Missing Message',
};

export const ConversationMissingText = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: '',
      status: 'sent',
      deletedForEveryone: false,
    },
  });

ConversationMissingText.story = {
  name: 'Conversation: Missing Text',
};

export const ConversationMutedConversation = (): JSX.Element =>
  renderConversation({
    muteExpiresAt: Date.now() + 1000 * 60 * 60,
  });

ConversationMutedConversation.story = {
  name: 'Conversation: Muted Conversation',
};

export const ConversationAtMention = (): JSX.Element =>
  renderConversation({
    title: 'The Rebellion',
    type: 'group',
    lastMessage: {
      text: '@Leia Organa I know',
      status: 'read',
      deletedForEveryone: false,
    },
  });

ConversationAtMention.story = {
  name: 'Conversation: At Mention',
};

export const Headers = (): JSX.Element => (
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
      {
        type: RowType.Header,
        i18nKey: 'findByPhoneNumberHeader',
      },
    ]}
  />
);

export const FindByPhoneNumber = (): JSX.Element => (
  <Wrapper
    rows={[
      {
        type: RowType.Header,
        i18nKey: 'findByPhoneNumberHeader',
      },
      {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(234)555 98 76',
          e164: '+12345559876',
        },
        isFetching: false,
      },
      {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(234)555 98 76',
          e164: '+12345559876',
        },
        isFetching: true,
      },
      {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(234)555',
          e164: '+1234555',
        },
        isFetching: false,
      },
    ]}
  />
);

FindByPhoneNumber.story = {
  name: 'Find by phone number',
};

export const FindByUsername = (): JSX.Element => (
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
);

FindByUsername.story = {
  name: 'Find by username',
};

export const SearchResultsLoadingSkeleton = (): JSX.Element => (
  <Wrapper
    scrollable={false}
    rows={[
      { type: RowType.SearchResultsLoadingFakeHeader },
      ...times(99, () => ({
        type: RowType.SearchResultsLoadingFakeRow as const,
      })),
    ]}
  />
);

SearchResultsLoadingSkeleton.story = {
  name: 'Search results loading skeleton',
};

export const KitchenSink = (): JSX.Element => (
  <Wrapper
    rows={[
      {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(234)555 98 76',
          e164: '+12345559876',
        },
        isFetching: false,
      },
      {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(234)555 98 76',
          e164: '+12345559876',
        },
        isFetching: true,
      },
      {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: false,
          userInput: '+1(234)555 98',
          e164: '+123455598',
        },
        isFetching: true,
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
);

KitchenSink.story = {
  name: 'Kitchen sink',
};
