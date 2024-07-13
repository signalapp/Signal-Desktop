// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Environment, getEnvironment } from '../environment';
import type { LocalizerType } from '../types/I18N';
import type { NavTabPanelProps } from './NavTabs';
import { WhatsNewLink } from './WhatsNewLink';
import type { UnreadStats } from '../util/countUnreadStats';

type ChatsTabProps = Readonly<{
  otherTabsUnreadStats: UnreadStats;
  i18n: LocalizerType;
  hasPendingUpdate: boolean;
  hasFailedStorySends: boolean;
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  renderConversationView: () => JSX.Element;
  renderLeftPane: (props: NavTabPanelProps) => JSX.Element;
  renderMiniPlayer: (options: { shouldFlow: boolean }) => JSX.Element;
  selectedConversationId: string | undefined;
  showWhatsNewModal: () => unknown;
}>;

export function ChatsTab({
  otherTabsUnreadStats,
  i18n,
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
            className="Inbox__conversation"
            id={`conversation-${selectedConversationId}`}
          >
            {renderConversationView()}
          </div>
        ) : (
          <div className="Inbox__no-conversation-open">
            {renderMiniPlayer({ shouldFlow: false })}
            <div className="module-splash-screen__logo module-img--128 module-logo-blue" />
            <h3>
              {getEnvironment() !== Environment.Staging
                ? i18n('icu:welcomeToSignal')
                : 'THIS IS A STAGING DESKTOP'}
            </h3>
            <p>
              <WhatsNewLink i18n={i18n} showWhatsNewModal={showWhatsNewModal} />
            </p>
          </div>
        )}
      </div>
    </>
  );
}
