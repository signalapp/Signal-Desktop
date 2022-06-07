// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import { NewlyCreatedGroupInvitedContactsDialog } from './NewlyCreatedGroupInvitedContactsDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { ConversationType } from '../state/ducks/conversations';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { ThemeType } from '../types/Util';

const i18n = setupI18n('en', enMessages);

const conversations: Array<ConversationType> = [
  getDefaultConversation({ title: 'Fred Willard' }),
  getDefaultConversation({ title: 'Marc Barraca' }),
];

export default {
  title: 'Components/NewlyCreatedGroupInvitedContactsDialog',
};

export const OneContact = (): JSX.Element => (
  <NewlyCreatedGroupInvitedContactsDialog
    contacts={[conversations[0]]}
    getPreferredBadge={() => undefined}
    i18n={i18n}
    onClose={action('onClose')}
    theme={ThemeType.light}
  />
);

OneContact.story = {
  name: 'One contact',
};

export const TwoContacts = (): JSX.Element => (
  <NewlyCreatedGroupInvitedContactsDialog
    contacts={conversations}
    getPreferredBadge={() => undefined}
    i18n={i18n}
    onClose={action('onClose')}
    theme={ThemeType.light}
  />
);

TwoContacts.story = {
  name: 'Two contacts',
};
