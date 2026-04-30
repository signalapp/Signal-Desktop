// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ConversationDetailsActions.dom.tsx';
import { ConversationDetailsActions } from './ConversationDetailsActions.dom.tsx';

const { isBoolean } = lodash;

const { i18n } = window.SignalContext;

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationDetailsActions',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  acceptConversation: action('acceptConversation'),
  blockConversation: action('blockConversation'),
  canTerminateGroup: isBoolean(overrideProps.canTerminateGroup)
    ? overrideProps.canTerminateGroup
    : true,
  cannotLeaveBecauseYouAreLastAdmin: isBoolean(
    overrideProps.cannotLeaveBecauseYouAreLastAdmin
  )
    ? overrideProps.cannotLeaveBecauseYouAreLastAdmin
    : false,
  conversationId: '123',
  conversationTitle: overrideProps.conversationTitle || '',
  i18n,
  isArchived: isBoolean(overrideProps.isArchived)
    ? overrideProps.isArchived
    : false,
  isBlocked: isBoolean(overrideProps.isBlocked),
  isGroup: true,
  isGroupTerminated: isBoolean(overrideProps.isGroupTerminated)
    ? overrideProps.isGroupTerminated
    : false,
  isSignalConversation: false,
  left: isBoolean(overrideProps.left) ? overrideProps.left : false,
  onArchive: action('onArchive'),
  onDelete: action('onDelet'),
  onLeave: action('onLeave'),
  onReportSpamAndBlock: action('onBlockAndReportSpam'),
  onReportSpam: action('onReportSpam'),
  onTerminateGroup: action('onTerminateGroup'),
  onUnarchive: action('onUnarchive'),
});

export function Basic(): JSX.Element {
  const props = createProps();

  return <ConversationDetailsActions {...props} />;
}

export function LeftTheGroup(): JSX.Element {
  const props = createProps({ left: true });

  return <ConversationDetailsActions {...props} />;
}

export function BlockedAndLeftTheGroup(): JSX.Element {
  const props = createProps({
    left: true,
    isBlocked: true,
    conversationTitle: '😸 Cat Snaps',
  });

  return <ConversationDetailsActions {...props} />;
}

export function CanTerminateGroup(): JSX.Element {
  const props = createProps({
    canTerminateGroup: true,
    conversationTitle: '😸 Cat Snaps',
  });

  return <ConversationDetailsActions {...props} />;
}

export function GroupTerminated(): JSX.Element {
  const props = createProps({
    canTerminateGroup: false,
    isGroupTerminated: true,
    conversationTitle: '😸 Cat Snaps',
  });

  return <ConversationDetailsActions {...props} />;
}

export function GroupTerminatedArchived(): JSX.Element {
  const props = createProps({
    canTerminateGroup: false,
    isArchived: true,
    isGroupTerminated: true,
    conversationTitle: '😸 Cat Snaps',
  });

  return <ConversationDetailsActions {...props} />;
}

export function CannotLeaveBecauseYouAreTheLastAdmin(): JSX.Element {
  const props = createProps({ cannotLeaveBecauseYouAreLastAdmin: true });

  return <ConversationDetailsActions {...props} />;
}

export const _11 = (): JSX.Element => (
  <ConversationDetailsActions {...createProps()} isGroup={false} />
);

export const _11Blocked = (): JSX.Element => (
  <ConversationDetailsActions {...createProps()} isGroup={false} isBlocked />
);
