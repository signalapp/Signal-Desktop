// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useState } from 'react';
import type { LocalizerType } from '../types/I18N';
import { NavSidebar, NavSidebarActionButton } from './NavSidebar';
import { CallsList } from './CallsList';
import type { ConversationType } from '../state/ducks/conversations';
import type {
  CallHistoryFilterOptions,
  CallHistoryGroup,
  CallHistoryPagination,
} from '../types/CallDisposition';
import { CallsNewCall } from './CallsNewCall';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import type { ActiveCallStateType } from '../state/ducks/calling';
import { ContextMenu } from './ContextMenu';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { UnreadStats } from '../util/countUnreadStats';

enum CallsTabSidebarView {
  CallsListView,
  NewCallView,
}

type CallsTabProps = Readonly<{
  activeCall: ActiveCallStateType | undefined;
  allConversations: ReadonlyArray<ConversationType>;
  otherTabsUnreadStats: UnreadStats;
  getCallHistoryGroupsCount: (
    options: CallHistoryFilterOptions
  ) => Promise<number>;
  getCallHistoryGroups: (
    options: CallHistoryFilterOptions,
    pagination: CallHistoryPagination
  ) => Promise<Array<CallHistoryGroup>>;
  callHistoryEdition: number;
  getConversation: (id: string) => ConversationType | void;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  i18n: LocalizerType;
  navTabsCollapsed: boolean;
  onClearCallHistory: () => void;
  onMarkCallHistoryRead: (conversationId: string, callId: string) => void;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  preferredLeftPaneWidth: number;
  renderConversationDetails: (
    conversationId: string,
    callHistoryGroup: CallHistoryGroup | null
  ) => JSX.Element;
  regionCode: string | undefined;
  savePreferredLeftPaneWidth: (preferredLeftPaneWidth: number) => void;
}>;

export function CallsTab({
  activeCall,
  allConversations,
  otherTabsUnreadStats,
  getCallHistoryGroupsCount,
  getCallHistoryGroups,
  callHistoryEdition,
  getConversation,
  hasFailedStorySends,
  hasPendingUpdate,
  i18n,
  navTabsCollapsed,
  onClearCallHistory,
  onMarkCallHistoryRead,
  onToggleNavTabsCollapse,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  preferredLeftPaneWidth,
  renderConversationDetails,
  regionCode,
  savePreferredLeftPaneWidth,
}: CallsTabProps): JSX.Element {
  const [sidebarView, setSidebarView] = useState(
    CallsTabSidebarView.CallsListView
  );
  const [selected, setSelected] = useState<{
    conversationId: string;
    callHistoryGroup: CallHistoryGroup | null;
  } | null>(null);
  const [
    confirmClearCallHistoryDialogOpen,
    setConfirmClearCallHistoryDialogOpen,
  ] = useState(false);

  const updateSidebarView = useCallback(
    (newSidebarView: CallsTabSidebarView) => {
      setSidebarView(newSidebarView);
      setSelected(null);
    },
    []
  );

  const handleSelectCallHistoryGroup = useCallback(
    (conversationId: string, callHistoryGroup: CallHistoryGroup) => {
      setSelected({
        conversationId,
        callHistoryGroup,
      });
    },
    []
  );

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelected({ conversationId, callHistoryGroup: null });
  }, []);

  useEscapeHandling(
    sidebarView === CallsTabSidebarView.NewCallView
      ? () => {
          updateSidebarView(CallsTabSidebarView.CallsListView);
        }
      : undefined
  );

  const handleOpenClearCallHistoryDialog = useCallback(() => {
    setConfirmClearCallHistoryDialogOpen(true);
  }, []);

  const handleCloseClearCallHistoryDialog = useCallback(() => {
    setConfirmClearCallHistoryDialogOpen(false);
  }, []);

  const handleOutgoingAudioCallInConversation = useCallback(
    (conversationId: string) => {
      onOutgoingAudioCallInConversation(conversationId);
      updateSidebarView(CallsTabSidebarView.CallsListView);
    },
    [updateSidebarView, onOutgoingAudioCallInConversation]
  );

  const handleOutgoingVideoCallInConversation = useCallback(
    (conversationId: string) => {
      onOutgoingVideoCallInConversation(conversationId);
      updateSidebarView(CallsTabSidebarView.CallsListView);
    },
    [updateSidebarView, onOutgoingVideoCallInConversation]
  );

  useEffect(() => {
    if (selected?.callHistoryGroup != null) {
      selected.callHistoryGroup.children.forEach(child => {
        onMarkCallHistoryRead(selected.conversationId, child.callId);
      });
    }
  }, [selected, onMarkCallHistoryRead]);

  return (
    <>
      <div className="CallsTab">
        <NavSidebar
          i18n={i18n}
          title={
            sidebarView === CallsTabSidebarView.CallsListView
              ? i18n('icu:CallsTab__HeaderTitle--CallsList')
              : i18n('icu:CallsTab__HeaderTitle--NewCall')
          }
          otherTabsUnreadStats={otherTabsUnreadStats}
          hasFailedStorySends={hasFailedStorySends}
          hasPendingUpdate={hasPendingUpdate}
          navTabsCollapsed={navTabsCollapsed}
          onBack={
            sidebarView === CallsTabSidebarView.NewCallView
              ? () => {
                  updateSidebarView(CallsTabSidebarView.CallsListView);
                }
              : null
          }
          onToggleNavTabsCollapse={onToggleNavTabsCollapse}
          requiresFullWidth
          preferredLeftPaneWidth={preferredLeftPaneWidth}
          savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
          actions={
            <>
              {sidebarView === CallsTabSidebarView.CallsListView && (
                <>
                  <NavSidebarActionButton
                    icon={<span className="CallsTab__NewCallActionIcon" />}
                    label={i18n('icu:CallsTab__NewCallActionLabel')}
                    onClick={() => {
                      updateSidebarView(CallsTabSidebarView.NewCallView);
                    }}
                  />
                  <ContextMenu
                    i18n={i18n}
                    menuOptions={[
                      {
                        icon: 'CallsTab__ClearCallHistoryIcon',
                        label: i18n('icu:CallsTab__ClearCallHistoryLabel'),
                        onClick: handleOpenClearCallHistoryDialog,
                      },
                    ]}
                    popperOptions={{
                      placement: 'bottom',
                      strategy: 'absolute',
                    }}
                    portalToRoot
                  >
                    {({ openMenu, onKeyDown }) => {
                      return (
                        <NavSidebarActionButton
                          onClick={openMenu}
                          onKeyDown={onKeyDown}
                          icon={<span className="CallsTab__MoreActionsIcon" />}
                          label={i18n('icu:CallsTab__MoreActionsLabel')}
                        />
                      );
                    }}
                  </ContextMenu>
                </>
              )}
            </>
          }
        >
          {sidebarView === CallsTabSidebarView.CallsListView && (
            <CallsList
              key={CallsTabSidebarView.CallsListView}
              hasActiveCall={activeCall != null}
              getCallHistoryGroupsCount={getCallHistoryGroupsCount}
              getCallHistoryGroups={getCallHistoryGroups}
              callHistoryEdition={callHistoryEdition}
              getConversation={getConversation}
              i18n={i18n}
              selectedCallHistoryGroup={selected?.callHistoryGroup ?? null}
              onSelectCallHistoryGroup={handleSelectCallHistoryGroup}
              onOutgoingAudioCallInConversation={
                handleOutgoingAudioCallInConversation
              }
              onOutgoingVideoCallInConversation={
                handleOutgoingVideoCallInConversation
              }
            />
          )}
          {sidebarView === CallsTabSidebarView.NewCallView && (
            <CallsNewCall
              key={CallsTabSidebarView.NewCallView}
              hasActiveCall={activeCall != null}
              allConversations={allConversations}
              i18n={i18n}
              regionCode={regionCode}
              onSelectConversation={handleSelectConversation}
              onOutgoingAudioCallInConversation={
                handleOutgoingAudioCallInConversation
              }
              onOutgoingVideoCallInConversation={
                handleOutgoingVideoCallInConversation
              }
            />
          )}
        </NavSidebar>
        {selected == null ? (
          <div className="CallsTab__EmptyState">
            <div className="CallsTab__EmptyStateIcon" />
            <p className="CallsTab__EmptyStateLabel">
              {i18n('icu:CallsTab__EmptyStateText')}
            </p>
          </div>
        ) : (
          <div
            className="CallsTab__ConversationCallDetails"
            // Force scrolling to top when a new conversation is selected.
            key={selected.conversationId}
          >
            {renderConversationDetails(
              selected.conversationId,
              selected.callHistoryGroup
            )}
          </div>
        )}
      </div>
      {confirmClearCallHistoryDialogOpen && (
        <ConfirmationDialog
          dialogName="CallsTab__ConfirmClearCallHistory"
          i18n={i18n}
          onClose={handleCloseClearCallHistoryDialog}
          title={i18n('icu:CallsTab__ConfirmClearCallHistory__Title')}
          actions={[
            {
              style: 'negative',
              text: i18n(
                'icu:CallsTab__ConfirmClearCallHistory__ConfirmButton'
              ),
              action: onClearCallHistory,
            },
          ]}
        >
          {i18n('icu:CallsTab__ConfirmClearCallHistory__Body')}
        </ConfirmationDialog>
      )}
    </>
  );
}
