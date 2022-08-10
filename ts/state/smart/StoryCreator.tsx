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
import { getDistributionLists } from '../selectors/storyDistributionLists';
import { getIntl } from '../selectors/user';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { processAttachment } from '../../util/processAttachment';
import { useConversationsActions } from '../ducks/conversations';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { useStoriesActions } from '../ducks/stories';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';

export type PropsType = {
  file?: File;
  onClose: () => unknown;
};

export function SmartStoryCreator({
  file,
  onClose,
}: PropsType): JSX.Element | null {
  const { debouncedMaybeGrabLinkPreview } = useLinkPreviewActions();
  const { sendStoryMessage } = useStoriesActions();
  const { tagGroupsAsNewGroupStory } = useConversationsActions();
  const { createDistributionList } = useStoryDistributionListsActions();

  const candidateConversations = useSelector(getCandidateContactsForNewGroup);
  const distributionLists = useSelector(getDistributionLists);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const groupConversations = useSelector(getNonGroupStories);
  const groupStories = useSelector(getGroupStories);
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const me = useSelector(getMe);
  const recentStickers = useSelector(getRecentStickers);
  const signalConnections = useSelector(getAllSignalConnections);

  return (
    <StoryCreator
      candidateConversations={candidateConversations}
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      distributionLists={distributionLists}
      file={file}
      getPreferredBadge={getPreferredBadge}
      groupConversations={groupConversations}
      groupStories={groupStories}
      i18n={i18n}
      installedPacks={installedPacks}
      linkPreview={linkPreviewForSource(LinkPreviewSourceType.StoryCreator)}
      me={me}
      onClose={onClose}
      onDistributionListCreated={createDistributionList}
      onSend={sendStoryMessage}
      processAttachment={processAttachment}
      recentStickers={recentStickers}
      signalConnections={signalConnections}
      tagGroupsAsNewGroupStory={tagGroupsAsNewGroupStory}
    />
  );
}
