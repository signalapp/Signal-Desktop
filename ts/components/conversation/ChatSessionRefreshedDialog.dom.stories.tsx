// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { ChatSessionRefreshedDialog } from './ChatSessionRefreshedDialog.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ChatSessionRefreshedDialog',
} satisfies Meta;

export function Default(): ReactNode {
  return (
    <ChatSessionRefreshedDialog i18n={i18n}>
      <AxoDialog.StoryTrigger />
    </ChatSessionRefreshedDialog>
  );
}
