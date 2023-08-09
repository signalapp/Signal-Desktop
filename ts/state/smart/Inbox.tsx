// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { AppStateType } from '../ducks/app';
import type { StateType } from '../reducer';
import { Inbox } from '../../components/Inbox';
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

export function SmartInbox(): JSX.Element {
  const i18n = useSelector(getIntl);
  const isCustomizingPreferredReactions = useSelector(
    getIsCustomizingPreferredReactions
  );
  const envelopeTimestamp = useSelector<StateType, number | undefined>(
    state => state.inbox.envelopeTimestamp
  );
  const firstEnvelopeTimestamp = useSelector<StateType, number | undefined>(
    state => state.inbox.firstEnvelopeTimestamp
  );
  const { hasInitialLoadCompleted } = useSelector<StateType, AppStateType>(
    state => state.app
  );

  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const { toggleNavTabsCollapse } = useItemsActions();

  return (
    <Inbox
      envelopeTimestamp={envelopeTimestamp}
      firstEnvelopeTimestamp={firstEnvelopeTimestamp}
      hasInitialLoadCompleted={hasInitialLoadCompleted}
      i18n={i18n}
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
}
