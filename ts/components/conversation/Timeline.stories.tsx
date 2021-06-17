// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as moment from 'moment';
import { isBoolean, times } from 'lodash';
import { v4 as uuid } from 'uuid';
import { storiesOf } from '@storybook/react';
import { text, boolean, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { PropsType, Timeline } from './Timeline';
import { TimelineItem, TimelineItemType } from './TimelineItem';
import { ConversationHero } from './ConversationHero';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { LastSeenIndicator } from './LastSeenIndicator';
import { TimelineLoadingRow } from './TimelineLoadingRow';
import { TypingBubble } from './TypingBubble';
import { ContactSpoofingType } from '../../util/contactSpoofing';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/Timeline', module);

// eslint-disable-next-line
const noop = () => {};

Object.assign(window, {
  registerForActive: noop,
  unregisterForActive: noop,
});

const items: Record<string, TimelineItemType> = {
  'id-1': {
    type: 'message',
    data: {
      author: getDefaultConversation({
        phoneNumber: '(202) 555-2001',
        color: 'forest',
      }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'forest',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'incoming',
      id: 'id-1',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      text: '🔥',
      timestamp: Date.now(),
    },
  },
  'id-2': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'forest' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'forest',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'incoming',
      id: 'id-2',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      text: 'Hello there from the new world! http://somewhere.com',
      timestamp: Date.now(),
    },
  },
  'id-2.5': {
    type: 'unsupportedMessage',
    data: {
      id: 'id-2.5',
      canProcessNow: false,
      contact: {
        id: '061d3783-5736-4145-b1a2-6b6cf1156393',
        isMe: false,
        phoneNumber: '(202) 555-1000',
        profileName: 'Mr. Pig',
        title: 'Mr. Pig',
      },
    },
  },
  'id-3': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'crimson' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'crimson',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'incoming',
      id: 'id-3',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      text: 'Hello there from the new world!',
      timestamp: Date.now(),
    },
  },
  'id-4': {
    type: 'timerNotification',
    data: {
      disabled: false,
      expireTimer: moment.duration(2, 'hours').asSeconds(),
      title: "It's Me",
      type: 'fromMe',
    },
  },
  'id-5': {
    type: 'timerNotification',
    data: {
      disabled: false,
      expireTimer: moment.duration(2, 'hours').asSeconds(),
      phoneNumber: '(202) 555-0000',
      title: '(202) 555-0000',
      type: 'fromOther',
    },
  },
  'id-6': {
    type: 'safetyNumberNotification',
    data: {
      contact: {
        id: '+1202555000',
        phoneNumber: '(202) 555-0000',
        profileName: 'Mr. Fire',
        title: 'Mr. Fire',
      },
      isGroup: true,
    },
  },
  'id-7': {
    type: 'verificationNotification',
    data: {
      contact: {
        name: 'Mrs. Ice',
        phoneNumber: '(202) 555-0001',
        title: 'Mrs. Ice',
      },
      isLocal: true,
      type: 'markVerified',
    },
  },
  'id-8': {
    type: 'groupNotification',
    data: {
      changes: [
        {
          type: 'name',
          newName: 'Squirrels and their uses',
        },
        {
          type: 'add',
          contacts: [
            {
              phoneNumber: '(202) 555-0002',
              profileName: 'Mr. Fire',
              title: 'Mr. Fire',
            },
            {
              phoneNumber: '(202) 555-0003',
              profileName: 'Ms. Water',
              title: 'Ms. Water',
            },
          ],
        },
      ],
      from: {
        phoneNumber: '(202) 555-0001',
        name: 'Mrs. Ice',
        title: 'Mrs. Ice',
        isMe: false,
      },
    },
  },
  'id-9': {
    type: 'resetSessionNotification',
    data: null,
  },
  'id-10': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'plum' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'plum',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'outgoing',
      id: 'id-6',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      status: 'sent',
      text: '🔥',
      timestamp: Date.now(),
    },
  },
  'id-11': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'plum' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'crimson',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'outgoing',
      id: 'id-7',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      status: 'read',
      text: 'Hello there from the new world! http://somewhere.com',
      timestamp: Date.now(),
    },
  },
  'id-12': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'crimson' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'crimson',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'outgoing',
      id: 'id-8',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      status: 'sent',
      text: 'Hello there from the new world! 🔥',
      timestamp: Date.now(),
    },
  },
  'id-13': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'blue' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'crimson',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'outgoing',
      id: 'id-9',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      status: 'sent',
      text:
        'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
      timestamp: Date.now(),
    },
  },
  'id-14': {
    type: 'message',
    data: {
      author: getDefaultConversation({ color: 'crimson' }),
      canDeleteForEveryone: false,
      canDownload: true,
      canReply: true,
      conversationColor: 'crimson',
      conversationId: 'conversation-id',
      conversationType: 'group',
      direction: 'outgoing',
      id: 'id-10',
      isBlocked: false,
      isMessageRequestAccepted: true,
      previews: [],
      status: 'read',
      text:
        'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
      timestamp: Date.now(),
    },
  },
  'id-15': {
    type: 'linkNotification',
    data: null,
  },
};

const actions = () => ({
  acknowledgeGroupMemberNameCollisions: action(
    'acknowledgeGroupMemberNameCollisions'
  ),
  checkForAccount: action('checkForAccount'),
  clearChangedMessages: action('clearChangedMessages'),
  clearInvitedConversationsForNewlyCreatedGroup: action(
    'clearInvitedConversationsForNewlyCreatedGroup'
  ),
  setLoadCountdownStart: action('setLoadCountdownStart'),
  setIsNearBottom: action('setIsNearBottom'),
  loadAndScroll: action('loadAndScroll'),
  loadOlderMessages: action('loadOlderMessages'),
  loadNewerMessages: action('loadNewerMessages'),
  loadNewestMessages: action('loadNewestMessages'),
  markMessageRead: action('markMessageRead'),
  selectMessage: action('selectMessage'),
  clearSelectedMessage: action('clearSelectedMessage'),
  updateSharedGroups: action('updateSharedGroups'),

  reactToMessage: action('reactToMessage'),
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  showMessageDetail: action('showMessageDetail'),
  openConversation: action('openConversation'),
  showContactDetail: action('showContactDetail'),
  showContactModal: action('showContactModal'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  showVisualAttachment: action('showVisualAttachment'),
  downloadAttachment: action('downloadAttachment'),
  displayTapToViewMessage: action('displayTapToViewMessage'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),

  onHeightChange: action('onHeightChange'),
  openLink: action('openLink'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredOutgoingTapToViewToast'
  ),
  showForwardMessageModal: action('showForwardMessageModal'),

  showIdentity: action('showIdentity'),

  downloadNewVersion: action('downloadNewVersion'),

  messageSizeChanged: action('messageSizeChanged'),
  startCallingLobby: action('startCallingLobby'),
  returnToActiveCall: action('returnToActiveCall'),

  contactSupport: action('contactSupport'),

  closeContactSpoofingReview: action('closeContactSpoofingReview'),
  reviewGroupMemberNameCollision: action('reviewGroupMemberNameCollision'),
  reviewMessageRequestNameCollision: action(
    'reviewMessageRequestNameCollision'
  ),

  onBlock: action('onBlock'),
  onBlockAndReportSpam: action('onBlockAndReportSpam'),
  onDelete: action('onDelete'),
  onUnblock: action('onUnblock'),
  removeMember: action('removeMember'),

  unblurAvatar: action('unblurAvatar'),
});

const renderItem = (id: string) => (
  <TimelineItem
    id=""
    isSelected={false}
    renderEmojiPicker={() => <div />}
    item={items[id]}
    i18n={i18n}
    interactionMode="keyboard"
    conversationId=""
    conversationAccepted
    renderContact={() => '*ContactName*'}
    renderUniversalTimerNotification={() => (
      <div>*UniversalTimerNotification*</div>
    )}
    renderAudioAttachment={() => <div>*AudioAttachment*</div>}
    {...actions()}
  />
);

const renderLastSeenIndicator = () => (
  <LastSeenIndicator count={2} i18n={i18n} />
);

const getAbout = () => text('about', '👍 Free to chat');
const getTitle = () => text('name', 'Cayce Bollard');
const getName = () => text('name', 'Cayce Bollard');
const getProfileName = () => text('profileName', 'Cayce Bollard (profile)');
const getAvatarPath = () =>
  text('avatarPath', '/fixtures/kitten-4-112-112.jpg');
const getPhoneNumber = () => text('phoneNumber', '+1 (808) 555-1234');

const renderHeroRow = () => (
  <ConversationHero
    about={getAbout()}
    acceptedMessageRequest
    i18n={i18n}
    isMe={false}
    title={getTitle()}
    avatarPath={getAvatarPath()}
    name={getName()}
    profileName={getProfileName()}
    phoneNumber={getPhoneNumber()}
    conversationType="direct"
    sharedGroupNames={['NYC Rock Climbers', 'Dinner Party']}
    unblurAvatar={action('unblurAvatar')}
    updateSharedGroups={noop}
  />
);
const renderLoadingRow = () => <TimelineLoadingRow state="loading" />;
const renderTypingBubble = () => (
  <TypingBubble
    acceptedMessageRequest
    color="crimson"
    conversationType="direct"
    phoneNumber="+18005552222"
    i18n={i18n}
    isMe={false}
    title="title"
    sharedGroupNames={[]}
  />
);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,

  haveNewest: boolean('haveNewest', overrideProps.haveNewest !== false),
  haveOldest: boolean('haveOldest', overrideProps.haveOldest !== false),
  isIncomingMessageRequest: boolean(
    'isIncomingMessageRequest',
    overrideProps.isIncomingMessageRequest === true
  ),
  isLoadingMessages: boolean(
    'isLoadingMessages',
    overrideProps.isLoadingMessages === false
  ),
  items: overrideProps.items || Object.keys(items),
  resetCounter: 0,
  scrollToIndex: overrideProps.scrollToIndex,
  scrollToIndexCounter: 0,
  totalUnread: number('totalUnread', overrideProps.totalUnread || 0),
  oldestUnreadIndex:
    number('oldestUnreadIndex', overrideProps.oldestUnreadIndex || 0) ||
    undefined,
  invitedContactsForNewlyCreatedGroup:
    overrideProps.invitedContactsForNewlyCreatedGroup || [],
  warning: overrideProps.warning,

  id: uuid(),
  renderItem,
  renderLastSeenIndicator,
  renderHeroRow,
  renderLoadingRow,
  renderTypingBubble,
  typingContact: boolean(
    'typingContact',
    isBoolean(overrideProps.typingContact) ? overrideProps.typingContact : false
  ),

  ...actions(),
});

story.add('Oldest and Newest', () => {
  const props = createProps();

  return <Timeline {...props} />;
});

story.add('With active message request', () => {
  const props = createProps({
    isIncomingMessageRequest: true,
  });

  return <Timeline {...props} />;
});

story.add('Without Newest Message', () => {
  const props = createProps({
    haveNewest: false,
  });

  return <Timeline {...props} />;
});

story.add('Without newest message, active message request', () => {
  const props = createProps({
    haveOldest: false,
    isIncomingMessageRequest: true,
  });

  return <Timeline {...props} />;
});

story.add('Without Oldest Message', () => {
  const props = createProps({
    haveOldest: false,
    scrollToIndex: -1,
  });

  return <Timeline {...props} />;
});

story.add('Empty (just hero)', () => {
  const props = createProps({
    items: [],
  });

  return <Timeline {...props} />;
});

story.add('Last Seen', () => {
  const props = createProps({
    oldestUnreadIndex: 13,
    totalUnread: 2,
  });

  return <Timeline {...props} />;
});

story.add('Target Index to Top', () => {
  const props = createProps({
    scrollToIndex: 0,
  });

  return <Timeline {...props} />;
});

story.add('Typing Indicator', () => {
  const props = createProps({
    typingContact: true,
  });

  return <Timeline {...props} />;
});

story.add('With invited contacts for a newly-created group', () => {
  const props = createProps({
    invitedContactsForNewlyCreatedGroup: [
      getDefaultConversation({
        id: 'abc123',
        title: 'John Bon Bon Jovi',
      }),
      getDefaultConversation({
        id: 'def456',
        title: 'Bon John Bon Jovi',
      }),
    ],
  });

  return <Timeline {...props} />;
});

story.add('With "same name in direct conversation" warning', () => {
  const props = createProps({
    warning: {
      type: ContactSpoofingType.DirectConversationWithSameTitle,
      safeConversation: getDefaultConversation(),
    },
    items: [],
  });

  return <Timeline {...props} />;
});

story.add('With "same name in group conversation" warning', () => {
  const props = createProps({
    warning: {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
      acknowledgedGroupNameCollisions: {},
      groupNameCollisions: {
        Alice: times(2, () => uuid()),
        Bob: times(3, () => uuid()),
      },
    },
    items: [],
  });

  return <Timeline {...props} />;
});
