// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useMemo, memo } from 'react';
import { useSelector } from 'react-redux';
import { CompositionArea } from '../../components/CompositionArea';
import { useContactNameData } from '../../components/conversation/ContactName';
import type {
  DraftBodyRanges,
  HydratedBodyRangesType,
} from '../../types/BodyRange';
import { hydrateRanges } from '../../types/BodyRange';
import { strictAssert } from '../../util/assert';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation';
import { imageToBlurHash } from '../../util/imageToBlurHash';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { isSignalConversation } from '../../util/isSignalConversation';
import {
  getErrorDialogAudioRecorderType,
  getRecordingState,
} from '../selectors/audioRecorder';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getComposerStateForConversationIdSelector } from '../selectors/composer';
import {
  getConversationSelector,
  getGroupAdminsSelector,
  getHasPanelOpen,
  getLastEditableMessageId,
  getSelectedMessageIds,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations';
import { selectRecentEmojis } from '../selectors/emojis';
import {
  getDefaultConversationColor,
  getEmojiSkinTone,
  getShowStickerPickerHint,
  getShowStickersIntroduction,
  getTextFormattingEnabled,
} from '../selectors/items';
import { getPropsForQuote } from '../selectors/message';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
  getRecentStickers,
  getRecentlyInstalledStickerPack,
} from '../selectors/stickers';
import {
  getIntl,
  getPlatform,
  getTheme,
  getUserConversationId,
} from '../selectors/user';
import type { SmartCompositionRecordingProps } from './CompositionRecording';
import { SmartCompositionRecording } from './CompositionRecording';
import type { SmartCompositionRecordingDraftProps } from './CompositionRecordingDraft';
import { SmartCompositionRecordingDraft } from './CompositionRecordingDraft';
import { useItemsActions } from '../ducks/items';
import { useComposerActions } from '../ducks/composer';
import { useConversationsActions } from '../ducks/conversations';
import { useAudioRecorderActions } from '../ducks/audioRecorder';
import { useEmojisActions } from '../ducks/emojis';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStickersActions } from '../ducks/stickers';
import { useToastActions } from '../ducks/toast';
import { isShowingAnyModal } from '../selectors/globalModals';
import { isConversationEverUnregistered } from '../../util/isConversationUnregistered';
import { isDirectConversation } from '../../util/whatTypeOfConversation';
import { isConversationMuted } from '../../util/isConversationMuted';

function renderSmartCompositionRecording(
  recProps: SmartCompositionRecordingProps
) {
  return <SmartCompositionRecording {...recProps} />;
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
  const skinTone = useSelector(getEmojiSkinTone);
  const recentEmojis = useSelector(selectRecentEmojis);
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const isFormattingEnabled = useSelector(getTextFormattingEnabled);
  const lastEditableMessageId = useSelector(getLastEditableMessageId);
  const receivedPacks = useSelector(getReceivedStickerPacks);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const blessedPacks = useSelector(getBlessedStickerPacks);
  const knownPacks = useSelector(getKnownStickerPacks);
  const platform = useSelector(getPlatform);
  const shouldHidePopovers = useSelector(getHasPanelOpen);
  const installedPack = useSelector(getRecentlyInstalledStickerPack);
  const recentStickers = useSelector(getRecentStickers);
  const showStickersIntroduction = useSelector(getShowStickersIntroduction);
  const showStickerPickerHint = useSelector(getShowStickerPickerHint);
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
    isDisabled,
    linkPreviewLoading,
    linkPreviewResult,
    messageCompositionId,
    sendCounter,
    shouldSendHighQualityAttachments,
  } = composerState;

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

  const { putItem, removeItem } = useItemsActions();

  const onSetSkinTone = useCallback(
    (tone: number) => {
      putItem('skinTone', tone);
    },
    [putItem]
  );

  const clearShowIntroduction = useCallback(() => {
    removeItem('showStickersIntroduction');
  }, [removeItem]);

  const clearShowPickerHint = useCallback(() => {
    removeItem('showStickerPickerHint');
  }, [removeItem]);

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
  const { showGV2MigrationDialog, toggleForwardMessagesModal } =
    useGlobalModalActions();
  const { clearInstalledStickerPack } = useStickersActions();
  const { showToast } = useToastActions();
  const { onEditorStateChange } = useComposerActions();

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
          : window.storage.get('sent-media-quality') === 'high'
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
      // Emojis
      recentEmojis={recentEmojis}
      skinTone={skinTone}
      onPickEmoji={onUseEmoji}
      // Stickers
      receivedPacks={receivedPacks}
      installedPack={installedPack}
      blessedPacks={blessedPacks}
      knownPacks={knownPacks}
      installedPacks={installedPacks}
      recentStickers={recentStickers}
      showIntroduction={showStickersIntroduction}
      showPickerHint={showStickerPickerHint}
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
      toggleSelectMode={toggleSelectMode}
      toggleForwardMessagesModal={toggleForwardMessagesModal}
      // Dispatch
      onSetSkinTone={onSetSkinTone}
      clearShowIntroduction={clearShowIntroduction}
      clearInstalledStickerPack={clearInstalledStickerPack}
      clearShowPickerHint={clearShowPickerHint}
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
