// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { StoriesSettingsModal } from '../../components/StoriesSettingsModal';
import {
  getCandidateContactsForNewGroup,
  getMe,
} from '../selectors/conversations';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists';
import { getIntl } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';

export function SmartStoriesSettingsModal(): JSX.Element | null {
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

  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const me = useSelector(getMe);

  const candidateConversations = useSelector(getCandidateContactsForNewGroup);
  const distributionLists = useSelector(getDistributionListsWithMembers);

  return (
    <StoriesSettingsModal
      candidateConversations={candidateConversations}
      distributionLists={distributionLists}
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
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
    />
  );
}
