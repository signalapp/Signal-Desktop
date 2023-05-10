// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { SmartCompositionTextArea } from './CompositionTextArea';
import { StoryCreator } from '../../components/StoryCreator';
import {
  getAllSignalConnections,
  getCandidateContactsForNewGroup,
  getGroupStories,
  getMe,
  getNonGroupStories,
  selectMostRecentActiveStoryTimestampByGroupOrDistributionList,
} from '../selectors/conversations';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists';
import { getIntl, getUserConversationId } from '../selectors/user';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers';
import { getAddStoryData } from '../selectors/stories';
import {
  getEmojiSkinTone,
  getHasSetMyStoriesPrivacy,
} from '../selectors/items';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { imageToBlurHash } from '../../util/imageToBlurHash';
import { processAttachment } from '../../util/processAttachment';
import { useConversationsActions } from '../ducks/conversations';
import { useActions as useEmojisActions } from '../ducks/emojis';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useActions as useItemsActions } from '../ducks/items';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { useRecentEmojis } from '../selectors/emojis';
import { useStoriesActions } from '../ducks/stories';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';
import { useAudioPlayerActions } from '../ducks/audioPlayer';

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
    removeMembersFromDistributionList,
    setMyStoriesToAllSignalConnections,
    updateStoryViewers,
  } = useStoryDistributionListsActions();
  const { toggleSignalConnectionsModal } = useGlobalModalActions();

  const ourConversationId = useSelector(getUserConversationId);
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
  const mostRecentActiveStoryTimestampByGroupOrDistributionList = useSelector(
    selectMostRecentActiveStoryTimestampByGroupOrDistributionList
  );

  const addStoryData = useSelector(getAddStoryData);
  let file: File | undefined;
  const isSending = addStoryData?.sending || false;

  if (addStoryData?.type === 'Media') {
    // Note that the source type is ReadonlyDeep<File>, but browser APIs don't
    // support that. Hence the cast.
    file = addStoryData.file as File;
  }

  const recentEmojis = useRecentEmojis();
  const skinTone = useSelector<StateType, number>(getEmojiSkinTone);
  const { onSetSkinTone } = useItemsActions();
  const { onUseEmoji } = useEmojisActions();
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();

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
      imageToBlurHash={imageToBlurHash}
      installedPacks={installedPacks}
      isSending={isSending}
      linkPreview={linkPreviewForSource(LinkPreviewSourceType.StoryCreator)}
      me={me}
      mostRecentActiveStoryTimestampByGroupOrDistributionList={
        mostRecentActiveStoryTimestampByGroupOrDistributionList
      }
      onClose={() => setAddStoryData(undefined)}
      onDeleteList={deleteDistributionList}
      onDistributionListCreated={createDistributionList}
      onHideMyStoriesFrom={hideMyStoriesFrom}
      onRemoveMembers={removeMembersFromDistributionList}
      onRepliesNReactionsChanged={allowsRepliesChanged}
      onSelectedStoryList={verifyStoryListMembers}
      onSend={sendStoryMessage}
      onSetSkinTone={onSetSkinTone}
      onUseEmoji={onUseEmoji}
      onViewersUpdated={updateStoryViewers}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      ourConversationId={ourConversationId}
      processAttachment={processAttachment}
      recentEmojis={recentEmojis}
      recentStickers={recentStickers}
      renderCompositionTextArea={SmartCompositionTextArea}
      sendStoryModalOpenStateChanged={sendStoryModalOpenStateChanged}
      setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
      signalConnections={signalConnections}
      skinTone={skinTone}
      toggleGroupsForStorySend={toggleGroupsForStorySend}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
    />
  );
}
