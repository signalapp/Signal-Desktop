// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { NavTabsProps } from './NavTabs.dom.js';
import { NavTabs } from './NavTabs.dom.js';
import { NavTab } from '../types/Nav.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import { ThemeType } from '../types/Util.std.js';

const { i18n } = window.SignalContext;

const createProps = (
  overrideProps: Partial<NavTabsProps> = {}
): NavTabsProps => ({
  badge: overrideProps.badge,
  hasFailedStorySends: Boolean(overrideProps.hasFailedStorySends),
  hasPendingUpdate: Boolean(overrideProps.hasPendingUpdate),
  i18n,
  me: getDefaultConversation(),
  navTabsCollapsed: Boolean(overrideProps.navTabsCollapsed),
  onChangeLocation: action('onChangeLocation'),
  onDismissProfileMovedModal: action('onDismissProfileMovedModal'),
  onToggleNavTabsCollapse: action('onToggleNavTabsCollapse'),
  profileMovedModalNeeded: false,
  renderCallsTab: () => <div>Calls Tab goes here</div>,
  renderChatsTab: () => <div>Chats Tab goes here</div>,
  renderStoriesTab: () => <div>Stories Tab goes here</div>,
  renderSettingsTab: () => <div>Settings Tab goes here</div>,
  selectedNavTab: overrideProps.selectedNavTab ?? NavTab.Chats,
  shouldShowProfileIcon: Boolean(overrideProps.shouldShowProfileIcon),
  storiesEnabled: Boolean(overrideProps.storiesEnabled),
  theme: overrideProps.theme ?? ThemeType.light,
  unreadCallsCount: overrideProps.unreadCallsCount ?? 0,
  unreadConversationsStats: overrideProps.unreadConversationsStats ?? {
    unreadCount: 0,
    unreadMentionsCount: 0,
    readChatsMarkedUnreadCount: 0,
  },
  unreadStoriesCount: overrideProps.unreadStoriesCount ?? 0,
});

export default {
  title: 'Components/NavTabs',
} satisfies Meta<NavTabsProps>;

export function HasPendingUpdate(): JSX.Element {
  return (
    <NavTabs
      {...createProps({
        hasPendingUpdate: true,
      })}
    />
  );
}
