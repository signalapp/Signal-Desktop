// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { v4 as uuid } from 'uuid';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import { DurationInSeconds } from '../../util/durations';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './Timeline';
import { Timeline } from './Timeline';
import type { TimelineItemType } from './TimelineItem';
import { TimelineItem } from './TimelineItem';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import { ConversationHero } from './ConversationHero';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { TypingBubble } from './TypingBubble';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { ReadStatus } from '../../messages/MessageReadStatus';
import type { WidthBreakpoint } from '../_util';
import { ThemeType } from '../../types/Util';
import { TextDirection } from './Message';
import { PaymentEventKind } from '../../types/Payment';
import type { PropsData as TimelineMessageProps } from './TimelineMessage';
import { CollidingAvatars } from '../CollidingAvatars';

const i18n = setupI18n('en', enMessages);

const alice = getDefaultConversation();
const bob = getDefaultConversation();

export default {
  title: 'Components/Conversation/Timeline',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

// eslint-disable-next-line
const noop = () => {};

function mockMessageTimelineItem(
  id: string,
  data: Partial<TimelineMessageProps>
): TimelineItemType {
  return {
    type: 'message',
    data: {
      id,
      author: getDefaultConversation({}),
      canCopy: true,
      canDeleteForEveryone: false,
      canDownload: true,
      canEditMessage: true,
      canReact: true,
      canReply: true,
      canRetry: true,
      conversationId: 'conversation-id',
      conversationTitle: 'Conversation Title',
      conversationType: 'group',
      conversationColor: 'crimson',
      direction: 'incoming',
      status: 'sent',
      text: 'Hello there from the new world!',
      isBlocked: false,
      isMessageRequestAccepted: true,
      isSelected: false,
      isSelectMode: false,
      isSMS: false,
      isSpoilerExpanded: {},
      previews: [],
      readStatus: ReadStatus.Read,
      canRetryDeleteForEveryone: true,
      textDirection: TextDirection.Default,
      timestamp: Date.now(),
      ...data,
    },
    timestamp: Date.now(),
  };
}

const items: Record<string, TimelineItemType> = {
  'id-1': mockMessageTimelineItem('id-1', {
    author: getDefaultConversation({
      phoneNumber: '(202) 555-2001',
    }),
    conversationColor: 'forest',
    text: '🔥',
  }),
  'id-2': mockMessageTimelineItem('id-2', {
    conversationColor: 'forest',
    direction: 'incoming',
    text: 'Hello there from the new world! http://somewhere.com',
  }),
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
    timestamp: Date.now(),
  },
  'id-3': mockMessageTimelineItem('id-3', {}),
  'id-4': {
    type: 'timerNotification',
    data: {
      disabled: false,
      expireTimer: DurationInSeconds.fromHours(2),
      title: "It's Me",
      type: 'fromMe',
    },
    timestamp: Date.now(),
  },
  'id-5': {
    type: 'timerNotification',
    data: {
      disabled: false,
      expireTimer: DurationInSeconds.fromHours(2),
      title: '(202) 555-0000',
      type: 'fromOther',
    },
    timestamp: Date.now(),
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
    timestamp: Date.now(),
  },
  'id-7': {
    type: 'verificationNotification',
    data: {
      contact: { title: 'Mrs. Ice' },
      isLocal: true,
      type: 'markVerified',
    },
    timestamp: Date.now(),
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
    timestamp: Date.now(),
  },
  'id-9': {
    type: 'resetSessionNotification',
    data: null,
    timestamp: Date.now(),
  },
  'id-10': mockMessageTimelineItem('id-10', {
    conversationColor: 'plum',
    direction: 'outgoing',
    text: '🔥',
  }),
  'id-11': mockMessageTimelineItem('id-11', {
    direction: 'outgoing',
    status: 'read',
    text: 'Hello there from the new world! http://somewhere.com',
  }),
  'id-12': mockMessageTimelineItem('id-12', {
    direction: 'outgoing',
    text: 'Hello there from the new world! 🔥',
  }),
  'id-13': mockMessageTimelineItem('id-13', {
    direction: 'outgoing',
    text: 'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
  }),
  'id-14': mockMessageTimelineItem('id-14', {
    direction: 'outgoing',
    status: 'read',
    text: 'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
  }),
  'id-15': {
    type: 'paymentEvent',
    data: {
      event: {
        kind: PaymentEventKind.ActivationRequest,
      },
      sender: getDefaultConversation(),
      conversation: getDefaultConversation(),
    },
    timestamp: Date.now(),
  },
  'id-16': {
    type: 'paymentEvent',
    data: {
      event: {
        kind: PaymentEventKind.Activation,
      },
      sender: getDefaultConversation(),
      conversation: getDefaultConversation(),
    },
    timestamp: Date.now(),
  },
  'id-17': {
    type: 'paymentEvent',
    data: {
      event: {
        kind: PaymentEventKind.ActivationRequest,
      },
      sender: getDefaultConversation({
        isMe: true,
      }),
      conversation: getDefaultConversation(),
    },
    timestamp: Date.now(),
  },
  'id-18': {
    type: 'paymentEvent',
    data: {
      event: {
        kind: PaymentEventKind.Activation,
      },
      sender: getDefaultConversation({
        isMe: true,
      }),
      conversation: getDefaultConversation(),
    },
    timestamp: Date.now(),
  },
  'id-19': mockMessageTimelineItem('id-19', {
    direction: 'outgoing',
    status: 'read',
    payment: {
      kind: PaymentEventKind.Notification,
      note: 'Thanks',
    },
  }),
};

const actions = () => ({
  acknowledgeGroupMemberNameCollisions: action(
    'acknowledgeGroupMemberNameCollisions'
  ),
  blockGroupLinkRequests: action('blockGroupLinkRequests'),
  checkForAccount: action('checkForAccount'),
  clearInvitedServiceIdsForNewlyCreatedGroup: action(
    'clearInvitedServiceIdsForNewlyCreatedGroup'
  ),
  setIsNearBottom: action('setIsNearBottom'),
  loadOlderMessages: action('loadOlderMessages'),
  loadNewerMessages: action('loadNewerMessages'),
  loadNewestMessages: action('loadNewestMessages'),
  markMessageRead: action('markMessageRead'),
  toggleSelectMessage: action('toggleSelectMessage'),
  targetMessage: action('targetMessage'),
  scrollToOldestUnreadMention: action('scrollToOldestUnreadMention'),
  clearTargetedMessage: action('clearTargetedMessage'),
  updateSharedGroups: action('updateSharedGroups'),

  reactToMessage: action('reactToMessage'),
  setMessageToEdit: action('setMessageToEdit'),
  setQuoteByMessageId: action('setQuoteByMessageId'),
  copyMessageText: action('copyMessageText'),
  retryDeleteForEveryone: action('retryDeleteForEveryone'),
  retryMessageSend: action('retryMessageSend'),
  saveAttachment: action('saveAttachment'),
  saveAttachments: action('saveAttachments'),
  pushPanelForConversation: action('pushPanelForConversation'),
  showContactDetail: action('showContactDetail'),
  showContactModal: action('showContactModal'),
  showConversation: action('showConversation'),
  cancelAttachmentDownload: action('cancelAttachmentDownload'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  messageExpanded: action('messageExpanded'),
  showSpoiler: action('showSpoiler'),
  showLightbox: action('showLightbox'),
  showLightboxForViewOnceMedia: action('showLightboxForViewOnceMedia'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),

  openGiftBadge: action('openGiftBadge'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  showAttachmentDownloadStillInProgressToast: action(
    'showAttachmentDownloadStillInProgressToast'
  ),
  showAttachmentNotAvailableModal: action('showAttachmentNotAvailableModal'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredOutgoingTapToViewToast'
  ),
  showMediaNoLongerAvailableToast: action('showMediaNoLongerAvailableToast'),
  toggleDeleteMessagesModal: action('toggleDeleteMessagesModal'),
  toggleForwardMessagesModal: action('toggleForwardMessagesModal'),

  toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
  onOpenEditNicknameAndNoteModal: action('onOpenEditNicknameAndNoteModal'),
  onOutgoingAudioCallInConversation: action(
    'onOutgoingAudioCallInConversation'
  ),
  onOutgoingVideoCallInConversation: action(
    'onOutgoingVideoCallInConversation'
  ),
  startConversation: action('startConversation'),
  returnToActiveCall: action('returnToActiveCall'),

  closeContactSpoofingReview: action('closeContactSpoofingReview'),
  reviewConversationNameCollision: action('reviewConversationNameCollision'),

  unblurAvatar: action('unblurAvatar'),

  peekGroupCallForTheFirstTime: action('peekGroupCallForTheFirstTime'),
  peekGroupCallIfItHasMembers: action('peekGroupCallIfItHasMembers'),

  viewStory: action('viewStory'),

  onReplyToMessage: action('onReplyToMessage'),

  onOpenMessageRequestActionsConfirmation: action(
    'onOpenMessageRequestActionsConfirmation'
  ),
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
    isTargeted={false}
    isBlocked={false}
    isGroup={false}
    i18n={i18n}
    interactionMode="keyboard"
    isNextItemCallingNotification={false}
    theme={ThemeType.light}
    platform="darwin"
    containerElementRef={containerElementRef}
    containerWidthBreakpoint={containerWidthBreakpoint}
    conversationId=""
    item={items[messageId]}
    renderAudioAttachment={() => <div>*AudioAttachment*</div>}
    renderContact={() => <div>*ContactName*</div>}
    renderEmojiPicker={() => <div />}
    renderReactionPicker={() => <div />}
    renderUniversalTimerNotification={() => (
      <div>*UniversalTimerNotification*</div>
    )}
    shouldCollapseAbove={false}
    shouldCollapseBelow={false}
    shouldHideMetadata={false}
    shouldRenderDateHeader={false}
    {...actions()}
  />
);

const renderContactSpoofingReviewDialog = () => {
  // hasContactSpoofingReview is always false in stories
  return <div />;
};

const getAbout = () => '👍 Free to chat';
const getTitle = () => 'Cayce Bollard';
const getProfileName = () => 'Cayce Bollard (profile)';
const getAvatarPath = () => '/fixtures/kitten-4-112-112.jpg';
const getPhoneNumber = () => '+1 (808) 555-1234';

const renderHeroRow = () => {
  function Wrapper() {
    const theme = React.useContext(StorybookThemeContext);
    return (
      <ConversationHero
        about={getAbout()}
        acceptedMessageRequest
        avatarUrl={getAvatarPath()}
        badge={undefined}
        conversationType="direct"
        id={getDefaultConversation().id}
        i18n={i18n}
        isMe={false}
        phoneNumber={getPhoneNumber()}
        profileName={getProfileName()}
        sharedGroupNames={['NYC Rock Climbers', 'Dinner Party']}
        theme={theme}
        title={getTitle()}
        unblurAvatar={action('unblurAvatar')}
        updateSharedGroups={noop}
        viewUserStories={action('viewUserStories')}
        toggleAboutContactModal={action('toggleAboutContactModal')}
      />
    );
  }
  return <Wrapper />;
};
const renderTypingBubble = () => (
  <TypingBubble
    typingContactIdTimestamps={{ [getDefaultConversation().id]: Date.now() }}
    lastItemAuthorId="123"
    lastItemTimestamp={undefined}
    conversationId="123"
    conversationType="direct"
    getConversation={() => getDefaultConversation()}
    getPreferredBadge={() => undefined}
    showContactModal={action('showContactModal')}
    i18n={i18n}
    theme={ThemeType.light}
  />
);
const renderCollidingAvatars = () => (
  <CollidingAvatars i18n={i18n} conversations={[alice, bob]} />
);
const renderMiniPlayer = () => (
  <div>If active, this is where smart mini player would be</div>
);

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  discardMessages: action('discardMessages'),
  getPreferredBadge: () => undefined,
  i18n,
  theme: React.useContext(StorybookThemeContext),

  getTimestampForMessage: Date.now,
  haveNewest: overrideProps.haveNewest ?? false,
  haveOldest: overrideProps.haveOldest ?? false,
  isBlocked: false,
  isConversationSelected: true,
  isIncomingMessageRequest: overrideProps.isIncomingMessageRequest ?? false,
  items: overrideProps.items ?? Object.keys(items),
  messageChangeCounter: 0,
  messageLoadingState: null,
  isNearBottom: null,
  scrollToIndex: overrideProps.scrollToIndex ?? null,
  scrollToIndexCounter: 0,
  shouldShowMiniPlayer: Boolean(overrideProps.shouldShowMiniPlayer),
  totalUnseen: overrideProps.totalUnseen ?? 0,
  oldestUnseenIndex: overrideProps.oldestUnseenIndex ?? 0,
  invitedContactsForNewlyCreatedGroup:
    overrideProps.invitedContactsForNewlyCreatedGroup || [],
  warning: overrideProps.warning,
  hasContactSpoofingReview: false,
  conversationType: 'direct',

  id: uuid(),
  renderItem,
  renderHeroRow,
  renderMiniPlayer,
  renderTypingBubble,
  renderCollidingAvatars,
  renderContactSpoofingReviewDialog,
  isSomeoneTyping: overrideProps.isSomeoneTyping || false,

  ...actions(),
});

export function OldestAndNewest(): JSX.Element {
  const props = useProps();

  return <Timeline {...props} />;
}

export function WithActiveMessageRequest(): JSX.Element {
  const props = useProps({
    isIncomingMessageRequest: true,
  });

  return <Timeline {...props} />;
}

export function WithoutNewestMessage(): JSX.Element {
  const props = useProps({
    haveNewest: false,
  });

  return <Timeline {...props} />;
}

export function WithoutNewestMessageActiveMessageRequest(): JSX.Element {
  const props = useProps({
    haveOldest: false,
    isIncomingMessageRequest: true,
  });

  return <Timeline {...props} />;
}

export function WithoutOldestMessage(): JSX.Element {
  const props = useProps({
    haveOldest: false,
    scrollToIndex: -1,
  });

  return <Timeline {...props} />;
}

export function EmptyJustHero(): JSX.Element {
  const props = useProps({
    items: [],
  });

  return <Timeline {...props} />;
}

export function LastSeen(): JSX.Element {
  const props = useProps({
    oldestUnseenIndex: 13,
    totalUnseen: 2,
  });

  return <Timeline {...props} />;
}

export function TargetIndexToTop(): JSX.Element {
  const props = useProps({
    scrollToIndex: 0,
  });

  return <Timeline {...props} />;
}

export function TypingIndicator(): JSX.Element {
  const props = useProps({ isSomeoneTyping: true });

  return <Timeline {...props} />;
}

export function WithInvitedContactsForANewlyCreatedGroup(): JSX.Element {
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
}

export function WithSameNameInDirectConversationWarning(): JSX.Element {
  const props = useProps({
    warning: {
      type: ContactSpoofingType.DirectConversationWithSameTitle,

      // Just to pacify type-script
      safeConversationId: '123',
    },
    items: [],
  });

  return <Timeline {...props} />;
}

export function WithSameNameInGroupConversationWarning(): JSX.Element {
  const props = useProps({
    warning: {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
      acknowledgedGroupNameCollisions: {},
      groupNameCollisions: {
        Alice: times(2, () => uuid()),
      },
    },
    items: [],
  });

  return <Timeline {...props} />;
}

export function WithSameNamesInGroupConversationWarning(): JSX.Element {
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
}

export function WithJustMiniPlayer(): JSX.Element {
  const props = useProps({
    shouldShowMiniPlayer: true,
    items: [],
  });

  return <Timeline {...props} />;
}
