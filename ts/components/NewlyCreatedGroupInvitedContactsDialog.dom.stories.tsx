// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './NewlyCreatedGroupInvitedContactsDialog.dom.js';
import { NewlyCreatedGroupInvitedContactsDialog } from './NewlyCreatedGroupInvitedContactsDialog.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import { ThemeType } from '../types/Util.std.js';

const { i18n } = window.SignalContext;

const conversations: Array<ConversationType> = [
  getDefaultConversation({ title: 'Fred Willard' }),
  getDefaultConversation({ title: 'Marc Barraca' }),
];

export default {
  title: 'Components/NewlyCreatedGroupInvitedContactsDialog',
} satisfies Meta<PropsType>;

export function OneContact(): JSX.Element {
  return (
    <NewlyCreatedGroupInvitedContactsDialog
      contacts={[conversations[0]]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onClose={action('onClose')}
      theme={ThemeType.light}
    />
  );
}

export function TwoContacts(): JSX.Element {
  return (
    <NewlyCreatedGroupInvitedContactsDialog
      contacts={conversations}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onClose={action('onClose')}
      theme={ThemeType.light}
    />
  );
}
