// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { EmojiPicker } from '../emoji/EmojiPicker';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { PropsType as TimelineItemProps, TimelineItem } from './TimelineItem';
import { CallMode } from '../../types/Calling';

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

const renderContact = (conversationId: string) => (
  <React.Fragment key={conversationId}>{conversationId}</React.Fragment>
);

const getDefaultProps = () => ({
  conversationId: 'conversation-id',
  conversationAccepted: true,
  id: 'asdf',
  isSelected: false,
  interactionMode: 'keyboard' as const,
  selectMessage: action('selectMessage'),
  reactToMessage: action('reactToMessage'),
  clearSelectedMessage: action('clearSelectedMessage'),
  contactSupport: action('contactSupport'),
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  showMessageDetail: action('showMessageDetail'),
  openConversation: action('openConversation'),
  showContactDetail: action('showContactDetail'),
  showContactModal: action('showContactModal'),
  showVisualAttachment: action('showVisualAttachment'),
  downloadAttachment: action('downloadAttachment'),
  displayTapToViewMessage: action('displayTapToViewMessage'),
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
  messageSizeChanged: action('messageSizeChanged'),
  startCallingLobby: action('startCallingLobby'),
  returnToActiveCall: action('returnToActiveCall'),

  renderContact,
  renderEmojiPicker,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
});

storiesOf('Components/Conversation/TimelineItem', module)
  .add('Plain Message', () => {
    const item = {
      type: 'message',
      data: {
        id: 'id-1',
        direction: 'incoming',
        timestamp: Date.now(),
        authorPhoneNumber: '(202) 555-2001',
        authorColor: 'green',
        text: '🔥',
      },
    } as TimelineItemProps['item'];

    return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
  })
  .add('Notification', () => {
    const items = [
      {
        type: 'timerNotification',
        data: {
          type: 'fromOther',
          phoneNumber: '(202) 555-0000',
          timespan: '1 hour',
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
          // missed (neither accepted nor declined) outgoing audio
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
          // missed (neither accepted nor declined) outgoing video
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
            <hr />
          </React.Fragment>
        ))}
      </>
    );
  })
  .add('Unknown Type', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: intentional
    const item = {
      type: 'random',
      data: {
        somethin: 'somethin',
      },
    } as TimelineItemProps['item'];

    return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
  })
  .add('Missing Item', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: intentional
    const item = null as TimelineItemProps['item'];

    return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
  });
