// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { StoryCreator } from '../../components/StoryCreator';
import {
  getAllSignalConnections,
  getCandidateContactsForNewGroup,
  getGroupStories,
  getMe,
  getNonGroupStories,
} from '../selectors/conversations';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists';
import { getIntl } from '../selectors/user';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers';
import { getHasSetMyStoriesPrivacy } from '../selectors/items';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { processAttachment } from '../../util/processAttachment';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { useStoriesActions } from '../ducks/stories';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';
import { SmartCompositionTextArea } from './CompositionTextArea';
import { getAddStoryData } from '../selectors/stories';

export type PropsType = {
  file?: File;
  onClose: () => unknown;
};

export function SmartStoryCreator(): JSX.Element | null {
  const { debouncedMaybeGrabLinkPreview } = useLinkPreviewActions();
  const {
    sendStoryModalOpenStateChanged,
    sendStoryMessage,
    verifyStoryListMembers,
    setAddStoryData,
  } = useStoriesActions();
  const { toggleGroupsForStorySend } = useConversationsActions();
  const {
    allowsRepliesChanged,
    createDistributionList,
    deleteDistributionList,
    hideMyStoriesFrom,
    removeMemberFromDistributionList,
    setMyStoriesToAllSignalConnections,
    updateStoryViewers,
  } = useStoryDistributionListsActions();
  const { toggleSignalConnectionsModal } = useGlobalModalActions();

  const candidateConversations = useSelector(getCandidateContactsForNewGroup);
  const distributionLists = useSelector(getDistributionListsWithMembers);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const groupConversations = useSelector(getNonGroupStories);
  const groupStories = useSelector(getGroupStories);
  const hasSetMyStoriesPrivacy = useSelector(getHasSetMyStoriesPrivacy);
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const me = useSelector(getMe);
  const recentStickers = useSelector(getRecentStickers);
  const signalConnections = useSelector(getAllSignalConnections);

  const addStoryData = useSelector(getAddStoryData);
  const file = addStoryData?.type === 'Media' ? addStoryData.file : undefined;
  const isSending = addStoryData?.sending || false;

  return (
    <StoryCreator
      candidateConversations={candidateConversations}
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      distributionLists={distributionLists}
      file={file}
      getPreferredBadge={getPreferredBadge}
      groupConversations={groupConversations}
      groupStories={groupStories}
      hasFirstStoryPostExperience={!hasSetMyStoriesPrivacy}
      i18n={i18n}
      installedPacks={installedPacks}
      isSending={isSending}
      linkPreview={linkPreviewForSource(LinkPreviewSourceType.StoryCreator)}
      me={me}
      onClose={() => setAddStoryData(undefined)}
      onDeleteList={deleteDistributionList}
      onDistributionListCreated={createDistributionList}
      onHideMyStoriesFrom={hideMyStoriesFrom}
      onRemoveMember={removeMemberFromDistributionList}
      onRepliesNReactionsChanged={allowsRepliesChanged}
      onSelectedStoryList={verifyStoryListMembers}
      onSend={sendStoryMessage}
      onViewersUpdated={updateStoryViewers}
      processAttachment={processAttachment}
      recentStickers={recentStickers}
      renderCompositionTextArea={SmartCompositionTextArea}
      sendStoryModalOpenStateChanged={sendStoryModalOpenStateChanged}
      setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
      signalConnections={signalConnections}
      toggleGroupsForStorySend={toggleGroupsForStorySend}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
    />
  );
}
