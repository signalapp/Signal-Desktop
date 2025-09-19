// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ThemeType } from '../../types/Util.js';
import { LinkPreviewSourceType } from '../../types/LinkPreview.js';
import { StoryCreator } from '../../components/StoryCreator.js';
import {
  getAllSignalConnections,
  getCandidateContactsForNewGroup,
  getGroupStories,
  getMe,
  getNonGroupStories,
  selectMostRecentActiveStoryTimestampByGroupOrDistributionList,
} from '../selectors/conversations.js';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists.js';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.js';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers.js';
import { getAddStoryData } from '../selectors/stories.js';
import { getLinkPreview } from '../selectors/linkPreviews.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import {
  getEmojiSkinToneDefault,
  getHasSetMyStoriesPrivacy,
  getTextFormattingEnabled,
} from '../selectors/items.js';
import { imageToBlurHash } from '../../util/imageToBlurHash.js';
import { processAttachment } from '../../util/processAttachment.js';
import { useEmojisActions } from '../ducks/emojis.js';
import { useAudioPlayerActions } from '../ducks/audioPlayer.js';
import { useComposerActions } from '../ducks/composer.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { useItemsActions } from '../ducks/items.js';
import { useLinkPreviewActions } from '../ducks/linkPreviews.js';
import { useRecentEmojis } from '../selectors/emojis.js';
import { useStoriesActions } from '../ducks/stories.js';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists.js';

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
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const { setEmojiSkinToneDefault } = useItemsActions();
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
      onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
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
      emojiSkinToneDefault={emojiSkinToneDefault}
      theme={ThemeType.dark}
      toggleGroupsForStorySend={toggleGroupsForStorySend}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
    />
  );
});
