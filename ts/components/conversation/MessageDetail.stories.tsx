// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { PropsData as MessageDataPropsType } from './Message';
import { MessageDetail, Props } from './MessageDetail';
import { SendStatus } from '../../messages/MessageSendState';
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
  conversationColor: 'crimson',
  conversationId: 'my-convo',
  conversationType: 'direct',
  direction: 'incoming',
  id: 'my-message',
  renderingContext: 'storybook',
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
        color: 'indigo',
        title: 'Just Max',
      }),
      isOutgoingKeyError: false,
      isUnidentifiedDelivery: false,
      status: SendStatus.Delivered,
    },
  ],
  errors: overrideProps.errors || [],
  message: overrideProps.message || defaultMessage,
  receivedAt: number('receivedAt', overrideProps.receivedAt || Date.now()),
  sentAt: number('sentAt', overrideProps.sentAt || Date.now()),

  i18n,
  interactionMode: 'keyboard',

  sendAnyway: action('onSendAnyway'),
  showSafetyNumber: action('onShowSafetyNumber'),

  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('clearSelectedMessage'),
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  displayTapToViewMessage: action('displayTapToViewMessage'),
  downloadAttachment: action('downloadAttachment'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  openConversation: action('openConversation'),
  openLink: action('openLink'),
  reactToMessage: action('reactToMessage'),
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  renderEmojiPicker: () => <div />,
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  showContactDetail: action('showContactDetail'),
  showContactModal: action('showContactModal'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredOutgoingTapToViewToast'
  ),
  showForwardMessageModal: action('showForwardMessageModal'),
  showVisualAttachment: action('showVisualAttachment'),
});

story.add('Delivered Incoming', () => {
  const props = createProps({
    contacts: [
      {
        ...getDefaultConversation({
          color: 'forest',
          title: 'Max',
        }),
        status: undefined,
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
      },
    ],
  });
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
          color: 'forest',
          title: 'Max',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Sent,
      },
      {
        ...getDefaultConversation({
          color: 'blue',
          title: 'Sally',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Pending,
      },
      {
        ...getDefaultConversation({
          color: 'burlap',
          title: 'Terry',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Failed,
      },
      {
        ...getDefaultConversation({
          color: 'wintergreen',
          title: 'Theo',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Delivered,
      },
      {
        ...getDefaultConversation({
          color: 'steel',
          title: 'Nikki',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Read,
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
          color: 'forest',
          title: 'Max',
        }),
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: false,
        status: SendStatus.Failed,
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
        status: SendStatus.Failed,
      },
      {
        ...getDefaultConversation({
          color: 'taupe',
          title: 'Terry',
        }),
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: true,
        status: SendStatus.Failed,
      },
    ],
  });
  return <MessageDetail {...props} />;
});
