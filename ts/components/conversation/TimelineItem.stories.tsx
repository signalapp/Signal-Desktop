import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { EmojiPicker } from '../emoji/EmojiPicker';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
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

const getDefaultProps = () => ({
  conversationId: 'conversation-id',
  id: 'asdf',
  isSelected: false,
  selectMessage: action('selectMessage'),
  reactToMessage: action('reactToMessage'),
  clearSelectedMessage: action('clearSelectedMessage'),
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  deleteMessage: action('deleteMessage'),
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
    const item = {
      type: 'timerNotification',
      data: {
        type: 'fromOther',
        phoneNumber: '(202) 555-0000',
        timespan: '1 hour',
      },
    } as TimelineItemProps['item'];

    return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
  })
  .add('Unknown Type', () => {
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
    // @ts-ignore: intentional
    const item = null as TimelineItemProps['item'];

    return <TimelineItem {...getDefaultProps()} item={item} i18n={i18n} />;
  });
