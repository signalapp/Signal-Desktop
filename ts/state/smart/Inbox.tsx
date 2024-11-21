// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { Inbox } from '../../components/Inbox';
import { isNightly } from '../../util/version';
import { getIntl } from '../selectors/user';
import { SmartCustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions';
import type { SmartNavTabsProps } from './NavTabs';
import { SmartNavTabs } from './NavTabs';
import { SmartStoriesTab } from './StoriesTab';
import { SmartCallsTab } from './CallsTab';
import { useItemsActions } from '../ducks/items';
import { getNavTabsCollapsed } from '../selectors/items';
import { SmartChatsTab } from './ChatsTab';
import { getHasInitialLoadCompleted } from '../selectors/app';
import {
  getInboxEnvelopeTimestamp,
  getInboxFirstEnvelopeTimestamp,
} from '../selectors/inbox';

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
    />
  );
});
