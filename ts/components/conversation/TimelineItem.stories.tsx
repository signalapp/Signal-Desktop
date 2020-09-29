import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { EmojiPicker } from '../emoji/EmojiPicker';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { PropsType as TimelineItemProps, TimelineItem } from './TimelineItem';

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
  selectMessage: action('selectMessage'),
  reactToMessage: action('reactToMessage'),
  clearSelectedMessage: action('clearSelectedMessage'),
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  showMessageDetail: action('showMessageDetail'),
  openConversation: action('openConversation'),
  showContactDetail: action('showContactDetail'),
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

  renderContact,
  renderEmojiPicker,
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
          callHistoryDetails: {
            // declined incoming audio
            wasDeclined: true,
            wasIncoming: true,
            wasVideoCall: false,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // declined incoming video
            wasDeclined: true,
            wasIncoming: true,
            wasVideoCall: true,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // accepted incoming audio
            acceptedTime: Date.now() - 300,
            wasDeclined: false,
            wasIncoming: true,
            wasVideoCall: false,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // accepted incoming video
            acceptedTime: Date.now() - 400,
            wasDeclined: false,
            wasIncoming: true,
            wasVideoCall: true,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // missed (neither accepted nor declined) incoming audio
            wasDeclined: false,
            wasIncoming: true,
            wasVideoCall: false,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // missed (neither accepted nor declined) incoming video
            wasDeclined: false,
            wasIncoming: true,
            wasVideoCall: true,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // accepted outgoing audio
            acceptedTime: Date.now() - 200,
            wasDeclined: false,
            wasIncoming: false,
            wasVideoCall: false,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // accepted outgoing video
            acceptedTime: Date.now() - 200,
            wasDeclined: false,
            wasIncoming: false,
            wasVideoCall: true,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // declined outgoing audio
            wasDeclined: true,
            wasIncoming: false,
            wasVideoCall: false,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // declined outgoing video
            wasDeclined: true,
            wasIncoming: false,
            wasVideoCall: true,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // missed (neither accepted nor declined) outgoing audio
            wasDeclined: false,
            wasIncoming: false,
            wasVideoCall: false,
            endedTime: Date.now(),
          },
        },
      },
      {
        type: 'callHistory',
        data: {
          callHistoryDetails: {
            // missed (neither accepted nor declined) outgoing video
            wasDeclined: false,
            wasIncoming: false,
            wasVideoCall: true,
            endedTime: Date.now(),
          },
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
