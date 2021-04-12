// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { NewlyCreatedGroupInvitedContactsDialog } from './NewlyCreatedGroupInvitedContactsDialog';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { ConversationType } from '../state/ducks/conversations';

const i18n = setupI18n('en', enMessages);

const conversations: Array<ConversationType> = [
  {
    id: 'fred-convo',
    isSelected: false,
    lastUpdated: Date.now(),
    markedUnread: false,
    title: 'Fred Willard',
    type: 'direct',
  },
  {
    id: 'marc-convo',
    isSelected: true,
    lastUpdated: Date.now(),
    markedUnread: false,
    title: 'Marc Barraca',
    type: 'direct',
  },
];

const story = storiesOf(
  'Components/NewlyCreatedGroupInvitedContactsDialog',
  module
);

story.add('One contact', () => (
  <NewlyCreatedGroupInvitedContactsDialog
    contacts={[conversations[0]]}
    i18n={i18n}
    onClose={action('onClose')}
  />
));

story.add('Two contacts', () => (
  <NewlyCreatedGroupInvitedContactsDialog
    contacts={conversations}
    i18n={i18n}
    onClose={action('onClose')}
  />
));
