// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { NavTabsProps } from './NavTabs.dom.tsx';
import { NavTabs } from './NavTabs.dom.tsx';
import { NavTab } from '../types/Nav.std.ts';

const { i18n } = window.SignalContext;

const createProps = (
  overrideProps: Partial<NavTabsProps> = {}
): NavTabsProps => ({
  hasFailedStorySends: Boolean(overrideProps.hasFailedStorySends),
  hasPendingUpdate: Boolean(overrideProps.hasPendingUpdate),
  i18n,
  navTabsCollapsed: Boolean(overrideProps.navTabsCollapsed),
  onChangeLocation: action('onChangeLocation'),
  onToggleNavTabsCollapse: action('onToggleNavTabsCollapse'),
  renderCallsTab: () => <div>Calls Tab goes here</div>,
  renderChatsTab: () => <div>Chats Tab goes here</div>,
  renderStoriesTab: () => <div>Stories Tab goes here</div>,
  renderSettingsTab: () => <div>Settings Tab goes here</div>,
  selectedNavTab: overrideProps.selectedNavTab ?? NavTab.Chats,
  storiesEnabled: Boolean(overrideProps.storiesEnabled),
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
