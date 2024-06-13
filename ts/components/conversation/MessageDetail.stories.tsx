// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
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

const defaultMessage: MessageDataPropsType = {
  author: getDefaultConversation({
    id: 'some-id',
    title: 'Max',
  }),
  canDeleteForEveryone: true,
  conversationColor: 'crimson',
  conversationId: 'my-convo',
  conversationTitle: 'Conversation Title',
  conversationType: 'direct',
  direction: 'incoming',
  id: 'my-message',
  renderingContext: 'storybook',
  renderMenu: undefined,
  isBlocked: false,
  isMessageRequestAccepted: true,
  isSelected: false,
  isSelectMode: false,
  isSMS: false,
  isSpoilerExpanded: {},
  previews: [],
  readStatus: ReadStatus.Read,
  status: 'sent',
  text: 'A message from Max',
  textDirection: TextDirection.Default,
  timestamp: Date.now(),
};

export default {
  title: 'Components/Conversation/MessageDetail',
  argTypes: {
    message: { control: { type: 'text' } },
    receivedAt: { control: { type: 'number' } },
    sentAt: { control: { type: 'number' } },
  },
  args: {
    contacts: [
      {
        ...getDefaultConversation({
          title: 'Just Max',
        }),
        isOutgoingKeyError: false,
        isUnidentifiedDelivery: false,
        status: SendStatus.Delivered,
      },
    ],
    errors: [],
    message: defaultMessage,
    receivedAt: Date.now(),
    sentAt: Date.now(),

    getPreferredBadge: () => getFakeBadge(),
    i18n,
    platform: 'darwin',
    interactionMode: 'keyboard',
    theme: ThemeType.light,

    toggleSafetyNumberModal: action('toggleSafetyNumberModal'),

    checkForAccount: action('checkForAccount'),
    clearTargetedMessage: action('clearTargetedMessage'),
    showLightboxForViewOnceMedia: action('showLightboxForViewOnceMedia'),
    doubleCheckMissingQuoteReference: action(
      'doubleCheckMissingQuoteReference'
    ),
    kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
    markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
    messageExpanded: action('messageExpanded'),
    showConversation: action('showConversation'),
    openGiftBadge: action('openGiftBadge'),
    renderAudioAttachment: () => <div>AudioAttachment</div>,
    saveAttachment: action('saveAttachment'),
    showSpoiler: action('showSpoiler'),
    retryMessageSend: action('retryMessageSend'),
    pushPanelForConversation: action('pushPanelForConversation'),
    showContactModal: action('showContactModal'),
    showExpiredIncomingTapToViewToast: action(
      'showExpiredIncomingTapToViewToast'
    ),
    showExpiredOutgoingTapToViewToast: action(
      'showExpiredOutgoingTapToViewToast'
    ),
    showLightbox: action('showLightbox'),
    startConversation: action('startConversation'),
    viewStory: action('viewStory'),
  },
} satisfies Meta<Props>;

export function DeliveredIncoming(args: Props): JSX.Element {
  return (
    <MessageDetail
      {...args}
      contacts={[
        {
          ...getDefaultConversation({
            color: 'forest',
            title: 'Max',
          }),
          status: undefined,
          isOutgoingKeyError: false,
          isUnidentifiedDelivery: false,
        },
      ]}
    />
  );
}

export function DeliveredOutgoing(args: Props): JSX.Element {
  return (
    <MessageDetail
      {...args}
      message={{
        ...defaultMessage,
        direction: 'outgoing',
        text: 'A message to Max',
      }}
    />
  );
}

export function MessageStatuses(args: Props): JSX.Element {
  return (
    <MessageDetail
      {...args}
      contacts={[
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
      ]}
      message={{
        ...defaultMessage,
        conversationType: 'group',
        text: 'A message to you all!',
      }}
    />
  );
}

export function NotDelivered(args: Props): JSX.Element {
  return (
    <MessageDetail
      {...args}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      receivedAt={undefined as any}
      message={{
        ...defaultMessage,
        direction: 'outgoing',
        text: 'A message to Max',
      }}
    />
  );
}

export function NoContacts(args: Props): JSX.Element {
  return (
    <MessageDetail
      {...args}
      contacts={[]}
      message={{
        ...defaultMessage,
        direction: 'outgoing',
        text: 'Is anybody there?',
      }}
    />
  );
}

export function AllErrors(args: Props): JSX.Element {
  return (
    <MessageDetail
      {...args}
      errors={[
        {
          name: 'Another Error',
          message: 'Wow, that went bad.',
        },
      ]}
      contacts={[
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
      ]}
    />
  );
}
