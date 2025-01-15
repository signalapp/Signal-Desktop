// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { DataReader } from '../../sql/Client';
import { useItemsActions } from '../ducks/items';
import {
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../selectors/items';
import { getIntl, getRegionCode } from '../selectors/user';
import type { WidthBreakpoint } from '../../components/_util';
import { CallsTab } from '../../components/CallsTab';
import {
  getAllConversations,
  getConversationSelector,
} from '../selectors/conversations';
import { filterAndSortConversations } from '../../util/filterAndSortConversations';
import type {
  CallHistoryFilter,
  CallHistoryFilterOptions,
  CallHistoryGroup,
  CallHistoryPagination,
} from '../../types/CallDisposition';
import type { ConversationType } from '../ducks/conversations';
import { SmartConversationDetails } from './ConversationDetails';
import { SmartToastManager } from './ToastManager';
import { useCallingActions } from '../ducks/calling';
import {
  getActiveCallState,
  getAdhocCallSelector,
  getAllCallLinks,
  getCallSelector,
  getCallLinkSelector,
  getHasAnyAdminCallLinks,
} from '../selectors/calling';
import { useCallHistoryActions } from '../ducks/callHistory';
import { getCallHistoryEdition } from '../selectors/callHistory';
import { getHasPendingUpdate } from '../selectors/updates';
import { getHasAnyFailedStorySends } from '../selectors/stories';
import { getOtherTabsUnreadStats } from '../selectors/nav';
import { SmartCallLinkDetails } from './CallLinkDetails';
import type { CallLinkType } from '../../types/CallLink';
import { filterCallLinks } from '../../util/filterCallLinks';
import { useGlobalModalActions } from '../ducks/globalModals';

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
): JSX.Element {
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
): JSX.Element {
  return (
    <SmartConversationDetails
      conversationId={conversationId}
      callHistoryGroup={callHistoryGroup}
    />
  );
}

function renderToastManager(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager disableMegaphone {...props} />;
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
      renderToastManager={renderToastManager}
      regionCode={regionCode}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      startCallLinkLobbyByRoomId={startCallLinkLobbyByRoomId}
      toggleConfirmLeaveCallModal={toggleConfirmLeaveCallModal}
      togglePip={togglePip}
    />
  );
});
