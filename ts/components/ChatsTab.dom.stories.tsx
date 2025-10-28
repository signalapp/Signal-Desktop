// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { ComponentMeta } from '../storybook/types.std.js';
import type { ChatsTabProps } from './ChatsTab.dom.js';
import { ChatsTab } from './ChatsTab.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ChatsTab',
  component: ChatsTab,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    i18n,
    otherTabsUnreadStats: {
      unreadCount: 0,
      unreadMentionsCount: 0,
      readChatsMarkedUnreadCount: 0,
    },
    isStaging: false,
    hasPendingUpdate: false,
    hasFailedStorySends: false,
    navTabsCollapsed: false,
    onToggleNavTabsCollapse: action('onToggleNavTabsCollapse'),
    renderConversationView: () => <>{null}</>,
    renderLeftPane: () => <>{null}</>,
    renderMiniPlayer: () => <>{null}</>,
    selectedConversationId: undefined,
    showWhatsNewModal: action('showWhatsNewModal'),
  },
} satisfies ComponentMeta<ChatsTabProps>;

export function Basic(args: ChatsTabProps): JSX.Element {
  return (
    <div style={{ height: '100vh' }}>
      <ChatsTab {...args} />
    </div>
  );
}
