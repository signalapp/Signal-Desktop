// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect } from 'react';
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
import { filterAndSortConversationsByRecent } from '../../util/filterAndSortConversations';
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
import { getActiveCallState } from '../selectors/calling';
import { useCallHistoryActions } from '../ducks/callHistory';
import { getCallHistoryEdition } from '../selectors/callHistory';
import { getHasPendingUpdate } from '../selectors/updates';
import { getHasAnyFailedStorySends } from '../selectors/stories';
import { getOtherTabsUnreadStats } from '../selectors/nav';

function getCallHistoryFilter(
  allConversations: Array<ConversationType>,
  regionCode: string | undefined,
  options: CallHistoryFilterOptions
): CallHistoryFilter | null {
  const query = options.query.normalize().trim();

  if (query !== '') {
    const currentConversations = allConversations.filter(conversation => {
      return conversation.removalStage == null;
    });

    const filteredConversations = filterAndSortConversationsByRecent(
      currentConversations,
      query,
      regionCode
    );

    // If there are no matching conversations, then no calls will match.
    if (filteredConversations.length === 0) {
      return null;
    }

    return {
      status: options.status,
      conversationIds: filteredConversations.map(conversation => {
        return conversation.id;
      }),
    };
  }

  return {
    status: options.status,
    conversationIds: null,
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

export function SmartCallsTab(): JSX.Element {
  const i18n = useSelector(getIntl);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();

  const allConversations = useSelector(getAllConversations);
  const regionCode = useSelector(getRegionCode);
  const getConversation = useSelector(getConversationSelector);

  const activeCall = useSelector(getActiveCallState);
  const callHistoryEdition = useSelector(getCallHistoryEdition);

  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);

  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const {
    clearAllCallHistory: clearCallHistory,
    markCallHistoryRead,
    markCallsTabViewed,
  } = useCallHistoryActions();

  const getCallHistoryGroupsCount = useCallback(
    async (options: CallHistoryFilterOptions) => {
      const callHistoryFilter = getCallHistoryFilter(
        allConversations,
        regionCode,
        options
      );
      if (callHistoryFilter == null) {
        return 0;
      }
      const count = await window.Signal.Data.getCallHistoryGroupsCount(
        callHistoryFilter
      );
      return count;
    },
    [allConversations, regionCode]
  );

  const getCallHistoryGroups = useCallback(
    async (
      options: CallHistoryFilterOptions,
      pagination: CallHistoryPagination
    ) => {
      const callHistoryFilter = getCallHistoryFilter(
        allConversations,
        regionCode,
        options
      );
      if (callHistoryFilter == null) {
        return [];
      }
      const results = await window.Signal.Data.getCallHistoryGroups(
        callHistoryFilter,
        pagination
      );
      return results;
    },
    [allConversations, regionCode]
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
      callHistoryEdition={callHistoryEdition}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      i18n={i18n}
      navTabsCollapsed={navTabsCollapsed}
      onClearCallHistory={clearCallHistory}
      onMarkCallHistoryRead={markCallHistoryRead}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      preferredLeftPaneWidth={preferredLeftPaneWidth}
      renderConversationDetails={renderConversationDetails}
      renderToastManager={renderToastManager}
      regionCode={regionCode}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
    />
  );
}
