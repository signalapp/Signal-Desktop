// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ThemeType } from '../../types/Util.std.js';
import { LinkPreviewSourceType } from '../../types/LinkPreview.std.js';
import { StoryCreator } from '../../components/StoryCreator.dom.js';
import {
  getCandidateContactsForNewGroup,
  getConversationSelector,
  getGroupStories,
  getMe,
  getNonGroupStories,
  selectMostRecentActiveStoryTimestampByGroupOrDistributionList,
} from '../selectors/conversations.dom.js';
import { getAllSignalConnections } from '../selectors/conversations-extra.preload.js';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists.dom.js';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.std.js';
import { getAddStoryData } from '../selectors/stories.preload.js';
import { getLinkPreview } from '../selectors/linkPreviews.std.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getEmojiSkinToneDefault,
  getHasSetMyStoriesPrivacy,
  getTextFormattingEnabled,
} from '../selectors/items.dom.js';
import { imageToBlurHash } from '../../util/imageToBlurHash.dom.js';
import { processAttachment } from '../../util/processAttachment.preload.js';
import { useEmojisActions } from '../ducks/emojis.preload.js';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useLinkPreviewActions } from '../ducks/linkPreviews.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists.preload.js';

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

  const conversationSelector = useSelector(getConversationSelector);
  const ourConversationId = useSelector(getUserConversationId);
  const candidateConversations = useSelector(getCandidateContactsForNewGroup);
  const distributionLists = useSelector(getDistributionListsWithMembers);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const groupConversations = useSelector(getNonGroupStories);
  const groupStories = useSelector(getGroupStories);
  const hasSetMyStoriesPrivacy = useSelector(getHasSetMyStoriesPrivacy);
  const i18n = useSelector(getIntl);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const me = useSelector(getMe);
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

  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const { onUseEmoji } = useEmojisActions();
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();
  const { onTextTooLong } = useComposerActions();

  const isFormattingEnabled = useSelector(getTextFormattingEnabled);
  const platform = useSelector(getPlatform);

  const linkPreview = useMemo(() => {
    return linkPreviewForSource(LinkPreviewSourceType.StoryCreator);
  }, [linkPreviewForSource]);

  return (
    <StoryCreator
      candidateConversations={candidateConversations}
      conversationSelector={conversationSelector}
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      distributionLists={distributionLists}
      file={file}
      getPreferredBadge={getPreferredBadge}
      groupConversations={groupConversations}
      groupStories={groupStories}
      hasFirstStoryPostExperience={!hasSetMyStoriesPrivacy}
      i18n={i18n}
      imageToBlurHash={imageToBlurHash}
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
      onSelectEmoji={onUseEmoji}
      onRemoveMembers={removeMembersFromDistributionList}
      onRepliesNReactionsChanged={allowsRepliesChanged}
      onSelectedStoryList={verifyStoryListMembers}
      onSend={sendStoryMessage}
      onTextTooLong={onTextTooLong}
      onViewersUpdated={updateStoryViewers}
      ourConversationId={ourConversationId}
      platform={platform}
      processAttachment={processAttachment}
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
