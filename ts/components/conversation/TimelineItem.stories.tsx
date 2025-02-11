// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { EmojiPicker } from '../emoji/EmojiPicker';
import { setupI18n } from '../../util/setupI18n';
import { DurationInSeconds } from '../../util/durations';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType as TimelineItemProps } from './TimelineItem';
import { TimelineItem } from './TimelineItem';
import { UniversalTimerNotification } from './UniversalTimerNotification';
import { CallMode } from '../../types/CallDisposition';
import { AvatarColors } from '../../types/Colors';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { WidthBreakpoint } from '../_util';
import { ThemeType } from '../../types/Util';
import { PaymentEventKind } from '../../types/Payment';
import { ErrorBoundary } from './ErrorBoundary';

const i18n = setupI18n('en', enMessages);

const renderEmojiPicker: TimelineItemProps['renderEmojiPicker'] = ({
  onClose,
  onPickEmoji,
  ref,
}) => (
  <EmojiPicker
    i18n={setupI18n('en', enMessages)}
    skinTone={0}
    onSetSkinTone={action('EmojiPicker::onSetSkinTone')}
    ref={ref}
    onClose={onClose}
    onPickEmoji={onPickEmoji}
    wasInvokedFromKeyboard={false}
  />
);

const renderReactionPicker: TimelineItemProps['renderReactionPicker'] = () => (
  <div />
);

const renderContact = (conversationId: string) => (
  <React.Fragment key={conversationId}>{conversationId}</React.Fragment>
);

const renderUniversalTimerNotification = () => (
  <UniversalTimerNotification
    i18n={i18n}
    expireTimer={DurationInSeconds.HOUR}
  />
);

const getDefaultProps = () => ({
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationId: 'conversation-id',
  getPreferredBadge: () => undefined,
  id: 'asdf',
  isNextItemCallingNotification: false,
  isTargeted: false,
  isBlocked: false,
  isGroup: false,
  interactionMode: 'keyboard' as const,
  theme: ThemeType.light,
  platform: 'darwin',
  targetMessage: action('targetMessage'),
  toggleSelectMessage: action('toggleSelectMessage'),
  reactToMessage: action('reactToMessage'),
  checkForAccount: action('checkForAccount'),
  clearTargetedMessage: action('clearTargetedMessage'),
  setMessageToEdit: action('setMessageToEdit'),
  setQuoteByMessageId: action('setQuoteByMessageId'),
  copyMessageText: action('copyMessageText'),
  retryDeleteForEveryone: action('retryDeleteForEveryone'),
  retryMessageSend: action('retryMessageSend'),
  blockGroupLinkRequests: action('blockGroupLinkRequests'),
  cancelAttachmentDownload: action('cancelAttachmentDownload'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  messageExpanded: action('messageExpanded'),
  showConversation: action('showConversation'),
  openGiftBadge: action('openGiftBadge'),
  saveAttachment: action('saveAttachment'),
  saveAttachments: action('saveAttachments'),
  onOpenEditNicknameAndNoteModal: action('onOpenEditNicknameAndNoteModal'),
  onOutgoingAudioCallInConversation: action(
    'onOutgoingAudioCallInConversation'
  ),
  onOutgoingVideoCallInConversation: action(
    'onOutgoingVideoCallInConversation'
  ),
  pushPanelForConversation: action('pushPanelForConversation'),
  showContactModal: action('showContactModal'),
  showLightbox: action('showLightbox'),
  toggleDeleteMessagesModal: action('toggleDeleteMessagesModal'),
  toggleForwardMessagesModal: action('toggleForwardMessagesModal'),
  showLightboxForViewOnceMedia: action('showLightboxForViewOnceMedia'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),
  showAttachmentDownloadStillInProgressToast: action(
    'showAttachmentDownloadStillInProgressToast'
  ),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showAttachmentNotAvailableModal: action('showAttachmentNotAvailableModal'),
  showMediaNoLongerAvailableToast: action('showMediaNoLongerAvailableToast'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  showSpoiler: action('showSpoiler'),
  startConversation: action('startConversation'),
  returnToActiveCall: action('returnToActiveCall'),
  shouldCollapseAbove: false,
  shouldCollapseBelow: false,
  shouldHideMetadata: false,
  shouldRenderDateHeader: false,
  toggleSafetyNumberModal: action('toggleSafetyNumberModal'),

  now: Date.now(),

  renderContact,
  renderUniversalTimerNotification,
  renderEmojiPicker,
  renderReactionPicker,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  viewStory: action('viewStory'),

  onReplyToMessage: action('onReplyToMessage'),
  onOpenMessageRequestActionsConfirmation: action(
    'onOpenMessageRequestActionsConfirmation'
  ),
});

export default {
  title: 'Components/Conversation/TimelineItem',
} satisfies Meta<TimelineItemProps>;

export function PlainMessage(): JSX.Element {
  const item = {
    type: 'message',
    data: {
      id: 'id-1',
      direction: 'incoming',
      timestamp: Date.now(),
      author: {
        phoneNumber: '(202) 555-2001',
        color: AvatarColors[0],
      },
      text: '🔥',
    },
  } as TimelineItemProps['item'];

  return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
}

export function Notification(): JSX.Element {
  const items = [
    {
      type: 'timerNotification',
      data: {
        phoneNumber: '(202) 555-0000',
        expireTimer: DurationInSeconds.MINUTE,
        ...getDefaultConversation(),
        type: 'fromOther',
      },
    },
    {
      type: 'timerNotification',
      data: {
        phoneNumber: '(202) 555-0000',
        disabled: true,
        ...getDefaultConversation(),
        type: 'fromOther',
      },
    },
    {
      type: 'universalTimerNotification',
      data: null,
    },
    {
      type: 'chatSessionRefreshed',
    },
    {
      type: 'contactRemovedNotification',
      data: null,
    },
    {
      type: 'safetyNumberNotification',
      data: {
        isGroup: false,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'deliveryIssue',
      data: {
        sender: getDefaultConversation(),
      },
    },
    {
      type: 'changeNumberNotification',
      data: {
        sender: getDefaultConversation(),
        timestamp: Date.now(),
      },
    },
    {
      type: 'titleTransitionNotification',
      data: {
        oldTitle: 'alice.01',
      },
    },
    {
      type: 'callHistory',
      data: {
        // declined incoming audio
        callMode: CallMode.Direct,
        wasDeclined: true,
        wasIncoming: true,
        wasVideoCall: false,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // declined incoming video
        callMode: CallMode.Direct,
        wasDeclined: true,
        wasIncoming: true,
        wasVideoCall: true,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // accepted incoming audio
        callMode: CallMode.Direct,
        acceptedTime: Date.now() - 300,
        wasDeclined: false,
        wasIncoming: true,
        wasVideoCall: false,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // accepted incoming video
        callMode: CallMode.Direct,
        acceptedTime: Date.now() - 400,
        wasDeclined: false,
        wasIncoming: true,
        wasVideoCall: true,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // missed (neither accepted nor declined) incoming audio
        callMode: CallMode.Direct,
        wasDeclined: false,
        wasIncoming: true,
        wasVideoCall: false,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // missed (neither accepted nor declined) incoming video
        callMode: CallMode.Direct,
        wasDeclined: false,
        wasIncoming: true,
        wasVideoCall: true,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // accepted outgoing audio
        callMode: CallMode.Direct,
        acceptedTime: Date.now() - 200,
        wasDeclined: false,
        wasIncoming: false,
        wasVideoCall: false,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // accepted outgoing video
        callMode: CallMode.Direct,
        acceptedTime: Date.now() - 200,
        wasDeclined: false,
        wasIncoming: false,
        wasVideoCall: true,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // declined outgoing audio
        callMode: CallMode.Direct,
        wasDeclined: true,
        wasIncoming: false,
        wasVideoCall: false,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // declined outgoing video
        callMode: CallMode.Direct,
        wasDeclined: true,
        wasIncoming: false,
        wasVideoCall: true,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // unanswered (neither accepted nor declined) outgoing audio
        callMode: CallMode.Direct,
        wasDeclined: false,
        wasIncoming: false,
        wasVideoCall: false,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // unanswered (neither accepted nor declined) outgoing video
        callMode: CallMode.Direct,
        wasDeclined: false,
        wasIncoming: false,
        wasVideoCall: true,
        endedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // ongoing group call
        callMode: CallMode.Group,
        conversationId: 'abc123',
        creator: {
          firstName: 'Luigi',
          isMe: false,
          title: 'Luigi Mario',
        },
        ended: false,
        deviceCount: 1,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // ongoing group call started by you
        callMode: CallMode.Group,
        conversationId: 'abc123',
        creator: {
          firstName: 'Peach',
          isMe: true,
          title: 'Princess Peach',
        },
        ended: false,
        deviceCount: 1,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // ongoing group call, creator unknown
        callMode: CallMode.Group,
        conversationId: 'abc123',
        ended: false,
        deviceCount: 1,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // ongoing and active group call
        callMode: CallMode.Group,
        activeCallConversationId: 'abc123',
        conversationId: 'abc123',
        creator: {
          firstName: 'Luigi',
          isMe: false,
          title: 'Luigi Mario',
        },
        ended: false,
        deviceCount: 1,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // ongoing group call, but you're in another one
        callMode: CallMode.Group,
        activeCallConversationId: 'abc123',
        conversationId: 'xyz987',
        creator: {
          firstName: 'Luigi',
          isMe: false,
          title: 'Luigi Mario',
        },
        ended: false,
        deviceCount: 1,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // ongoing full group call
        callMode: CallMode.Group,
        conversationId: 'abc123',
        creator: {
          firstName: 'Luigi',
          isMe: false,
          title: 'Luigi Mario',
        },
        ended: false,
        deviceCount: 16,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'callHistory',
      data: {
        // finished call
        callMode: CallMode.Group,
        conversationId: 'abc123',
        creator: {
          firstName: 'Luigi',
          isMe: false,
          title: 'Luigi Mario',
        },
        ended: true,
        deviceCount: 0,
        maxDevices: 16,
        startedTime: Date.now(),
      },
    },
    {
      type: 'profileChange',
      data: {
        change: {
          type: 'name',
          oldName: 'Fred',
          newName: 'John',
        },
        changedContact: getDefaultConversation(),
      },
    },
    {
      type: 'paymentEvent',
      data: {
        event: {
          kind: PaymentEventKind.ActivationRequest,
        },
        sender: getDefaultConversation(),
        conversation: getDefaultConversation(),
      },
    },
    {
      type: 'paymentEvent',
      data: {
        event: {
          kind: PaymentEventKind.Activation,
        },
        sender: getDefaultConversation(),
        conversation: getDefaultConversation(),
      },
    },
    {
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
    },
    {
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
    },
    {
      type: 'resetSessionNotification',
      data: null,
    },
    {
      type: 'unsupportedMessage',
      data: {
        canProcessNow: true,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'unsupportedMessage',
      data: {
        canProcessNow: false,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'verificationNotification',
      data: {
        type: 'markVerified',
        isLocal: false,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'verificationNotification',
      data: {
        type: 'markVerified',
        isLocal: true,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'verificationNotification',
      data: {
        type: 'markNotVerified',
        isLocal: false,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'verificationNotification',
      data: {
        type: 'markNotVerified',
        isLocal: true,
        contact: getDefaultConversation(),
      },
    },
    {
      type: 'conversationMerge',
      data: {
        conversationTitle: 'Alice',
        obsoleteConversationTitle: 'Nancy',
        obsoleteConversationNumber: '+121255501234',
      },
    },
  ];

  return (
    <>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <TimelineItem
            {...getDefaultProps()}
            item={item as TimelineItemProps['item']}
            i18n={i18n}
          />
        </React.Fragment>
      ))}
    </>
  );
}

export function UnknownType(): JSX.Element {
  const item = {
    type: 'random',
    data: {
      somethin: 'somethin',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as TimelineItemProps['item'];

  return (
    <ErrorBoundary i18n={i18n} showDebugLog={action('showDebugLog')}>
      <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />
    </ErrorBoundary>
  );
}

export function MissingItem(): JSX.Element {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = null as any as TimelineItemProps['item'];

  return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
}
