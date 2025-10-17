// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ChatSessionRefreshedDialog.dom.js';
import { ChatSessionRefreshedDialog } from './ChatSessionRefreshedDialog.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ChatSessionRefreshedDialog',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return (
    <ChatSessionRefreshedDialog
      contactSupport={action('contactSupport')}
      onClose={action('onClose')}
      i18n={i18n}
    />
  );
}
