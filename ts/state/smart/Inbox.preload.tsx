// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { Inbox } from '../../components/Inbox.dom.js';
import { isNightly } from '../../util/version.std.js';
import { getIntl } from '../selectors/user.std.js';
import { SmartCustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal.preload.js';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions.std.js';
import type { SmartNavTabsProps } from './NavTabs.preload.js';
import { SmartNavTabs } from './NavTabs.preload.js';
import { SmartStoriesTab } from './StoriesTab.preload.js';
import { SmartCallsTab } from './CallsTab.preload.js';
import { useItemsActions } from '../ducks/items.preload.js';
import { getNavTabsCollapsed } from '../selectors/items.dom.js';
import { SmartChatsTab } from './ChatsTab.preload.js';
import { getHasInitialLoadCompleted } from '../selectors/app.std.js';
import {
  getInboxEnvelopeTimestamp,
  getInboxFirstEnvelopeTimestamp,
} from '../selectors/inbox.std.js';
import { SmartPreferences } from './Preferences.preload.js';

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

export const SmartInbox = memo(function SmartInbox(): JSX.Element {
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
