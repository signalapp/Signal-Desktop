// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import type { SmartNavTabsProps } from '../state/smart/NavTabs.preload.tsx';
import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';

export type PropsType = {
  isCustomizingPreferredReactions: boolean;
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => unknown;
  renderCallsTab: () => React.JSX.Element;
  renderChatsTab: () => React.JSX.Element;
  renderCustomizingPreferredReactionsModal: () => React.JSX.Element;
  renderNavTabs: (props: SmartNavTabsProps) => React.JSX.Element;
  renderStoriesTab: () => React.JSX.Element;
  renderSettingsTab: () => React.JSX.Element;
};

export function Inbox({
  isCustomizingPreferredReactions,
  navTabsCollapsed,
  onToggleNavTabsCollapse,
  renderCallsTab,
  renderChatsTab,
  renderCustomizingPreferredReactionsModal,
  renderNavTabs,
  renderStoriesTab,
  renderSettingsTab,
}: PropsType): React.JSX.Element {
  let activeModal: ReactNode;
  if (isCustomizingPreferredReactions) {
    activeModal = renderCustomizingPreferredReactionsModal();
  }

  return (
    <>
      <div className="Inbox">
        {renderNavTabs({
          navTabsCollapsed,
          onToggleNavTabsCollapse,
          renderChatsTab,
          renderCallsTab,
          renderStoriesTab,
          renderSettingsTab,
        })}
        <TitlebarDragArea />
      </div>
      {activeModal}
    </>
  );
}
