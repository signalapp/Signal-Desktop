// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ThemeType } from '../../types/Util.std.ts';
import { LinkPreviewSourceType } from '../../types/LinkPreview.std.ts';
import type {
  DraftBodyRanges,
  HydratedBodyRangesType,
} from '../../types/BodyRange.std.ts';
import { StoryCreator } from '../../components/StoryCreator.dom.tsx';
import {
  getCandidateContactsForNewGroup,
  getConversationSelector,
  getGroupStories,
  getMe,
  getNonGroupStories,
  selectMostRecentActiveStoryTimestampByGroupOrDistributionList,
} from '../selectors/conversations.dom.ts';
import { getAllSignalConnections } from '../selectors/conversations-extra.preload.ts';
import { getDistributionListsWithMembers } from '../selectors/storyDistributionLists.dom.ts';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.std.ts';
import { getAddStoryData } from '../selectors/stories.preload.ts';
import { getLinkPreview } from '../selectors/linkPreviews.std.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import {
  getEmojiSkinToneDefault,
  getHasSetMyStoriesPrivacy,
  getTextFormattingEnabled,
} from '../selectors/items.dom.ts';
import { imageToBlurHash } from '../../util/imageToBlurHash.dom.ts';
import { processAttachment } from '../../util/processAttachment.preload.ts';
import { hydrateRanges } from '../../util/BodyRange.node.ts';
import { useEmojisActions } from '../ducks/emojis.preload.ts';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.ts';
import { useComposerActions } from '../ducks/composer.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useLinkPreviewActions } from '../ducks/linkPreviews.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists.preload.ts';

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
let initialText: string | undefined;
const isSending = addStoryData?.sending || false;

if (addStoryData?.type === 'Media') {
  // Note that the source type is ReadonlyDeep<File>, but browser APIs don't
  // support that. Hence the cast.
  file = addStoryData.file as File;
}

if (addStoryData?.type === 'Text') {
  initialText = addStoryData.initialText;
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

  const convertDraftBodyRangesIntoHydrated = useCallback(
    (
      bodyRanges: DraftBodyRanges | undefined
    ): HydratedBodyRangesType | undefined => {
      return hydrateRanges(bodyRanges, conversationSelector);
    },
    [conversationSelector]
  );

  return (
    <StoryCreator
      candidateConversations={candidateConversations}
      convertDraftBodyRangesIntoHydrated={convertDraftBodyRangesIntoHydrated}
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      distributionLists={distributionLists}
      file={file}
      getPreferredBadge={getPreferredBadge}
      groupConversations={groupConversations}
      groupStories={groupStories}
      hasFirstStoryPostExperience={!hasSetMyStoriesPrivacy}
      initialText={initialText}
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
