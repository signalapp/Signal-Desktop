// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';

import type { PropsData as MessageDataPropsType } from './Message';
import { TextDirection } from './Message';
import type { Props } from './MessageDetail';
import { MessageDetail } from './MessageDetail';
import { SendStatus } from '../../messages/MessageSendState';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MessageDetail',
};

const defaultMessage: MessageDataPropsType = {
  author: getDefaultConversation({
    id: 'some-id',
    title: 'Max',
  }),
  canReact: true,
  canReply: true,
  canRetry: true,
  canRetryDeleteForEveryone: true,
  canDeleteForEveryone: true,
  canDownload: true,
  conversationColor: 'crimson',
  conversationId: 'my-convo',
  conversationTitle: 'Conversation Title',
  conversationType: 'direct',
  direction: 'incoming',
  id: 'my-message',
  renderingContext: 'storybook',
  isBlocked: false,
  isMessageRequestAccepted: true,
  previews: [],
  readStatus: ReadStatus.Read,
  status: 'sent',
  text: 'A message from Max',
  textDirection: TextDirection.Default,
  timestamp: Date.now(),
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  contacts: overrideProps.contacts || [
    {
      ...getDefaultConversation({
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

  getPreferredBadge: () => getFakeBadge(),
  i18n,
  interactionMode: 'keyboard',
  theme: ThemeType.light,

  showSafetyNumber: action('showSafetyNumber'),

  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('clearSelectedMessage'),
  displayTapToViewMessage: action('displayTapToViewMessage'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  markViewed: action('markViewed'),
  openConversation: action('openConversation'),
  openGiftBadge: action('openGiftBadge'),
  openLink: action('openLink'),
  reactToMessage: action('reactToMessage'),
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  renderEmojiPicker: () => <div />,
  renderReactionPicker: () => <div />,
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  retryDeleteForEveryone: action('retryDeleteForEveryone'),
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
  startConversation: action('startConversation'),
  viewStory: action('viewStory'),
});

export const DeliveredIncoming = (): JSX.Element => {
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
};

export const DeliveredOutgoing = (): JSX.Element => {
  const props = createProps({
    message: {
      ...defaultMessage,
      direction: 'outgoing',
      text: 'A message to Max',
    },
  });
  return <MessageDetail {...props} />;
};

export const MessageStatuses = (): JSX.Element => {
  const props = createProps({
    contacts: [
      {
        ...getDefaultConversation({
          title: 'Max',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Sent,
      },
      {
        ...getDefaultConversation({
          title: 'Sally',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Pending,
      },
      {
        ...getDefaultConversation({
          title: 'Terry',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Failed,
      },
      {
        ...getDefaultConversation({
          title: 'Theo',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Delivered,
      },
      {
        ...getDefaultConversation({
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
};

export const NotDelivered = (): JSX.Element => {
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
};

export const NoContacts = (): JSX.Element => {
  const props = createProps({
    contacts: [],
    message: {
      ...defaultMessage,
      direction: 'outgoing',
      text: 'Is anybody there?',
    },
  });
  return <MessageDetail {...props} />;
};

export const AllErrors = (): JSX.Element => {
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
          title: 'Max',
        }),
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: false,
        status: SendStatus.Failed,
      },
      {
        ...getDefaultConversation({
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
          title: 'Terry',
        }),
        isOutgoingKeyError: true,
        isUnidentifiedDelivery: true,
        status: SendStatus.Failed,
      },
    ],
  });
  return <MessageDetail {...props} />;
};
