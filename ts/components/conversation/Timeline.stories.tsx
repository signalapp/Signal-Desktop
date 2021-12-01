// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as moment from 'moment';
import { times } from 'lodash';
import { v4 as uuid } from 'uuid';
import { storiesOf } from '@storybook/react';
import { text, boolean, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './Timeline';
import { Timeline } from './Timeline';
import type { TimelineItemType } from './TimelineItem';
import { TimelineItem } from './TimelineItem';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import { ConversationHero } from './ConversationHero';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { getRandomColor } from '../../test-both/helpers/getRandomColor';
import { LastSeenIndicator } from './LastSeenIndicator';
import { TimelineLoadingRow } from './TimelineLoadingRow';
import { TypingBubble } from './TypingBubble';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { ReadStatus } from '../../messages/MessageReadStatus';
import type { WidthBreakpoint } from '../_util';
import { ThemeType } from '../../types/Util';
import { UUID } from '../../types/UUID';

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
      readStatus: ReadStatus.Read,
      text: '🔥',
      timestamp: Date.now(),
    },
  },
  'id-2': {
    type: 'message',
    data: {
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
      text: 'Hello there from the new world! http://somewhere.com',
      timestamp: Date.now(),
    },
  },
  'id-2.5': {
    type: 'unsupportedMessage',
    data: {
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
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
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
      title: '(202) 555-0000',
      type: 'fromOther',
    },
  },
  'id-6': {
    type: 'safetyNumberNotification',
    data: {
      contact: {
        id: '+1202555000',
        title: 'Mr. Fire',
      },
      isGroup: true,
    },
  },
  'id-7': {
    type: 'verificationNotification',
    data: {
      contact: { title: 'Mrs. Ice' },
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
            getDefaultConversation({
              phoneNumber: '(202) 555-0002',
              title: 'Mr. Fire',
            }),
            getDefaultConversation({
              phoneNumber: '(202) 555-0003',
              title: 'Ms. Water',
            }),
          ],
        },
      ],
      from: getDefaultConversation({
        phoneNumber: '(202) 555-0001',
        title: 'Mrs. Ice',
        isMe: false,
      }),
    },
  },
  'id-9': {
    type: 'resetSessionNotification',
    data: null,
  },
  'id-10': {
    type: 'message',
    data: {
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
      status: 'sent',
      text: '🔥',
      timestamp: Date.now(),
    },
  },
  'id-11': {
    type: 'message',
    data: {
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
      status: 'read',
      text: 'Hello there from the new world! http://somewhere.com',
      timestamp: Date.now(),
    },
  },
  'id-12': {
    type: 'message',
    data: {
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
      status: 'sent',
      text: 'Hello there from the new world! 🔥',
      timestamp: Date.now(),
    },
  },
  'id-13': {
    type: 'message',
    data: {
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
      status: 'sent',
      text: 'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
      timestamp: Date.now(),
    },
  },
  'id-14': {
    type: 'message',
    data: {
      author: getDefaultConversation({}),
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
      readStatus: ReadStatus.Read,
      status: 'read',
      text: 'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
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
  clearInvitedUuidsForNewlyCreatedGroup: action(
    'clearInvitedUuidsForNewlyCreatedGroup'
  ),
  setLoadCountdownStart: action('setLoadCountdownStart'),
  setIsNearBottom: action('setIsNearBottom'),
  learnMoreAboutDeliveryIssue: action('learnMoreAboutDeliveryIssue'),
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
  markViewed: action('markViewed'),
  messageExpanded: action('messageExpanded'),
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

const renderItem = ({
  messageId,
  containerElementRef,
  containerWidthBreakpoint,
}: {
  messageId: string;
  containerElementRef: React.RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
}) => (
  <TimelineItem
    getPreferredBadge={() => undefined}
    id=""
    isSelected={false}
    renderEmojiPicker={() => <div />}
    renderReactionPicker={() => <div />}
    item={items[messageId]}
    previousItem={undefined}
    nextItem={undefined}
    i18n={i18n}
    interactionMode="keyboard"
    theme={ThemeType.light}
    containerElementRef={containerElementRef}
    containerWidthBreakpoint={containerWidthBreakpoint}
    conversationId=""
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

const renderHeroRow = () => {
  const Wrapper = () => {
    const theme = React.useContext(StorybookThemeContext);
    return (
      <ConversationHero
        about={getAbout()}
        acceptedMessageRequest
        badge={undefined}
        i18n={i18n}
        isMe={false}
        title={getTitle()}
        avatarPath={getAvatarPath()}
        name={getName()}
        profileName={getProfileName()}
        phoneNumber={getPhoneNumber()}
        conversationType="direct"
        onHeightChange={action('onHeightChange in ConversationHero')}
        sharedGroupNames={['NYC Rock Climbers', 'Dinner Party']}
        theme={theme}
        unblurAvatar={action('unblurAvatar')}
        updateSharedGroups={noop}
      />
    );
  };
  return <Wrapper />;
};
const renderLoadingRow = () => <TimelineLoadingRow state="loading" />;
const renderTypingBubble = () => (
  <TypingBubble
    acceptedMessageRequest
    badge={undefined}
    color={getRandomColor()}
    conversationType="direct"
    phoneNumber="+18005552222"
    i18n={i18n}
    isMe={false}
    title="title"
    theme={ThemeType.light}
    sharedGroupNames={[]}
  />
);

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  getPreferredBadge: () => undefined,
  i18n,
  theme: React.useContext(StorybookThemeContext),

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
  typingContactId: overrideProps.typingContactId,

  ...actions(),
});

story.add('Oldest and Newest', () => {
  const props = useProps();

  return <Timeline {...props} />;
});

story.add('With active message request', () => {
  const props = useProps({
    isIncomingMessageRequest: true,
  });

  return <Timeline {...props} />;
});

story.add('Without Newest Message', () => {
  const props = useProps({
    haveNewest: false,
  });

  return <Timeline {...props} />;
});

story.add('Without newest message, active message request', () => {
  const props = useProps({
    haveOldest: false,
    isIncomingMessageRequest: true,
  });

  return <Timeline {...props} />;
});

story.add('Without Oldest Message', () => {
  const props = useProps({
    haveOldest: false,
    scrollToIndex: -1,
  });

  return <Timeline {...props} />;
});

story.add('Empty (just hero)', () => {
  const props = useProps({
    items: [],
  });

  return <Timeline {...props} />;
});

story.add('Last Seen', () => {
  const props = useProps({
    oldestUnreadIndex: 13,
    totalUnread: 2,
  });

  return <Timeline {...props} />;
});

story.add('Target Index to Top', () => {
  const props = useProps({
    scrollToIndex: 0,
  });

  return <Timeline {...props} />;
});

story.add('Typing Indicator', () => {
  const props = useProps({
    typingContactId: UUID.generate().toString(),
  });

  return <Timeline {...props} />;
});

story.add('With invited contacts for a newly-created group', () => {
  const props = useProps({
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
  const props = useProps({
    warning: {
      type: ContactSpoofingType.DirectConversationWithSameTitle,
      safeConversation: getDefaultConversation(),
    },
    items: [],
  });

  return <Timeline {...props} />;
});

story.add('With "same name in group conversation" warning', () => {
  const props = useProps({
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
