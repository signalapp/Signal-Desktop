// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import { EmojiPicker } from '../emoji/EmojiPicker';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType as TimelineItemProps } from './TimelineItem';
import { TimelineItem } from './TimelineItem';
import { UniversalTimerNotification } from './UniversalTimerNotification';
import { CallMode } from '../../types/Calling';
import { AvatarColors } from '../../types/Colors';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { WidthBreakpoint } from '../_util';
import { ThemeType } from '../../types/Util';

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
  />
);

const renderReactionPicker: TimelineItemProps['renderReactionPicker'] = () => (
  <div />
);

const renderContact = (conversationId: string) => (
  <React.Fragment key={conversationId}>{conversationId}</React.Fragment>
);

const renderUniversalTimerNotification = () => (
  <UniversalTimerNotification i18n={i18n} expireTimer={3600} />
);

const getDefaultProps = () => ({
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationId: 'conversation-id',
  getPreferredBadge: () => undefined,
  id: 'asdf',
  isNextItemCallingNotification: false,
  isSelected: false,
  interactionMode: 'keyboard' as const,
  theme: ThemeType.light,
  selectMessage: action('selectMessage'),
  reactToMessage: action('reactToMessage'),
  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('clearSelectedMessage'),
  contactSupport: action('contactSupport'),
  replyToMessage: action('replyToMessage'),
  retryDeleteForEveryone: action('retryDeleteForEveryone'),
  retrySend: action('retrySend'),
  blockGroupLinkRequests: action('blockGroupLinkRequests'),
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  learnMoreAboutDeliveryIssue: action('learnMoreAboutDeliveryIssue'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  markViewed: action('markViewed'),
  messageExpanded: action('messageExpanded'),
  showMessageDetail: action('showMessageDetail'),
  openConversation: action('openConversation'),
  openGiftBadge: action('openGiftBadge'),
  showContactDetail: action('showContactDetail'),
  showContactModal: action('showContactModal'),
  showForwardMessageModal: action('showForwardMessageModal'),
  showVisualAttachment: action('showVisualAttachment'),
  downloadAttachment: action('downloadAttachment'),
  displayTapToViewMessage: action('displayTapToViewMessage'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  openLink: action('openLink'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  downloadNewVersion: action('downloadNewVersion'),
  showIdentity: action('showIdentity'),
  startCallingLobby: action('startCallingLobby'),
  startConversation: action('startConversation'),
  returnToActiveCall: action('returnToActiveCall'),
  shouldCollapseAbove: false,
  shouldCollapseBelow: false,
  shouldHideMetadata: false,
  shouldRenderDateHeader: false,

  now: Date.now(),

  renderContact,
  renderUniversalTimerNotification,
  renderEmojiPicker,
  renderReactionPicker,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  viewStory: action('viewStory'),
});

export default {
  title: 'Components/Conversation/TimelineItem',
};

export const PlainMessage = (): JSX.Element => {
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
};

export const Notification = (): JSX.Element => {
  const items = [
    {
      type: 'timerNotification',
      data: {
        phoneNumber: '(202) 555-0000',
        expireTimer: 60,
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
};

export const UnknownType = (): JSX.Element => {
  const item = {
    type: 'random',
    data: {
      somethin: 'somethin',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as TimelineItemProps['item'];

  return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
};

export const MissingItem = (): JSX.Element => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = null as any as TimelineItemProps['item'];

  return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
};
