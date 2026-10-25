// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { NewlyCreatedGroupInvitedContactsDialog } from './NewlyCreatedGroupInvitedContactsDialog.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../types/Util.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/NewlyCreatedGroupInvitedContactsDialog',
} satisfies Meta;

const CONTACTS: ReadonlyArray<ConversationType> = [
  getDefaultConversation({ title: 'Fred Willard' }),
  getDefaultConversation({ title: 'Marc Barraca' }),
  getDefaultConversation({ title: 'Alice Anderson' }),
  getDefaultConversation({ title: 'Bob Brown' }),
  getDefaultConversation({ title: 'Carol Chen' }),
  getDefaultConversation({ title: 'Dave Davis' }),
  getDefaultConversation({ title: 'Erin Evans' }),
  getDefaultConversation({ title: 'Frank Foster' }),
  getDefaultConversation({ title: 'Grace Garcia' }),
  getDefaultConversation({ title: 'Heidi Hughes' }),
];

function getPreferredBadge() {
  return undefined;
}

export function OneContact(): ReactNode {
  return (
    <NewlyCreatedGroupInvitedContactsDialog
      i18n={i18n}
      contacts={CONTACTS.slice(0, 1)}
      getPreferredBadge={getPreferredBadge}
      theme={ThemeType.light}
      onClose={action('onClose')}
    />
  );
}

export function TwoContacts(): ReactNode {
  return (
    <NewlyCreatedGroupInvitedContactsDialog
      i18n={i18n}
      contacts={CONTACTS.slice(0, 2)}
      getPreferredBadge={getPreferredBadge}
      theme={ThemeType.light}
      onClose={action('onClose')}
    />
  );
}

export function ManyContacts(): ReactNode {
  return (
    <NewlyCreatedGroupInvitedContactsDialog
      i18n={i18n}
      contacts={CONTACTS}
      getPreferredBadge={getPreferredBadge}
      theme={ThemeType.light}
      onClose={action('onClose')}
    />
  );
}
