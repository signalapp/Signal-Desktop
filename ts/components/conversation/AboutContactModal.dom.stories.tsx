// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './AboutContactModal.dom.js';
import { AboutContactModal } from './AboutContactModal.dom.js';
import { type ComponentMeta } from '../../storybook/types.std.js';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';

const { i18n } = window.SignalContext;

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
  phoneNumber: '(111) 231-2132',
});

export default {
  title: 'Components/Conversation/AboutContactModal',
  component: AboutContactModal,
  argTypes: {
    isSignalConnection: { control: { type: 'boolean' } },
  },
  args: {
    canAddLabel: false,
    contact: conversation,
    contactLabelEmoji: undefined,
    contactLabelString: undefined,
    contactNameColor: undefined,
    fromOrAddedByTrustedContact: false,
    i18n,
    isSignalConnection: false,
    isEditMemberLabelEnabled: true,
    onClose: action('onClose'),
    onOpenNotePreviewModal: action('onOpenNotePreviewModal'),
    pendingAvatarDownload: false,
    sharedGroupNames: [],
    showProfileEditor: action('showProfileEditor'),
    showQRCodeScreen: action('showQRCodeScreen'),
    showEditMemberLabelScreen: action('showEditMemberLabelScreen'),
    startAvatarDownload: action('startAvatarDownload'),
    toggleProfileNameWarningModal: action('toggleProfileNameWarningModal'),
    toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
    toggleSignalConnectionsModal: action('toggleSignalConnections'),
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} />;
}

export function Me(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} contact={me} />;
}

export function MeWithUsername(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...args}
      contact={{ ...me, username: 'myusername.04' }}
    />
  );
}

export function MeWithLabel(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...{
        ...args,
        contactLabelEmoji: '🐝',
        contactLabelString: 'Worker Bee',
        contactNameColor: '270',
      }}
      contact={me}
    />
  );
}

export function LongLabel(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...{
        ...args,
        contactLabelEmoji: '🐝',
        contactLabelString: '𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫 𒐫',
        contactNameColor: '270',
      }}
      contact={me}
    />
  );
}

export function LongLabelAllEmoji(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...{
        ...args,
        contactLabelEmoji: '🐝',
        contactLabelString: '🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝🐝',
        contactNameColor: '270',
      }}
      contact={me}
    />
  );
}

export function MeWithInvalidLabelEmoji(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...{
        ...args,
        contactLabelEmoji: '@',
        contactLabelString: 'Worker Bee',
        contactNameColor: '270',
      }}
      contact={me}
    />
  );
}

export function MeWithAddLabel(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...{
        ...args,
        canAddLabel: true,
      }}
      contact={me}
    />
  );
}

export function MeWithAddLabelEditDisabled(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...{
        ...args,
        canAddLabel: true,
      }}
      contact={me}
      isEditMemberLabelEnabled={false}
    />
  );
}

export function Verified(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} contact={verifiedConversation} />;
}

export function Blocked(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} contact={blockedConversation} />;
}

export function Pending(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} contact={pendingConversation} />;
}

export function NoMessages(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} contact={noMessages} />;
}

export function WithAbout(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} contact={conversationWithAbout} />;
}

export function SignalConnection(args: PropsType): React.JSX.Element {
  return <AboutContactModal {...args} isSignalConnection />;
}

export function SystemContact(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal {...args} contact={systemContact} isSignalConnection />
  );
}

export function WithSharedGroups(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...args}
      contact={conversationWithSharedGroups}
      sharedGroupNames={['Axolotl lovers']}
      isSignalConnection
    />
  );
}

export function DirectFromTrustedContact(args: PropsType): React.JSX.Element {
  return (
    <AboutContactModal
      {...args}
      contact={conversation}
      fromOrAddedByTrustedContact
    />
  );
}
