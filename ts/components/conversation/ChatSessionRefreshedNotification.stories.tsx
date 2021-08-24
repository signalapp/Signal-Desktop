// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { ChatSessionRefreshedNotification } from './ChatSessionRefreshedNotification';

const i18n = setupI18n('en', enMessages);

storiesOf(
  'Components/Conversation/ChatSessionRefreshedNotification',
  module
).add('Default', () => {
  return (
    <ChatSessionRefreshedNotification
      contactSupport={action('contactSupport')}
      i18n={i18n}
    />
  );
});
