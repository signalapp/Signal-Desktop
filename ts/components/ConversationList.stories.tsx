// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext } from 'react';
import { times, omit } from 'lodash';
import { v4 as generateUuid } from 'uuid';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Row, PropsType } from './ConversationList';
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
import { makeFakeLookupConversationWithoutServiceId } from '../test-both/helpers/fakeLookupConversationWithoutServiceId';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ConversationList',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

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

function Wrapper({
  rows,
  scrollable,
}: Readonly<{ rows: ReadonlyArray<Row>; scrollable?: boolean }>) {
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
      blockConversation={action('blockConversation')}
      onPreloadConversation={action('onPreloadConversation')}
      onSelectConversation={action('onSelectConversation')}
      onOutgoingAudioCallInConversation={action(
        'onOutgoingAudioCallInConversation'
      )}
      onOutgoingVideoCallInConversation={action(
        'onOutgoingVideoCallInConversation'
      )}
      onClickArchiveButton={action('onClickArchiveButton')}
      onClickClearFilterButton={action('onClickClearFilterButton')}
      onClickContactCheckbox={action('onClickContactCheckbox')}
      removeConversation={action('removeConversation')}
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
      lookupConversationWithoutServiceId={makeFakeLookupConversationWithoutServiceId()}
      showChooseGroupMembers={action('showChooseGroupMembers')}
      showFindByUsername={action('showFindByUsername')}
      showFindByPhoneNumber={action('showFindByPhoneNumber')}
      showUserNotFoundModal={action('showUserNotFoundModal')}
      setIsFetchingUUID={action('setIsFetchingUUID')}
      showConversation={action('showConversation')}
      theme={theme}
    />
  );
}

export function ArchiveButton(): JSX.Element {
  return (
    <Wrapper
      rows={[{ type: RowType.ArchiveButton, archivedConversationsCount: 123 }]}
    />
  );
}

export function ContactNoteToSelf(): JSX.Element {
  return (
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
}

export function ContactDirect(): JSX.Element {
  return (
    <Wrapper
      rows={[{ type: RowType.Contact, contact: defaultConversations[0] }]}
    />
  );
}

export function ContactInSystemContacts(): JSX.Element {
  const contact = defaultConversations[0];
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Contact,
          contact: { ...contact, systemGivenName: contact.title },
        },
      ]}
    />
  );
}

export function ContactDirectWithContextMenu(): JSX.Element {
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Contact,
          contact: defaultConversations[0],
          hasContextMenu: true,
        },
      ]}
    />
  );
}

export function ContactDirectWithShortAbout(): JSX.Element {
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Contact,
          contact: { ...defaultConversations[0], about: '🤠 yee haw' },
        },
      ]}
    />
  );
}

export function ContactDirectWithLongAbout(): JSX.Element {
  return (
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
}

export function ContactGroup(): JSX.Element {
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Contact,
          contact: { ...defaultConversations[0], type: 'group' },
        },
      ]}
    />
  );
}

export function ContactCheckboxes(): JSX.Element {
  return (
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
}

export function ContactCheckboxesDisabled(): JSX.Element {
  return (
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
}

const createConversation = (
  overrideProps: Partial<ConversationListItemPropsType> = {}
): ConversationListItemPropsType => ({
  ...overrideProps,
  acceptedMessageRequest:
    overrideProps.acceptedMessageRequest !== undefined
      ? overrideProps.acceptedMessageRequest
      : true,
  badges: [],
  isMe: overrideProps.isMe ?? false,
  avatarUrl: overrideProps.avatarUrl ?? '',
  id: overrideProps.id || '',
  isSelected: overrideProps.isSelected ?? false,
  title: overrideProps.title ?? 'Some Person',
  profileName: overrideProps.profileName || 'Some Person',
  type: overrideProps.type || 'direct',
  markedUnread: overrideProps.markedUnread ?? false,
  lastMessage: overrideProps.lastMessage || {
    text: 'Hi there!',
    status: 'read',
    deletedForEveryone: false,
  },
  lastUpdated: overrideProps.lastUpdated ?? Date.now() - 5 * 60 * 1000,
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

export const ConversationNameAndAvatar = (): JSX.Element =>
  renderConversation({
    avatarUrl: '/fixtures/kitten-1-64-64.jpg',
  });

export const ConversationWithYourself = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: 'Just a second',
      status: 'read',
      deletedForEveryone: false,
    },
    profileName: 'Myself',
    title: 'Myself',
    isMe: true,
  });

export function ConversationsMessageStatuses(): JSX.Element {
  return (
    <Wrapper
      rows={MessageStatuses.map(status => ({
        type: RowType.Conversation,
        conversation: createConversation({
          lastMessage: { text: status, status, deletedForEveryone: false },
        }),
      }))}
    />
  );
}

export const ConversationTypingStatus = (): JSX.Element =>
  renderConversation({
    typingContactIdTimestamps: {
      [generateUuid()]: Date.now(),
    },
  });

export const ConversationWithDraft = (): JSX.Element =>
  renderConversation({
    shouldShowDraft: true,
    draftPreview: {
      text: "I'm in the middle of typing this...",
      prefix: '🎤',
      bodyRanges: [],
    },
  });

export const ConversationDeletedForEveryone = (): JSX.Element =>
  renderConversation({
    lastMessage: { deletedForEveryone: true },
  });

export const ConversationMessageRequest = (): JSX.Element =>
  renderConversation({
    acceptedMessageRequest: false,
    lastMessage: {
      text: 'A Message',
      status: 'delivered',
      deletedForEveryone: false,
    },
  });

export function ConversationsUnreadCount(): JSX.Element {
  return (
    <Wrapper
      rows={[4, 10, 34, 250, 2048].map(unreadCount => ({
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
}

export const ConversationMarkedUnread = (): JSX.Element =>
  renderConversation({ markedUnread: true });

export const ConversationSelected = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: 'Hey there!',
      status: 'read',
      deletedForEveryone: false,
    },
    isSelected: true,
  });

export const ConversationEmojiInMessage = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: '🔥',
      status: 'read',
      deletedForEveryone: false,
    },
  });

export const ConversationLinkInMessage = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: 'Download at http://signal.org',
      status: 'read',
      deletedForEveryone: false,
    },
  });

export const ConversationLongName = (): JSX.Element => {
  const name =
    'Long contact name. Esquire. The third. And stuff. And more! And more!';

  return renderConversation({
    title: name,
  });
};

export function ConversationLongMessage(): JSX.Element {
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
}

export function ConversationsVariousTimes(): JSX.Element {
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
}

export function ConversationMissingDate(): JSX.Element {
  const row = {
    type: RowType.Conversation as const,
    conversation: omit(createConversation(), 'lastUpdated'),
  };

  return <Wrapper rows={[row]} />;
}

export function ConversationMissingMessage(): JSX.Element {
  const row = {
    type: RowType.Conversation as const,
    conversation: omit(createConversation(), 'lastMessage'),
  };

  return <Wrapper rows={[row]} />;
}

export const ConversationMissingText = (): JSX.Element =>
  renderConversation({
    lastMessage: {
      text: '',
      status: 'sent',
      deletedForEveryone: false,
    },
  });

export const ConversationMutedConversation = (): JSX.Element =>
  renderConversation({
    muteExpiresAt: Date.now() + 1000 * 60 * 60,
  });

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

export function Headers(): JSX.Element {
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:conversationsHeader'),
        },
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:messagesHeader'),
        },
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:findByUsernameHeader'),
        },
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:findByPhoneNumberHeader'),
        },
      ]}
    />
  );
}

export function FindByPhoneNumber(): JSX.Element {
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:findByPhoneNumberHeader'),
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
}

export function FindByUsername(): JSX.Element {
  return (
    <Wrapper
      rows={[
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:findByUsernameHeader'),
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
}

export function SearchResultsLoadingSkeleton(): JSX.Element {
  return (
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
}

export function KitchenSink(): JSX.Element {
  return (
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
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:contactsHeader'),
        },
        {
          type: RowType.Contact,
          contact: defaultConversations[0],
        },
        {
          type: RowType.Header,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:messagesHeader'),
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
          // eslint-disable-next-line @typescript-eslint/no-shadow
          getHeaderText: i18n => i18n('icu:findByUsernameHeader'),
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
}
