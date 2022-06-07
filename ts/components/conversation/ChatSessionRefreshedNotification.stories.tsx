// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { ChatSessionRefreshedNotification } from './ChatSessionRefreshedNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ChatSessionRefreshedNotification',
};

export const Default = (): JSX.Element => {
  return (
    <ChatSessionRefreshedNotification
      contactSupport={action('contactSupport')}
      i18n={i18n}
    />
  );
};
