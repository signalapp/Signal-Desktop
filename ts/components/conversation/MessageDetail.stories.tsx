// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { PropsData as MessageDataPropsType } from './Message';
import { MessageDetail, Props } from './MessageDetail';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/MessageDetail', module);

const defaultMessage: MessageDataPropsType = {
  author: getDefaultConversation({
    id: 'some-id',
    title: 'Max',
  }),
  canReply: true,
  canDeleteForEveryone: true,
  canDownload: true,
  conversationId: 'my-convo',
  conversationType: 'direct',
  direction: 'incoming',
  id: 'my-message',
  isBlocked: false,
  isMessageRequestAccepted: true,
  previews: [],
  status: 'sent',
  text: 'A message from Max',
  timestamp: Date.now(),
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  contacts: overrideProps.contacts || [
    {
      ...getDefaultConversation({
        color: 'green',
        title: 'Just Max',
      }),
      isOutgoingKeyError: false,
      isUnidentifiedDelivery: false,
      onSendAnyway: action('onSendAnyway'),
      onShowSafetyNumber: action('onShowSafetyNumber'),
      status: 'delivered',
    },
  ],
  errors: overrideProps.errors || [],
  message: overrideProps.message || defaultMessage,
  receivedAt: number('receivedAt', overrideProps.receivedAt || Date.now()),
  sentAt: number('sentAt', overrideProps.sentAt || Date.now()),

  i18n,
  interactionMode: 'keyboard',

  clearSelectedMessage: () => null,
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  displayTapToViewMessage: () => null,
  downloadAttachment: () => null,
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  openConversation: () => null,
  openLink: () => null,
  reactToMessage: () => null,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  renderEmojiPicker: () => <div />,
  replyToMessage: () => null,
  retrySend: () => null,
  showContactDetail: () => null,
  showContactModal: () => null,
  showExpiredIncomingTapToViewToast: () => null,
  showExpiredOutgoingTapToViewToast: () => null,
  showForwardMessageModal: () => null,
  showVisualAttachment: () => null,
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
        ...getDefaultConversation({
          color: 'green',
          title: 'Max',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'sent',
      },
      {
        ...getDefaultConversation({
          color: 'blue',
          title: 'Sally',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'sending',
      },
      {
        ...getDefaultConversation({
          color: 'brown',
          title: 'Terry',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'partial-sent',
      },
      {
        ...getDefaultConversation({
          color: 'light_green',
          title: 'Theo',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'delivered',
      },
      {
        ...getDefaultConversation({
          color: 'blue_grey',
          title: 'Nikki',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'read',
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
        ...getDefaultConversation({
          color: 'green',
          title: 'Max',
        }),
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: false,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'error',
      },
      {
        ...getDefaultConversation({
          color: 'blue',
          title: 'Sally',
        }),
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
      },
      {
        ...getDefaultConversation({
          color: 'brown',
          title: 'Terry',
        }),
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: true,
        onSendAnyway: action('onSendAnyway'),
        onShowSafetyNumber: action('onShowSafetyNumber'),
        status: 'error',
      },
    ],
  });
  return <MessageDetail {...props} />;
});
