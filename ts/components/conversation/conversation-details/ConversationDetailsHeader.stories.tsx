// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { number, text } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { ConversationType } from '../../../state/ducks/conversations';

import { ConversationDetailsHeader, Props } from './ConversationDetailsHeader';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationDetailHeader',
  module
);

const createConversation = (): ConversationType => ({
  id: '',
  markedUnread: false,
  type: 'group',
  lastUpdated: 0,
  title: text('conversation title', 'Some Conversation'),
  memberships: new Array(number('conversation members length', 0)),
});

const createProps = (): Props => ({
  conversation: createConversation(),
  i18n,
});

story.add('Basic', () => {
  const props = createProps();

  return <ConversationDetailsHeader {...props} />;
});
