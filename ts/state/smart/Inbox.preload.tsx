// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { Inbox } from '../../components/Inbox.dom.tsx';
import { isNightly } from '../../util/version.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import { SmartCustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal.preload.tsx';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions.std.ts';
import type { SmartNavTabsProps } from './NavTabs.preload.tsx';
import { SmartNavTabs } from './NavTabs.preload.tsx';
import { SmartStoriesTab } from './StoriesTab.preload.tsx';
import { SmartCallsTab } from './CallsTab.preload.tsx';
import { useItemsActions } from '../ducks/items.preload.ts';
import { getNavTabsCollapsed } from '../selectors/items.dom.ts';
import { SmartChatsTab } from './ChatsTab.preload.tsx';
import { getHasInitialLoadCompleted } from '../selectors/app.std.ts';
import {
  getInboxEnvelopeTimestamp,
  getInboxFirstEnvelopeTimestamp,
} from '../selectors/inbox.std.ts';
import { SmartPreferences } from './Preferences.preload.tsx';

function renderChatsTab() {
  return <SmartChatsTab />;
}

function renderCallsTab() {
  return <SmartCallsTab />;
}

function renderCustomizingPreferredReactionsModal() {
  return <SmartCustomizingPreferredReactionsModal />;
}

function renderNavTabs(props: SmartNavTabsProps) {
  return <SmartNavTabs {...props} />;
}

function renderStoriesTab() {
  return <SmartStoriesTab />;
}

function renderSettingsTab() {
  return <SmartPreferences />;
}

export const SmartInbox = memo(function SmartInbox(): React.JSX.Element {
  const i18n = useSelector(getIntl);
  const isCustomizingPreferredReactions = useSelector(
    getIsCustomizingPreferredReactions
  );
  const envelopeTimestamp = useSelector(getInboxEnvelopeTimestamp);
  const firstEnvelopeTimestamp = useSelector(getInboxFirstEnvelopeTimestamp);
  const hasInitialLoadCompleted = useSelector(getHasInitialLoadCompleted);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);

  const { toggleNavTabsCollapse } = useItemsActions();

  return (
    <Inbox
      envelopeTimestamp={envelopeTimestamp}
      firstEnvelopeTimestamp={firstEnvelopeTimestamp}
      hasInitialLoadCompleted={hasInitialLoadCompleted}
      i18n={i18n}
      isNightly={isNightly(window.getVersion())}
      isCustomizingPreferredReactions={isCustomizingPreferredReactions}
      navTabsCollapsed={navTabsCollapsed}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      renderChatsTab={renderChatsTab}
      renderCallsTab={renderCallsTab}
      renderCustomizingPreferredReactionsModal={
        renderCustomizingPreferredReactionsModal
      }
      renderNavTabs={renderNavTabs}
      renderStoriesTab={renderStoriesTab}
      renderSettingsTab={renderSettingsTab}
    />
  );
});
