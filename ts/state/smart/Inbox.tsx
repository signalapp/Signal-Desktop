// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { Inbox } from '../../components/Inbox.js';
import { isNightly } from '../../util/version.js';
import { getIntl } from '../selectors/user.js';
import { SmartCustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal.js';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions.js';
import type { SmartNavTabsProps } from './NavTabs.js';
import { SmartNavTabs } from './NavTabs.js';
import { SmartStoriesTab } from './StoriesTab.js';
import { SmartCallsTab } from './CallsTab.js';
import { useItemsActions } from '../ducks/items.js';
import { getNavTabsCollapsed } from '../selectors/items.js';
import { SmartChatsTab } from './ChatsTab.js';
import { getHasInitialLoadCompleted } from '../selectors/app.js';
import {
  getInboxEnvelopeTimestamp,
  getInboxFirstEnvelopeTimestamp,
} from '../selectors/inbox.js';
import { SmartPreferences } from './Preferences.js';

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
