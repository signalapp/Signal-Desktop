// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
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
} from '../selectors/calling';
import { useCallHistoryActions } from '../ducks/callHistory';
import { getCallHistoryEdition } from '../selectors/callHistory';
import { getHasPendingUpdate } from '../selectors/updates';
import { getHasAnyFailedStorySends } from '../selectors/stories';
import { getOtherTabsUnreadStats } from '../selectors/nav';
import type { CallLinkType } from '../../types/CallLink';
import { filterCallLinks } from '../../util/filterCallLinks';

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

  const activeCall = useSelector(getActiveCallState);
  const callHistoryEdition = useSelector(getCallHistoryEdition);

  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);

  const {
    hangUpActiveCall,
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
    peekNotConnectedGroupCall,
    startCallLinkLobbyByRoomId,
    togglePip,
  } = useCallingActions();
  const {
    clearAllCallHistory: clearCallHistory,
    markCallHistoryRead,
    markCallsTabViewed,
  } = useCallHistoryActions();

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
      const count = await window.Signal.Data.getCallHistoryGroupsCount(
        callHistoryFilter
      );
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
      const results = await window.Signal.Data.getCallHistoryGroups(
        callHistoryFilter,
        pagination
      );
      return results;
    },
    [allCallLinks, allConversations, regionCode]
  );

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
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      i18n={i18n}
      navTabsCollapsed={navTabsCollapsed}
      onClearCallHistory={clearCallHistory}
      onMarkCallHistoryRead={markCallHistoryRead}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      peekNotConnectedGroupCall={peekNotConnectedGroupCall}
      preferredLeftPaneWidth={preferredLeftPaneWidth}
      renderConversationDetails={renderConversationDetails}
      renderToastManager={renderToastManager}
      regionCode={regionCode}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      startCallLinkLobbyByRoomId={startCallLinkLobbyByRoomId}
      togglePip={togglePip}
    />
  );
});
