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

const conversation = getDefaultConversation();
const conversationWithAbout = getDefaultConversation({
  aboutText: '😀 About Me',
});
const systemContact = getDefaultConversation({
  systemGivenName: 'Alice',
  phoneNumber: '+1 555 123-4567',
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
    toggleSignalConnectionsModal: action('toggleSignalConnections'),
    updateSharedGroups: action('updateSharedGroups'),
    conversation,
    isSignalConnection: false,
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <AboutContactModal {...args} />;
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
