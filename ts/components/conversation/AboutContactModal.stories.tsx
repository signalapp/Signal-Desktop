// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './AboutContactModal';
import { AboutContactModal } from './AboutContactModal';
import { type ComponentMeta } from '../../storybook/types';
import { setupI18n } from '../../util/setupI18n';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const conversation = getDefaultConversation({
  acceptedMessageRequest: true,
  hasMessages: true,
});
const verifiedConversation = getDefaultConversation({
  acceptedMessageRequest: true,
  isVerified: true,
  hasMessages: true,
});
const blockedConversation = getDefaultConversation({
  acceptedMessageRequest: true,
  isBlocked: true,
  hasMessages: true,
});
const pendingConversation = getDefaultConversation({
  acceptedMessageRequest: false,
  hasMessages: true,
});
const noMessages = getDefaultConversation({
  hasMessages: false,
});
const conversationWithAbout = getDefaultConversation({
  acceptedMessageRequest: true,
  aboutText: '😀 About Me',
  hasMessages: true,
});
const conversationWithSharedGroups = getDefaultConversation({
  acceptedMessageRequest: true,
  aboutText: 'likes to chat',
  hasMessages: true,
  sharedGroupNames: ['Axolotl lovers'],
});
const systemContact = getDefaultConversation({
  acceptedMessageRequest: true,
  systemGivenName: 'Alice',
  phoneNumber: '+1 555 123-4567',
  hasMessages: true,
});
const me = getDefaultConversation({
  isMe: true,
  acceptedMessageRequest: true,
  hasMessages: true,
});

export default {
  title: 'Components/Conversation/AboutContactModal',
  component: AboutContactModal,
  argTypes: {
    isSignalConnection: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    onClose: action('onClose'),
    onOpenNotePreviewModal: action('onOpenNotePreviewModal'),
    toggleSignalConnectionsModal: action('toggleSignalConnections'),
    toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
    updateSharedGroups: action('updateSharedGroups'),
    unblurAvatar: action('unblurAvatar'),
    conversation,
    isSignalConnection: false,
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} />;
}

export function Me(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} conversation={me} />;
}

export function Verified(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} conversation={verifiedConversation} />;
}

export function Blocked(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} conversation={blockedConversation} />;
}

export function Pending(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} conversation={pendingConversation} />;
}

export function NoMessages(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} conversation={noMessages} />;
}

export function WithAbout(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} conversation={conversationWithAbout} />;
}

export function SignalConnection(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} isSignalConnection />;
}

export function SystemContact(args: PropsType): JSX.Element {
  return (
    <AboutContactModal
      {...args}
      conversation={systemContact}
      isSignalConnection
    />
  );
}

export function WithSharedGroups(args: PropsType): JSX.Element {
  return (
    <AboutContactModal
      {...args}
      conversation={conversationWithSharedGroups}
      isSignalConnection
    />
  );
}
