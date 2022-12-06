// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { Props } from './ConversationDetailsActions';
import { ConversationDetailsActions } from './ConversationDetailsActions';

const i18n = setupI18n('en', enMessages);

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationDetailsActions',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  acceptConversation: action('acceptConversation'),
  blockConversation: action('blockConversation'),
  cannotLeaveBecauseYouAreLastAdmin: isBoolean(
    overrideProps.cannotLeaveBecauseYouAreLastAdmin
  )
    ? overrideProps.cannotLeaveBecauseYouAreLastAdmin
    : false,
  conversationId: '123',
  conversationTitle: overrideProps.conversationTitle || '',
  i18n,
  isBlocked: isBoolean(overrideProps.isBlocked),
  isGroup: true,
  left: isBoolean(overrideProps.left) ? overrideProps.left : false,
  onLeave: action('onLeave'),
});

export function Basic(): JSX.Element {
  const props = createProps();

  return <ConversationDetailsActions {...props} />;
}

export function LeftTheGroup(): JSX.Element {
  const props = createProps({ left: true });

  return <ConversationDetailsActions {...props} />;
}

LeftTheGroup.story = {
  name: 'Left the group',
};

export function BlockedAndLeftTheGroup(): JSX.Element {
  const props = createProps({
    left: true,
    isBlocked: true,
    conversationTitle: '😸 Cat Snaps',
  });

  return <ConversationDetailsActions {...props} />;
}

BlockedAndLeftTheGroup.story = {
  name: 'Blocked and left the group',
};

export function CannotLeaveBecauseYouAreTheLastAdmin(): JSX.Element {
  const props = createProps({ cannotLeaveBecauseYouAreLastAdmin: true });

  return <ConversationDetailsActions {...props} />;
}

CannotLeaveBecauseYouAreTheLastAdmin.story = {
  name: 'Cannot leave because you are the last admin',
};

export const _11 = (): JSX.Element => (
  <ConversationDetailsActions {...createProps()} isGroup={false} />
);

_11.story = {
  name: '1:1',
};

export const _11Blocked = (): JSX.Element => (
  <ConversationDetailsActions {...createProps()} isGroup={false} isBlocked />
);

_11Blocked.story = {
  name: '1:1 Blocked',
};
