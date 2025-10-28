// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import type { NavTabPanelProps } from './NavTabs.dom.js';
import { WhatsNewLink } from './WhatsNewLink.dom.js';
import type { UnreadStats } from '../util/countUnreadStats.std.js';
import type { SmartConversationViewProps } from '../state/smart/ConversationView.preload.js';

export type ChatsTabProps = Readonly<{
  otherTabsUnreadStats: UnreadStats;
  i18n: LocalizerType;
  isStaging: boolean;
  hasPendingUpdate: boolean;
  hasFailedStorySends: boolean;
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  renderConversationView: (props: SmartConversationViewProps) => JSX.Element;
  renderLeftPane: (props: NavTabPanelProps) => JSX.Element;
  renderMiniPlayer: (options: { shouldFlow: boolean }) => JSX.Element;
  selectedConversationId: string | undefined;
  showWhatsNewModal: () => unknown;
}>;

export function ChatsTab({
  otherTabsUnreadStats,
  i18n,
  isStaging,
  hasPendingUpdate,
  hasFailedStorySends,
  navTabsCollapsed,
  onToggleNavTabsCollapse,
  renderConversationView,
  renderLeftPane,
  renderMiniPlayer,
  selectedConversationId,
  showWhatsNewModal,
}: ChatsTabProps): JSX.Element {
  return (
    <>
      <div id="LeftPane">
        {renderLeftPane({
          otherTabsUnreadStats,
          collapsed: navTabsCollapsed,
          hasPendingUpdate,
          hasFailedStorySends,
          onToggleCollapse: onToggleNavTabsCollapse,
        })}
      </div>
      <div className="Inbox__conversation-stack">
        <div id="toast" />
        {selectedConversationId ? (
          <div
            // Use `key` to force the tree to fully re-mount
            key={selectedConversationId}
            className="Inbox__conversation"
            id={`conversation-${selectedConversationId}`}
          >
            {renderConversationView({ selectedConversationId })}
          </div>
        ) : (
          <div className="Inbox__no-conversation-open">
            {renderMiniPlayer({ shouldFlow: false })}
            <div className="module-splash-screen__logo module-splash-screen__logo--96" />
            <h3 className="Inbox__welcome">
              {isStaging
                ? 'THIS IS A STAGING DESKTOP'
                : i18n('icu:welcomeToSignal')}
            </h3>
            <p className="Inbox__whatsnew">
              <WhatsNewLink i18n={i18n} showWhatsNewModal={showWhatsNewModal} />
            </p>
            <div className="Inbox__padding" />
          </div>
        )}
      </div>
    </>
  );
}
