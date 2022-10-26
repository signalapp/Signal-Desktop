// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { StoriesSettingsModal } from '../../components/StoriesSettingsModal';
import {
  getAllSignalConnections,
  getCandidateContactsForNewGroup,
  getMe,
} from '../selectors/conversations';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists';
import { getIntl } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getHasStoryViewReceiptSetting } from '../selectors/items';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';
import { useStoriesActions } from '../ducks/stories';

export function SmartStoriesSettingsModal(): JSX.Element | null {
  const { toggleStoriesView, setStoriesDisabled } = useStoriesActions();
  const { hideStoriesSettings, toggleSignalConnectionsModal } =
    useGlobalModalActions();
  const {
    allowsRepliesChanged,
    createDistributionList,
    deleteDistributionList,
    hideMyStoriesFrom,
    removeMemberFromDistributionList,
    setMyStoriesToAllSignalConnections,
    updateStoryViewers,
  } = useStoryDistributionListsActions();
  const signalConnections = useSelector(getAllSignalConnections);

  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const storyViewReceiptsEnabled = useSelector(getHasStoryViewReceiptSetting);
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const me = useSelector(getMe);

  const candidateConversations = useSelector(getCandidateContactsForNewGroup);
  const distributionLists = useSelector(getDistributionListsWithMembers);

  return (
    <StoriesSettingsModal
      candidateConversations={candidateConversations}
      distributionLists={distributionLists}
      signalConnections={signalConnections}
      hideStoriesSettings={hideStoriesSettings}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      me={me}
      onDeleteList={deleteDistributionList}
      onDistributionListCreated={createDistributionList}
      onHideMyStoriesFrom={hideMyStoriesFrom}
      onRemoveMember={removeMemberFromDistributionList}
      onRepliesNReactionsChanged={allowsRepliesChanged}
      onViewersUpdated={updateStoryViewers}
      setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
      storyViewReceiptsEnabled={storyViewReceiptsEnabled}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
      toggleStoriesView={toggleStoriesView}
      setStoriesDisabled={setStoriesDisabled}
    />
  );
}
