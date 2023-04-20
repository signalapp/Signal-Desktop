// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { get } from 'lodash';

import { mapDispatchToProps } from '../actions';
import type { Props as ComponentPropsType } from '../../components/CompositionArea';
import { CompositionArea } from '../../components/CompositionArea';
import type { StateType } from '../reducer';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { dropNull } from '../../util/dropNull';
import { imageToBlurHash } from '../../util/imageToBlurHash';

import { getPreferredBadgeSelector } from '../selectors/badges';
import { selectRecentEmojis } from '../selectors/emojis';
import { getIntl, getTheme, getUserConversationId } from '../selectors/user';
import { getEmojiSkinTone, getTextFormattingEnabled } from '../selectors/items';
import {
  getConversationSelector,
  getGroupAdminsSelector,
  getSelectedMessageIds,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations';
import { getPropsForQuote } from '../selectors/message';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
  getRecentlyInstalledStickerPack,
  getRecentStickers,
} from '../selectors/stickers';
import { isSignalConversation } from '../../util/isSignalConversation';
import {
  getComposerStateForConversationIdSelector,
  getIsFormattingFlagEnabled,
  getIsFormattingSpoilersFlagEnabled,
} from '../selectors/composer';
import type { SmartCompositionRecordingProps } from './CompositionRecording';
import { SmartCompositionRecording } from './CompositionRecording';
import type { SmartCompositionRecordingDraftProps } from './CompositionRecordingDraft';
import { SmartCompositionRecordingDraft } from './CompositionRecordingDraft';
import { BodyRange } from '../../types/BodyRange';

type ExternalProps = {
  id: string;
};

export type CompositionAreaPropsType = ExternalProps & ComponentPropsType;

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversationSelector = getConversationSelector(state);
  const conversation = conversationSelector(id);
  if (!conversation) {
    throw new Error(`Conversation id ${id} not found!`);
  }

  const {
    announcementsOnly,
    areWeAdmin,
    draftEditMessage,
    draftText,
    draftBodyRanges,
  } = conversation;

  const receivedPacks = getReceivedStickerPacks(state);
  const installedPacks = getInstalledStickerPacks(state);
  const blessedPacks = getBlessedStickerPacks(state);
  const knownPacks = getKnownStickerPacks(state);

  const installedPack = getRecentlyInstalledStickerPack(state);

  const recentStickers = getRecentStickers(state);
  const showIntroduction = get(
    state.items,
    ['showStickersIntroduction'],
    false
  );
  const showPickerHint = Boolean(
    get(state.items, ['showStickerPickerHint'], false) &&
      receivedPacks.length > 0
  );

  const composerStateForConversationIdSelector =
    getComposerStateForConversationIdSelector(state);

  const composerState = composerStateForConversationIdSelector(id);
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

  let { quotedMessage } = composerState;
  if (!quotedMessage && draftEditMessage?.quote) {
    quotedMessage = {
      conversationId: id,
      quote: draftEditMessage.quote,
    };
  }

  const recentEmojis = selectRecentEmojis(state);

  const selectedMessageIds = getSelectedMessageIds(state);

  const isFormattingEnabled =
    getIsFormattingFlagEnabled(state) && getTextFormattingEnabled(state);
  const isFormattingSpoilersEnabled =
    getIsFormattingSpoilersFlagEnabled(state) &&
    getTextFormattingEnabled(state);

  return {
    // Base
    conversationId: id,
    draftEditMessage,
    focusCounter,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    isDisabled,
    isFormattingSpoilersEnabled,
    isFormattingEnabled,
    messageCompositionId,
    sendCounter,
    theme: getTheme(state),

    // AudioCapture
    errorDialogAudioRecorderType:
      state.audioRecorder.errorDialogAudioRecorderType,
    recordingState: state.audioRecorder.recordingState,
    // AttachmentsList
    draftAttachments,
    // MediaEditor
    imageToBlurHash,
    // MediaQualitySelector
    shouldSendHighQualityAttachments:
      shouldSendHighQualityAttachments !== undefined
        ? shouldSendHighQualityAttachments
        : window.storage.get('sent-media-quality') === 'high',
    // StagedLinkPreview
    linkPreviewLoading,
    linkPreviewResult,
    // Quote
    quotedMessageId: quotedMessage?.quote?.messageId,
    quotedMessageProps: quotedMessage
      ? getPropsForQuote(quotedMessage, {
          conversationSelector,
          ourConversationId: getUserConversationId(state),
        })
      : undefined,
    quotedMessageAuthorUuid: quotedMessage?.quote?.authorUuid,
    quotedMessageSentAt: quotedMessage?.quote?.id,
    // Emojis
    recentEmojis,
    skinTone: getEmojiSkinTone(state),
    // Stickers
    receivedPacks,
    installedPack,
    blessedPacks,
    knownPacks,
    installedPacks,
    recentStickers,
    showIntroduction,
    showPickerHint,
    // Message Requests
    ...conversation,
    conversationType: conversation.type,
    isSMSOnly: Boolean(isConversationSMSOnly(conversation)),
    isSignalConversation: isSignalConversation(conversation),
    isFetchingUUID: conversation.isFetchingUUID,
    isMissingMandatoryProfileSharing:
      isMissingRequiredProfileSharing(conversation),
    // Groups
    announcementsOnly,
    areWeAdmin,
    groupAdmins: getGroupAdminsSelector(state)(conversation.id),

    draftText: dropNull(draftText),
    draftBodyRanges: draftBodyRanges?.map(bodyRange => {
      if (BodyRange.isMention(bodyRange)) {
        const mentionConvo = conversationSelector(bodyRange.mentionUuid);

        return {
          ...bodyRange,
          conversationID: mentionConvo.id,
          replacementText: mentionConvo.title,
        };
      }

      return bodyRange;
    }),
    renderSmartCompositionRecording: (
      recProps: SmartCompositionRecordingProps
    ) => {
      return <SmartCompositionRecording {...recProps} />;
    },
    renderSmartCompositionRecordingDraft: (
      draftProps: SmartCompositionRecordingDraftProps
    ) => {
      return <SmartCompositionRecordingDraft {...draftProps} />;
    },

    // Select Mode
    selectedMessageIds,
  };
};

const dispatchPropsMap = {
  ...mapDispatchToProps,
  onSetSkinTone: (tone: number) => mapDispatchToProps.putItem('skinTone', tone),
  clearShowIntroduction: () =>
    mapDispatchToProps.removeItem('showStickersIntroduction'),
  clearShowPickerHint: () =>
    mapDispatchToProps.removeItem('showStickerPickerHint'),
  onPickEmoji: mapDispatchToProps.onUseEmoji,
};

const smart = connect(mapStateToProps, dispatchPropsMap);

export const SmartCompositionArea = smart(CompositionArea);
