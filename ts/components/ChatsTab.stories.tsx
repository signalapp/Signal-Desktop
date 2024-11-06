// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { ComponentMeta } from '../storybook/types';
import type { ChatsTabProps } from './ChatsTab';
import { ChatsTab } from './ChatsTab';

const i18n = setupI18n('en', enMessages);

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
      markedUnread: false,
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
