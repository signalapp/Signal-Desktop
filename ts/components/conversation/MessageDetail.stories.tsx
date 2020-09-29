import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { Props as MessageProps } from './Message';
import { MessageDetail, Props } from './MessageDetail';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/MessageDetail', module);

const defaultMessage: MessageProps = {
  authorTitle: 'Max',
  canReply: true,
  canDeleteForEveryone: true,
  clearSelectedMessage: () => null,
  conversationId: 'my-convo',
  conversationType: 'direct',
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  direction: 'incoming',
  displayTapToViewMessage: () => null,
  downloadAttachment: () => null,
  i18n,
  id: 'my-message',
  interactionMode: 'keyboard',
  openConversation: () => null,
  openLink: () => null,
  previews: [],
  reactToMessage: () => null,
  renderEmojiPicker: () => <div />,
  replyToMessage: () => null,
  retrySend: () => null,
  scrollToQuotedMessage: () => null,
  showContactDetail: () => null,
  showExpiredIncomingTapToViewToast: () => null,
  showExpiredOutgoingTapToViewToast: () => null,
  showMessageDetail: () => null,
  showVisualAttachment: () => null,
  status: 'sent',
  text: 'A message from Max',
  timestamp: Date.now(),
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  contacts: overrideProps.contacts || [
    {
      color: 'green',
      isOutgoingKeyError: false,
      isUnidentifiedDelivery: false,
      onSendAnyway: action('onSendAnyway'),
      onShowSafetyNumber: action('onShowSafetyNumber'),
      status: 'delivered',
      title: 'Just Max',
    },
  ],
  errors: overrideProps.errors || [],
  i18n,
  message: overrideProps.message || defaultMessage,
  receivedAt: number('receivedAt', overrideProps.receivedAt || Date.now()),
  sentAt: number('sentAt', overrideProps.sentAt || Date.now()),
});

story.add('Delivered Incoming', () => {
  const props = createProps({});
  return <MessageDetail {...props} />;
});

story.add('Delivered Outgoing', () => {
  const props = createProps({
    message: {
      ...defaultMessage,
      direction: 'outgoing',
      text: 'A message to Max',
    },
  });
  return <MessageDetail {...props} />;
});

story.add('Message Statuses', () => {
  const props = createProps({
    contacts: [
      {
        color: 'green',
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'sent',
        title: 'Max',
      },
      {
        color: 'blue',
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'sending',
        title: 'Sally',
      },
      {
        color: 'brown',
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'partial-sent',
        title: 'Terry',
      },
      {
        color: 'light_green',
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'delivered',
        title: 'Theo',
      },
      {
        color: 'blue_grey',
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'read',
        title: 'Nikki',
      },
    ],
    message: {
      ...defaultMessage,
      conversationType: 'group',
      text: 'A message to you all!',
    },
  });
  return <MessageDetail {...props} />;
});

story.add('Not Delivered', () => {
  const props = createProps({
    message: {
      ...defaultMessage,
      direction: 'outgoing',
      text: 'A message to Max',
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.receivedAt = undefined as any;

  return <MessageDetail {...props} />;
});

story.add('No Contacts', () => {
  const props = createProps({
    contacts: [],
    message: {
      ...defaultMessage,
      direction: 'outgoing',
      text: 'Is anybody there?',
    },
  });
  return <MessageDetail {...props} />;
});

story.add('All Errors', () => {
  const props = createProps({
    errors: [
      {
        name: 'Another Error',
        message: 'Wow, that went bad.',
      },
    ],
    message: {
      ...defaultMessage,
    },
    contacts: [
      {
        color: 'green',
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'error',
        title: 'Max',
      },
      {
        color: 'blue',
        errors: [
          {
            name: 'Big Error',
            message: 'Stuff happened, in a bad way.',
          },
        ],
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: true,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'error',
        title: 'Sally',
      },
      {
        color: 'brown',
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: true,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'error',
        title: 'Terry',
      },
    ],
  });
  return <MessageDetail {...props} />;
});
