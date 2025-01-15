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
import { CallsNewCall } from './CallsNewCallButton';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import type {
  ActiveCallStateType,
  PeekNotConnectedGroupCallType,
} from '../state/ducks/calling';
import { ContextMenu } from './ContextMenu';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { UnreadStats } from '../util/countUnreadStats';
import type { WidthBreakpoint } from './_util';
import type { CallLinkType } from '../types/CallLink';
import type { CallStateType } from '../state/selectors/calling';
import type { StartCallData } from './ConfirmLeaveCallModal';
import { I18n } from './I18n';

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
  getAdhocCall: (roomId: string) => CallStateType | undefined;
  getCall: (id: string) => CallStateType | undefined;
  getCallLink: (id: string) => CallLinkType | undefined;
  getConversation: (id: string) => ConversationType | void;
  hangUpActiveCall: (reason: string) => void;
  hasAnyAdminCallLinks: boolean;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  i18n: LocalizerType;
  navTabsCollapsed: boolean;
  onClearCallHistory: () => void;
  onMarkCallHistoryRead: (conversationId: string, callId: string) => void;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  onCreateCallLink: () => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  peekNotConnectedGroupCall: (options: PeekNotConnectedGroupCallType) => void;
  preferredLeftPaneWidth: number;
  renderCallLinkDetails: (
    roomId: string,
    callHistoryGroup: CallHistoryGroup,
    onClose: () => void
  ) => JSX.Element;
  renderConversationDetails: (
    conversationId: string,
    callHistoryGroup: CallHistoryGroup | null
  ) => JSX.Element;
  renderToastManager: (_: {
    containerWidthBreakpoint: WidthBreakpoint;
  }) => JSX.Element;
  regionCode: string | undefined;
  savePreferredLeftPaneWidth: (preferredLeftPaneWidth: number) => void;
  startCallLinkLobbyByRoomId: (options: { roomId: string }) => void;
  toggleConfirmLeaveCallModal: (options: StartCallData | null) => void;
  togglePip: () => void;
}>;

export type CallsTabSelectedView =
  | {
      type: 'conversation';
      conversationId: string;
      callHistoryGroup: CallHistoryGroup | null;
    }
  | {
      type: 'callLink';
      roomId: string;
      callHistoryGroup: CallHistoryGroup;
    };

export function CallsTab({
  activeCall,
  allConversations,
  otherTabsUnreadStats,
  getCallHistoryGroupsCount,
  getCallHistoryGroups,
  callHistoryEdition,
  getAdhocCall,
  getCall,
  getCallLink,
  getConversation,
  hangUpActiveCall,
  hasAnyAdminCallLinks,
  hasFailedStorySends,
  hasPendingUpdate,
  i18n,
  navTabsCollapsed,
  onClearCallHistory,
  onMarkCallHistoryRead,
  onToggleNavTabsCollapse,
  onCreateCallLink,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  peekNotConnectedGroupCall,
  preferredLeftPaneWidth,
  renderCallLinkDetails,
  renderConversationDetails,
  renderToastManager,
  regionCode,
  savePreferredLeftPaneWidth,
  startCallLinkLobbyByRoomId,
  toggleConfirmLeaveCallModal,
  togglePip,
}: CallsTabProps): JSX.Element {
  const [sidebarView, setSidebarView] = useState(
    CallsTabSidebarView.CallsListView
  );
  const [selectedView, setSelectedViewInner] =
    useState<CallsTabSelectedView | null>(null);
  const [selectedViewKey, setSelectedViewKey] = useState(() => 1);

  const [
    confirmClearCallHistoryDialogOpen,
    setConfirmClearCallHistoryDialogOpen,
  ] = useState(false);

  const updateSelectedView = useCallback(
    (nextSelected: CallsTabSelectedView | null) => {
      setSelectedViewInner(nextSelected);
      setSelectedViewKey(key => key + 1);
    },
    []
  );

  const updateSidebarView = useCallback(
    (newSidebarView: CallsTabSidebarView) => {
      setSidebarView(newSidebarView);
      updateSelectedView(null);
    },
    [updateSelectedView]
  );

  const onCloseSelectedView = useCallback(() => {
    updateSelectedView(null);
  }, [updateSelectedView]);

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
    if (selectedView?.type === 'conversation') {
      selectedView.callHistoryGroup?.children.forEach(child => {
        onMarkCallHistoryRead(selectedView.conversationId, child.callId);
      });
    }
  }, [selectedView, onMarkCallHistoryRead]);

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
          renderToastManager={renderToastManager}
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
                    {({ onClick, onKeyDown, ref }) => {
                      return (
                        <NavSidebarActionButton
                          ref={ref}
                          onClick={onClick}
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
              activeCall={activeCall}
              getCallHistoryGroupsCount={getCallHistoryGroupsCount}
              getCallHistoryGroups={getCallHistoryGroups}
              callHistoryEdition={callHistoryEdition}
              getAdhocCall={getAdhocCall}
              getCall={getCall}
              getCallLink={getCallLink}
              getConversation={getConversation}
              hangUpActiveCall={hangUpActiveCall}
              i18n={i18n}
              selectedCallHistoryGroup={selectedView?.callHistoryGroup ?? null}
              onChangeCallsTabSelectedView={updateSelectedView}
              onCreateCallLink={onCreateCallLink}
              onOutgoingAudioCallInConversation={
                handleOutgoingAudioCallInConversation
              }
              onOutgoingVideoCallInConversation={
                handleOutgoingVideoCallInConversation
              }
              peekNotConnectedGroupCall={peekNotConnectedGroupCall}
              startCallLinkLobbyByRoomId={startCallLinkLobbyByRoomId}
              toggleConfirmLeaveCallModal={toggleConfirmLeaveCallModal}
              togglePip={togglePip}
            />
          )}
          {sidebarView === CallsTabSidebarView.NewCallView && (
            <CallsNewCall
              key={CallsTabSidebarView.NewCallView}
              hasActiveCall={activeCall != null}
              allConversations={allConversations}
              i18n={i18n}
              regionCode={regionCode}
              onChangeCallsTabSelectedView={updateSelectedView}
              onOutgoingAudioCallInConversation={
                handleOutgoingAudioCallInConversation
              }
              onOutgoingVideoCallInConversation={
                handleOutgoingVideoCallInConversation
              }
            />
          )}
        </NavSidebar>
        {selectedView == null ? (
          <div className="CallsTab__EmptyState">
            <div className="CallsTab__EmptyStateIcon" />
            <p className="CallsTab__EmptyStateLabel">
              <I18n
                i18n={i18n}
                id="icu:CallsTab__EmptyStateText--with-icon-2"
                components={{
                  // eslint-disable-next-line react/no-unstable-nested-components
                  newCallButtonIcon: () => {
                    return (
                      <span
                        className="CallsTab__EmptyState__ActionIcon"
                        aria-label={i18n('icu:CallsTab__NewCallActionLabel')}
                      />
                    );
                  },
                }}
              />
            </p>
          </div>
        ) : (
          <div
            className="CallsTab__ConversationCallDetails"
            // Force scrolling to top when selection changes
            key={selectedViewKey}
          >
            {selectedView.type === 'conversation' &&
              renderConversationDetails(
                selectedView.conversationId,
                selectedView.callHistoryGroup
              )}
            {selectedView.type === 'callLink' &&
              renderCallLinkDetails(
                selectedView.roomId,
                selectedView.callHistoryGroup,
                onCloseSelectedView
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
          {hasAnyAdminCallLinks
            ? i18n('icu:CallsTab__ConfirmClearCallHistory__Body--call-links')
            : i18n('icu:CallsTab__ConfirmClearCallHistory__Body')}
        </ConfirmationDialog>
      )}
    </>
  );
}
