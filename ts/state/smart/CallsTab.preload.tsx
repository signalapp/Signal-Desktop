// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { DataReader } from '../../sql/Client.preload.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import {
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../selectors/items.dom.ts';
import { getIntl, getRegionCode } from '../selectors/user.std.ts';
import { CallsTab } from '../../components/CallsTab.dom.tsx';
import {
  getAllConversations,
  getConversationSelector,
  getOtherTabsUnreadStats,
} from '../selectors/conversations.dom.ts';
import { filterAndSortConversations } from '../../util/filterAndSortConversations.std.ts';
import type {
  CallHistoryFilter,
  CallHistoryFilterOptions,
  CallHistoryGroup,
  CallHistoryPagination,
} from '../../types/CallDisposition.std.ts';
import type { ConversationType } from '../ducks/conversations.preload.ts';
import { SmartConversationDetails } from './ConversationDetails.preload.tsx';
import { renderToastManagerWithoutMegaphone } from './ToastManager.preload.tsx';
import { useCallingActions } from '../ducks/calling.preload.ts';
import {
  getActiveCallState,
  getAdhocCallSelector,
  getAllCallLinks,
  getCallSelector,
  getCallLinkSelector,
  getHasAnyAdminCallLinks,
} from '../selectors/calling.std.ts';
import { useCallHistoryActions } from '../ducks/callHistory.preload.ts';
import { getCallHistoryEdition } from '../selectors/callHistory.std.ts';
import { getHasPendingUpdate } from '../selectors/updates.std.ts';
import { getHasAnyFailedStorySends } from '../selectors/stories.preload.ts';
import { SmartCallLinkDetails } from './CallLinkDetails.preload.tsx';
import type { CallLinkType } from '../../types/CallLink.std.ts';
import { filterCallLinks } from '../../util/filterCallLinks.dom.ts';
import { getCallIdFromEra } from '../../util/callDisposition.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';

function getCallHistoryFilter({
  allCallLinks,
  allConversations,
  regionCode,
  options,
}: {
  allConversations: Array<ConversationType>;
  allCallLinks: Array<CallLinkType>;
  regionCode: string | undefined;
  options: CallHistoryFilterOptions;
}): CallHistoryFilter | null {
  const { status } = options;
  const query = options.query.normalize().trim();

  if (query === '') {
    return {
      status,
      callLinkRoomIds: null,
      conversationIds: null,
    };
  }

  let callLinkRoomIds = null;
  let conversationIds = null;

  const currentConversations = allConversations.filter(conversation => {
    return conversation.removalStage == null;
  });

  const filteredConversations = filterAndSortConversations(
    currentConversations,
    query,
    regionCode
  );

  if (filteredConversations.length > 0) {
    conversationIds = filteredConversations.map(conversation => {
      return conversation.id;
    });
  }

  const filteredCallLinks = filterCallLinks(allCallLinks, query);
  if (filteredCallLinks.length > 0) {
    callLinkRoomIds = filteredCallLinks.map(callLink => {
      return callLink.roomId;
    });
  }

  // If the search query resulted in no matching call links or conversations, then
  // no calls will match.
  if (callLinkRoomIds == null && conversationIds == null) {
    return null;
  }

  return {
    status,
    callLinkRoomIds,
    conversationIds,
  };
}

function renderCallLinkDetails(
  roomId: string,
  callHistoryGroup: CallHistoryGroup,
  onClose: () => void
): React.JSX.Element {
  return (
    <SmartCallLinkDetails
      roomId={roomId}
      callHistoryGroup={callHistoryGroup}
      onClose={onClose}
    />
  );
}

function renderConversationDetails(
  conversationId: string,
  callHistoryGroup: CallHistoryGroup | null
): React.JSX.Element {
  return (
    <SmartConversationDetails
      conversationId={conversationId}
      callHistoryGroup={callHistoryGroup}
    />
  );
}

export const SmartCallsTab = memo(function SmartCallsTab() {
  const i18n = useSelector(getIntl);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();

  const allCallLinks = useSelector(getAllCallLinks);
  const allConversations = useSelector(getAllConversations);
  const regionCode = useSelector(getRegionCode);
  const getConversation = useSelector(getConversationSelector);
  const getAdhocCall = useSelector(getAdhocCallSelector);
  const getCall = useSelector(getCallSelector);
  const getCallLink = useSelector(getCallLinkSelector);
  const hasAnyAdminCallLinks = useSelector(getHasAnyAdminCallLinks);

  const activeCall = useSelector(getActiveCallState);
  const callHistoryEdition = useSelector(getCallHistoryEdition);

  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);

  const {
    createCallLink,
    hangUpActiveCall,
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
    peekNotConnectedGroupCall,
    startCallLinkLobbyByRoomId,
    togglePip,
  } = useCallingActions();
  const { clearAllCallHistory, markCallHistoryRead, markCallsTabViewed } =
    useCallHistoryActions();
  const { toggleCallLinkEditModal, toggleConfirmLeaveCallModal } =
    useGlobalModalActions();

  const getCallHistoryGroupsCount = useCallback(
    async (options: CallHistoryFilterOptions) => {
      const callHistoryFilter = getCallHistoryFilter({
        allCallLinks,
        allConversations,
        regionCode,
        options,
      });
      if (callHistoryFilter == null) {
        return 0;
      }
      const count =
        await DataReader.getCallHistoryGroupsCount(callHistoryFilter);
      return count;
    },
    [allCallLinks, allConversations, regionCode]
  );

  const getCallHistoryGroups = useCallback(
    async (
      options: CallHistoryFilterOptions,
      pagination: CallHistoryPagination
    ) => {
      const callHistoryFilter = getCallHistoryFilter({
        allCallLinks,
        allConversations,
        regionCode,
        options,
      });
      if (callHistoryFilter == null) {
        return [];
      }
      const results = await DataReader.getCallHistoryGroups(
        callHistoryFilter,
        pagination
      );
      return results;
    },
    [allCallLinks, allConversations, regionCode]
  );

  const handleCreateCallLink = useCallback(() => {
    createCallLink(roomId => {
      toggleCallLinkEditModal(roomId);
    });
  }, [createCallLink, toggleCallLinkEditModal]);

  useEffect(() => {
    markCallsTabViewed();
  }, [markCallsTabViewed]);

  return (
    <CallsTab
      activeCall={activeCall}
      allConversations={allConversations}
      otherTabsUnreadStats={otherTabsUnreadStats}
      getConversation={getConversation}
      getCallIdFromEra={getCallIdFromEra}
      getCallHistoryGroupsCount={getCallHistoryGroupsCount}
      getCallHistoryGroups={getCallHistoryGroups}
      getAdhocCall={getAdhocCall}
      getCall={getCall}
      getCallLink={getCallLink}
      callHistoryEdition={callHistoryEdition}
      hangUpActiveCall={hangUpActiveCall}
      hasAnyAdminCallLinks={hasAnyAdminCallLinks}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      i18n={i18n}
      navTabsCollapsed={navTabsCollapsed}
      onClearCallHistory={clearAllCallHistory}
      onMarkCallHistoryRead={markCallHistoryRead}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      onCreateCallLink={handleCreateCallLink}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      peekNotConnectedGroupCall={peekNotConnectedGroupCall}
      preferredLeftPaneWidth={preferredLeftPaneWidth}
      renderCallLinkDetails={renderCallLinkDetails}
      renderConversationDetails={renderConversationDetails}
      renderToastManager={renderToastManagerWithoutMegaphone}
      regionCode={regionCode}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      startCallLinkLobbyByRoomId={startCallLinkLobbyByRoomId}
      toggleConfirmLeaveCallModal={toggleConfirmLeaveCallModal}
      togglePip={togglePip}
    />
  );
});
