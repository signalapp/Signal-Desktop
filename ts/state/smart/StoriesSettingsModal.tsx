// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { StoriesSettingsModal } from '../../components/StoriesSettingsModal.js';
import {
  getAllSignalConnections,
  getCandidateContactsForNewGroup,
  getConversationByServiceIdSelector,
  getGroupStories,
  getMe,
} from '../selectors/conversations.js';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists.js';
import { getIntl, getTheme } from '../selectors/user.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { getHasStoryViewReceiptSetting } from '../selectors/items.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists.js';
import { useStoriesActions } from '../ducks/stories.js';
import { useConversationsActions } from '../ducks/conversations.js';

export const SmartStoriesSettingsModal = memo(
  function SmartStoriesSettingsModal() {
    const { setStoriesDisabled } = useStoriesActions();
    const { hideStoriesSettings, toggleSignalConnectionsModal } =
      useGlobalModalActions();
    const {
      allowsRepliesChanged,
      createDistributionList,
      deleteDistributionList,
      hideMyStoriesFrom,
      removeMembersFromDistributionList,
      setMyStoriesToAllSignalConnections,
      updateStoryViewers,
    } = useStoryDistributionListsActions();
    const { toggleGroupsForStorySend } = useConversationsActions();

    const signalConnections = useSelector(getAllSignalConnections);
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);
    const storyViewReceiptsEnabled = useSelector(getHasStoryViewReceiptSetting);
    const i18n = useSelector(getIntl);
    const me = useSelector(getMe);
    const candidateConversations = useSelector(getCandidateContactsForNewGroup);
    const distributionLists = useSelector(getDistributionListsWithMembers);
    const groupStories = useSelector(getGroupStories);

    const getConversationByServiceId = useSelector(
      getConversationByServiceIdSelector
    );
    const theme = useSelector(getTheme);

    return (
      <StoriesSettingsModal
        candidateConversations={candidateConversations}
        distributionLists={distributionLists}
        groupStories={groupStories}
        signalConnections={signalConnections}
        hideStoriesSettings={hideStoriesSettings}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        me={me}
        getConversationByServiceId={getConversationByServiceId}
        onDeleteList={deleteDistributionList}
        toggleGroupsForStorySend={toggleGroupsForStorySend}
        onDistributionListCreated={createDistributionList}
        onHideMyStoriesFrom={hideMyStoriesFrom}
        onRemoveMembers={removeMembersFromDistributionList}
        onRepliesNReactionsChanged={allowsRepliesChanged}
        onViewersUpdated={updateStoryViewers}
        setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
        storyViewReceiptsEnabled={storyViewReceiptsEnabled}
        theme={theme}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        setStoriesDisabled={setStoriesDisabled}
      />
    );
  }
);
