// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './ChatSessionRefreshedNotification';
import { ChatSessionRefreshedNotification } from './ChatSessionRefreshedNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ChatSessionRefreshedNotification',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <ChatSessionRefreshedNotification i18n={i18n} />;
}
