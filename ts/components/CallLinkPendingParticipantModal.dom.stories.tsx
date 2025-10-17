// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { CallLinkPendingParticipantModalProps } from './CallLinkPendingParticipantModal.dom.js';
import { CallLinkPendingParticipantModal } from './CallLinkPendingParticipantModal.dom.js';
import type { ComponentMeta } from '../storybook/types.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';

const { i18n } = window.SignalContext;

const conversation = getDefaultConversation({
  acceptedMessageRequest: true,
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

export default {
  title: 'Components/CallLinkPendingParticipantModal',
  component: CallLinkPendingParticipantModal,
  args: {
    i18n,
    conversation,
    approveUser: action('approveUser'),
    denyUser: action('denyUser'),
    toggleAboutContactModal: action('toggleAboutContactModal'),
    onClose: action('onClose'),
    updateSharedGroups: action('updateSharedGroups'),
  },
} satisfies ComponentMeta<CallLinkPendingParticipantModalProps>;

export function Default(
  args: CallLinkPendingParticipantModalProps
): JSX.Element {
  return <CallLinkPendingParticipantModal {...args} />;
}

export function SystemContact(
  args: CallLinkPendingParticipantModalProps
): JSX.Element {
  return (
    <CallLinkPendingParticipantModal {...args} conversation={systemContact} />
  );
}

export function WithSharedGroups(
  args: CallLinkPendingParticipantModalProps
): JSX.Element {
  return (
    <CallLinkPendingParticipantModal
      {...args}
      conversation={conversationWithSharedGroups}
    />
  );
}
