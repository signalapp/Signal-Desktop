// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useMemo, memo } from 'react';
import { useSelector } from 'react-redux';
import { CompositionArea } from '../../components/CompositionArea.dom.tsx';
import { useContactNameData } from '../../components/conversation/ContactName.dom.tsx';
import type {
  DraftBodyRanges,
  HydratedBodyRangesType,
} from '../../types/BodyRange.std.ts';
import { hydrateRanges } from '../../util/BodyRange.node.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation.preload.ts';
import { AutoSubstituteAsciiEmojis } from '../../quill/auto-substitute-ascii-emojis/index.dom.tsx';
import { imageToBlurHash } from '../../util/imageToBlurHash.dom.ts';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly.std.ts';
import { isSignalConversation } from '../../util/isSignalConversation.dom.ts';
import {
  getErrorDialogAudioRecorderType,
  getRecordingState,
} from '../selectors/audioRecorder.std.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { getComposerStateForConversationIdSelector } from '../selectors/composer.preload.ts';
import {
  getCachedConversationMemberColorsSelector,
  getConversationSelector,
  getGroupAdminsSelector,
  getLastEditableMessageId,
  getMessages,
  getSelectedMessageIds,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations.dom.ts';
import { getHasPanelOpen } from '../selectors/nav.std.ts';
import { getSharedGroupNames } from '../../util/sharedGroupNames.dom.ts';
import {
  getDefaultConversationColor,
  getEmojiSkinToneDefault,
  getItems,
  getTextFormattingEnabled,
} from '../selectors/items.dom.ts';
import { canForward, getPropsForQuote } from '../selectors/message.preload.ts';
import {
  getIntl,
  getPlatform,
  getTheme,
  getUserConversationId,
  getVersion,
} from '../selectors/user.std.ts';
import { SmartCompositionRecording } from './CompositionRecording.preload.tsx';
import type { SmartCompositionRecordingDraftProps } from './CompositionRecordingDraft.preload.tsx';
import { SmartCompositionRecordingDraft } from './CompositionRecordingDraft.preload.tsx';
import { useComposerActions } from '../ducks/composer.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useAudioRecorderActions } from '../ducks/audioRecorder.preload.ts';
import { useEmojisActions } from '../ducks/emojis.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import { isShowingAnyModal } from '../selectors/globalModals.std.ts';
import { isConversationEverUnregistered } from '../../util/isConversationUnregistered.dom.ts';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.ts';
import { isConversationMuted } from '../../util/isConversationMuted.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.ts';

function renderSmartCompositionRecording() {
  return <SmartCompositionRecording />;
}

function renderSmartCompositionRecordingDraft(
  draftProps: SmartCompositionRecordingDraftProps
) {
  return <SmartCompositionRecordingDraft {...draftProps} />;
}

export const SmartCompositionArea = memo(function SmartCompositionArea({
  id,
}: {
  id: string;
}) {
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(id);
  const isGroup = conversation.type === 'group';
  strictAssert(conversation, `Conversation id ${id} not found!`);

  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const messageLookup = useSelector(getMessages);
  const isFormattingEnabled = useSelector(getTextFormattingEnabled);
  const items = useSelector(getItems);
  const version = useSelector(getVersion);
  const lastEditableMessageId = useSelector(getLastEditableMessageId);
  const platform = useSelector(getPlatform);
  const shouldHidePopovers = useSelector(getHasPanelOpen);
  const recordingState = useSelector(getRecordingState);
  const errorDialogAudioRecorderType = useSelector(
    getErrorDialogAudioRecorderType
  );
  const hasGlobalModalOpen = useSelector(isShowingAnyModal);
  const hasPanelOpen = useSelector(getHasPanelOpen);
  const getGroupAdmins = useSelector(getGroupAdminsSelector);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const composerStateForConversationIdSelector = useSelector(
    getComposerStateForConversationIdSelector
  );
  const composerState = composerStateForConversationIdSelector(id);
  const {
    announcementsOnly,
    areWeAdmin,
    draftEditMessage,
    draftBodyRanges,
    terminated,
  } = conversation;
  const {
    attachments: draftAttachments,
    focusCounter,
    disabledCounter,
    isViewOnce,
    linkPreviewLoading,
    linkPreviewResult,
    sendCounter,
    shouldSendHighQualityAttachments,
  } = composerState;

  const isDisabled = disabledCounter > 0;

  const areSelectedMessagesForwardable = useMemo(() => {
    return selectedMessageIds?.every(messageId => {
      const message = messageLookup[messageId];
      if (!message) {
        return false;
      }
      return canForward(message);
    });
  }, [messageLookup, selectedMessageIds]);

  const isActive = useMemo(() => {
    return !hasGlobalModalOpen && !hasPanelOpen;
  }, [hasGlobalModalOpen, hasPanelOpen]);

  const groupAdmins = useMemo(() => {
    return getGroupAdmins(id);
  }, [getGroupAdmins, id]);
  const getMemberColors = useSelector(
    getCachedConversationMemberColorsSelector
  );
  const memberColors = getMemberColors(id);

  const addedBy = useMemo(() => {
    if (conversation.type === 'group') {
      return getAddedByForOurPendingInvitation(conversation);
    }
    return null;
  }, [conversation]);

  const conversationName = useContactNameData(conversation);
  strictAssert(conversationName, 'conversationName is required');
  const addedByName = useContactNameData(addedBy);

  const hydratedDraftBodyRanges = useMemo(() => {
    return hydrateRanges(draftBodyRanges, conversationSelector);
  }, [conversationSelector, draftBodyRanges]);

  const convertDraftBodyRangesIntoHydrated = useCallback(
    (
      bodyRanges: DraftBodyRanges | undefined
    ): HydratedBodyRangesType | undefined => {
      return hydrateRanges(bodyRanges, conversationSelector);
    },
    [conversationSelector]
  );

  let { quotedMessage } = composerState;
  if (!quotedMessage && draftEditMessage?.quote) {
    quotedMessage = {
      conversationId: id,
      quote: draftEditMessage.quote,
    };
  }

  const ourConversationId = useSelector(getUserConversationId);
  const defaultConversationColor = useSelector(getDefaultConversationColor);

  const quotedMessageProps = useMemo(() => {
    return quotedMessage
      ? getPropsForQuote(quotedMessage, {
          conversationSelector,
          ourConversationId,
          defaultConversationColor,
          isGroup,
        })
      : undefined;
  }, [
    quotedMessage,
    conversationSelector,
    ourConversationId,
    defaultConversationColor,
    isGroup,
  ]);

  const {
    onTextTooLong,
    onCloseLinkPreview,
    addAttachment,
    removeAttachment,
    onClearAttachments,
    processAttachments,
    setMediaQualitySetting,
    setQuoteByMessageId,
    setViewOnce,
    cancelJoinRequest,
    sendStickerMessage,
    sendEditedMessage,
    sendMultiMediaMessage,
    sendPoll,
    setComposerFocus,
  } = useComposerActions();
  const {
    discardEditMessage,
    acceptConversation,
    blockAndReportSpam,
    blockConversation,
    reportSpam,
    deleteConversation,
    toggleSelectMode,
    scrollToMessage,
    setMessageToEdit,
    setMuteExpiration,
    showConversation,
  } = useConversationsActions();
  const { pushPanelForConversation } = useNavActions();
  const { cancelRecording, completeRecording, startRecording, errorRecording } =
    useAudioRecorderActions();
  const { onUseEmoji } = useEmojisActions();
  const {
    showGV2MigrationDialog,
    toggleForwardMessagesModal,
    toggleDraftGifMessageSendModal,
  } = useGlobalModalActions();
  const { showToast } = useToastActions();
  const { onEditorStateChange } = useComposerActions();

  AutoSubstituteAsciiEmojis.enable(itemStorage.get('autoConvertEmoji', true));

  return (
    <CompositionArea
      // Base
      conversationId={id}
      draftBodyRanges={hydratedDraftBodyRanges ?? null}
      draftEditMessage={draftEditMessage ?? null}
      draftText={conversation.draftText ?? null}
      focusCounter={focusCounter}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      isDisabled={isDisabled}
      isFormattingEnabled={isFormattingEnabled}
      isPollSend1to1Enabled={isFeaturedEnabledSelector({
        betaKey: 'desktop.pollSend1to1.beta',
        prodKey: 'desktop.pollSend1to1.prod',
        currentVersion: version,
        remoteConfig: items.remoteConfig,
      })}
      isActive={isActive}
      lastEditableMessageId={lastEditableMessageId ?? null}
      platform={platform}
      ourConversationId={ourConversationId}
      sendCounter={sendCounter}
      shouldHidePopovers={shouldHidePopovers}
      theme={theme}
      convertDraftBodyRangesIntoHydrated={convertDraftBodyRangesIntoHydrated}
      onTextTooLong={onTextTooLong}
      pushPanelForConversation={pushPanelForConversation}
      discardEditMessage={discardEditMessage}
      onCloseLinkPreview={onCloseLinkPreview}
      onEditorStateChange={onEditorStateChange}
      // MediaEditor
      conversationSelector={conversationSelector}
      // AudioCapture
      errorDialogAudioRecorderType={errorDialogAudioRecorderType ?? null}
      recordingState={recordingState}
      cancelRecording={cancelRecording}
      completeRecording={completeRecording}
      startRecording={startRecording}
      errorRecording={errorRecording}
      // AttachmentsList
      draftAttachments={draftAttachments}
      addAttachment={addAttachment}
      removeAttachment={removeAttachment}
      onClearAttachments={onClearAttachments}
      processAttachments={processAttachments}
      // MediaEditor
      imageToBlurHash={imageToBlurHash}
      // MediaQualitySelector
      shouldSendHighQualityAttachments={
        shouldSendHighQualityAttachments !== undefined
          ? shouldSendHighQualityAttachments
          : itemStorage.get('sent-media-quality') === 'high'
      }
      setMediaQualitySetting={setMediaQualitySetting}
      // StagedLinkPreview
      linkPreviewLoading={linkPreviewLoading}
      linkPreviewResult={linkPreviewResult ?? null}
      // Quote
      quotedMessageId={quotedMessage?.quote?.messageId ?? null}
      quotedMessageProps={quotedMessageProps ?? null}
      quotedMessageAuthorAci={quotedMessage?.quote?.authorAci ?? null}
      quotedMessageSentAt={quotedMessage?.quote?.id ?? null}
      setQuoteByMessageId={setQuoteByMessageId}
      // View Once
      isViewOnce={isViewOnce}
      setViewOnce={setViewOnce}
      // Fun Picker
      emojiSkinToneDefault={emojiSkinToneDefault}
      onSelectEmoji={onUseEmoji}
      // Message Requests
      acceptedMessageRequest={conversation.acceptedMessageRequest ?? null}
      removalStage={conversation.removalStage ?? null}
      addedByName={addedByName}
      conversationName={conversationName}
      conversationType={conversation.type}
      isBlocked={conversation.isBlocked ?? false}
      isReported={conversation.isReported ?? false}
      isHidden={conversation.removalStage != null}
      isSmsOnlyOrUnregistered={
        isDirectConversation(conversation) &&
        (isConversationSMSOnly(conversation) ||
          isConversationEverUnregistered(conversation))
      }
      isFetchingUUID={conversation.isFetchingUUID ?? null}
      isMissingMandatoryProfileSharing={isMissingRequiredProfileSharing(
        conversation
      )}
      acceptConversation={acceptConversation}
      blockAndReportSpam={blockAndReportSpam}
      blockConversation={blockConversation}
      reportSpam={reportSpam}
      deleteConversation={deleteConversation}
      getSharedGroupNames={getSharedGroupNames}
      // Signal Conversation
      isSignalConversation={isSignalConversation(conversation)}
      isMuted={isConversationMuted(conversation)}
      setMuteExpiration={setMuteExpiration}
      // Groups
      groupVersion={conversation.groupVersion ?? null}
      isGroupV1AndDisabled={conversation.isGroupV1AndDisabled ?? null}
      left={conversation.left ?? null}
      announcementsOnly={announcementsOnly ?? null}
      areWeAdmin={areWeAdmin ?? null}
      areWePending={conversation.areWePending ?? null}
      areWePendingApproval={conversation.areWePendingApproval ?? null}
      groupAdmins={groupAdmins}
      memberColors={memberColors}
      renderSmartCompositionRecording={renderSmartCompositionRecording}
      renderSmartCompositionRecordingDraft={
        renderSmartCompositionRecordingDraft
      }
      showGV2MigrationDialog={showGV2MigrationDialog}
      cancelJoinRequest={cancelJoinRequest}
      sortedGroupMembers={conversation.sortedGroupMembers ?? null}
      terminated={terminated ?? null}
      // Select Mode
      selectedMessageIds={selectedMessageIds}
      areSelectedMessagesForwardable={areSelectedMessagesForwardable}
      toggleSelectMode={toggleSelectMode}
      toggleForwardMessagesModal={toggleForwardMessagesModal}
      // DraftGifMessageSendModal
      toggleDraftGifMessageSendModal={toggleDraftGifMessageSendModal}
      // Dispatch
      showToast={showToast}
      sendStickerMessage={sendStickerMessage}
      sendEditedMessage={sendEditedMessage}
      sendMultiMediaMessage={sendMultiMediaMessage}
      sendPoll={sendPoll}
      scrollToMessage={scrollToMessage}
      setComposerFocus={setComposerFocus}
      setMessageToEdit={setMessageToEdit}
      showConversation={showConversation}
    />
  );
});
