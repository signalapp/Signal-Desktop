// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ThemeType } from '../../types/Util';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
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
import { getIntl, getPlatform, getUserConversationId } from '../selectors/user';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers';
import { getAddStoryData } from '../selectors/stories';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getEmojiSkinTone,
  getHasSetMyStoriesPrivacy,
  getTextFormattingEnabled,
} from '../selectors/items';
import { imageToBlurHash } from '../../util/imageToBlurHash';
import { processAttachment } from '../../util/processAttachment';
import { useEmojisActions } from '../ducks/emojis';
import { useAudioPlayerActions } from '../ducks/audioPlayer';
import { useComposerActions } from '../ducks/composer';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useItemsActions } from '../ducks/items';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { useRecentEmojis } from '../selectors/emojis';
import { useStoriesActions } from '../ducks/stories';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';

export type PropsType = {
  file?: File;
  onClose: () => unknown;
};

export const SmartStoryCreator = memo(function SmartStoryCreator() {
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
  const i18n = useSelector(getIntl);
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
  const skinTone = useSelector(getEmojiSkinTone);
  const { onSetSkinTone } = useItemsActions();
  const { onUseEmoji } = useEmojisActions();
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();
  const { onTextTooLong } = useComposerActions();
  const { onUseEmoji: onPickEmoji } = useEmojisActions();

  const isFormattingEnabled = useSelector(getTextFormattingEnabled);
  const platform = useSelector(getPlatform);

  const linkPreview = useMemo(() => {
    return linkPreviewForSource(LinkPreviewSourceType.StoryCreator);
  }, [linkPreviewForSource]);

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
      isFormattingEnabled={isFormattingEnabled}
      isSending={isSending}
      linkPreview={linkPreview}
      me={me}
      mostRecentActiveStoryTimestampByGroupOrDistributionList={
        mostRecentActiveStoryTimestampByGroupOrDistributionList
      }
      onClose={() => setAddStoryData(undefined)}
      onDeleteList={deleteDistributionList}
      onDistributionListCreated={createDistributionList}
      onHideMyStoriesFrom={hideMyStoriesFrom}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      onPickEmoji={onPickEmoji}
      onRemoveMembers={removeMembersFromDistributionList}
      onRepliesNReactionsChanged={allowsRepliesChanged}
      onSelectedStoryList={verifyStoryListMembers}
      onSend={sendStoryMessage}
      onSetSkinTone={onSetSkinTone}
      onTextTooLong={onTextTooLong}
      onUseEmoji={onUseEmoji}
      onViewersUpdated={updateStoryViewers}
      ourConversationId={ourConversationId}
      platform={platform}
      processAttachment={processAttachment}
      recentEmojis={recentEmojis}
      recentStickers={recentStickers}
      sendStoryModalOpenStateChanged={sendStoryModalOpenStateChanged}
      setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
      signalConnections={signalConnections}
      sortedGroupMembers={null}
      skinTone={skinTone}
      theme={ThemeType.dark}
      toggleGroupsForStorySend={toggleGroupsForStorySend}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
    />
  );
});
