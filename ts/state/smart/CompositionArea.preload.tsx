// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useMemo, memo } from 'react';
import { useSelector } from 'react-redux';
import { CompositionArea } from '../../components/CompositionArea.dom.js';
import { useContactNameData } from '../../components/conversation/ContactName.dom.js';
import type {
  DraftBodyRanges,
  HydratedBodyRangesType,
} from '../../types/BodyRange.std.js';
import { hydrateRanges } from '../../types/BodyRange.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation.preload.js';
import { AutoSubstituteAsciiEmojis } from '../../quill/auto-substitute-ascii-emojis/index.dom.js';
import { imageToBlurHash } from '../../util/imageToBlurHash.dom.js';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly.std.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import {
  getErrorDialogAudioRecorderType,
  getRecordingState,
} from '../selectors/audioRecorder.std.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { getComposerStateForConversationIdSelector } from '../selectors/composer.preload.js';
import {
  getConversationSelector,
  getGroupAdminsSelector,
  getHasPanelOpen,
  getLastEditableMessageId,
  getMessages,
  getSelectedMessageIds,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations.dom.js';
import {
  getDefaultConversationColor,
  getEmojiSkinToneDefault,
  getTextFormattingEnabled,
} from '../selectors/items.dom.js';
import { canForward, getPropsForQuote } from '../selectors/message.preload.js';
import {
  getIntl,
  getPlatform,
  getTheme,
  getUserConversationId,
} from '../selectors/user.std.js';
import { SmartCompositionRecording } from './CompositionRecording.preload.js';
import type { SmartCompositionRecordingDraftProps } from './CompositionRecordingDraft.preload.js';
import { SmartCompositionRecordingDraft } from './CompositionRecordingDraft.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useAudioRecorderActions } from '../ducks/audioRecorder.preload.js';
import { useEmojisActions } from '../ducks/emojis.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useToastActions } from '../ducks/toast.preload.js';
import { isShowingAnyModal } from '../selectors/globalModals.std.js';
import { isConversationEverUnregistered } from '../../util/isConversationUnregistered.dom.js';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.js';
import { isConversationMuted } from '../../util/isConversationMuted.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

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
  strictAssert(conversation, `Conversation id ${id} not found!`);

  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const messageLookup = useSelector(getMessages);
  const isFormattingEnabled = useSelector(getTextFormattingEnabled);
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
  const { announcementsOnly, areWeAdmin, draftEditMessage, draftBodyRanges } =
    conversation;
  const {
    attachments: draftAttachments,
    focusCounter,
    disabledCounter,
    linkPreviewLoading,
    linkPreviewResult,
    messageCompositionId,
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
        })
      : undefined;
  }, [
    quotedMessage,
    conversationSelector,
    ourConversationId,
    defaultConversationColor,
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
    cancelJoinRequest,
    sendStickerMessage,
    sendEditedMessage,
    sendMultiMediaMessage,
    setComposerFocus,
  } = useComposerActions();
  const {
    pushPanelForConversation,
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
      draftEditMessage={draftEditMessage ?? null}
      focusCounter={focusCounter}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      isDisabled={isDisabled}
      isFormattingEnabled={isFormattingEnabled}
      isActive={isActive}
      lastEditableMessageId={lastEditableMessageId ?? null}
      messageCompositionId={messageCompositionId}
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
      sharedGroupNames={conversation.sharedGroupNames}
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
      draftText={conversation.draftText ?? null}
      draftBodyRanges={hydratedDraftBodyRanges ?? null}
      renderSmartCompositionRecording={renderSmartCompositionRecording}
      renderSmartCompositionRecordingDraft={
        renderSmartCompositionRecordingDraft
      }
      showGV2MigrationDialog={showGV2MigrationDialog}
      cancelJoinRequest={cancelJoinRequest}
      sortedGroupMembers={conversation.sortedGroupMembers ?? null}
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
      scrollToMessage={scrollToMessage}
      setComposerFocus={setComposerFocus}
      setMessageToEdit={setMessageToEdit}
      showConversation={showConversation}
    />
  );
});
