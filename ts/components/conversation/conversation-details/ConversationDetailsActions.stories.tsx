// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import {
  ConversationDetailsActions,
  Props,
} from './ConversationDetailsActions';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationDetailsActions',
  module
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  conversationTitle: overrideProps.conversationTitle || '',
  onBlockAndDelete: action('onBlockAndDelete'),
  onDelete: action('onDelete'),
  i18n,
});

story.add('Basic', () => {
  const props = createProps();

  return <ConversationDetailsActions {...props} />;
});
