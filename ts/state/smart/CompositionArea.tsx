// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import { CompositionArea } from '../../components/CompositionArea';
import { StateType } from '../reducer';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { dropNull } from '../../util/dropNull';

import { selectRecentEmojis } from '../selectors/emojis';
import { getIntl, getUserConversationId } from '../selectors/user';
import { getEmojiSkinTone } from '../selectors/items';
import {
  getConversationSelector,
  getGroupAdminsSelector,
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

type ExternalProps = {
  id: string;
  onClickQuotedMessage: (id: string) => unknown;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id, onClickQuotedMessage } = props;

  const conversationSelector = getConversationSelector(state);
  const conversation = conversationSelector(id);
  if (!conversation) {
    throw new Error(`Conversation id ${id} not found!`);
  }

  const {
    announcementsOnly,
    areWeAdmin,
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

  const {
    attachments: draftAttachments,
    linkPreviewLoading,
    linkPreviewResult,
    quotedMessage,
    shouldSendHighQualityAttachments,
  } = state.composer;

  const recentEmojis = selectRecentEmojis(state);

  return {
    // Base
    conversationId: id,
    i18n: getIntl(state),
    // AudioCapture
    errorDialogAudioRecorderType:
      state.audioRecorder.errorDialogAudioRecorderType,
    isRecording: state.audioRecorder.isRecording,
    // AttachmentsList
    draftAttachments,
    // MediaQualitySelector
    shouldSendHighQualityAttachments,
    // StagedLinkPreview
    linkPreviewLoading,
    linkPreviewResult,
    // Quote
    quotedMessageProps: quotedMessage
      ? getPropsForQuote(quotedMessage, {
          conversationSelector,
          ourConversationId: getUserConversationId(state),
        })
      : undefined,
    onClickQuotedMessage: () => {
      const messageId = quotedMessage?.quote?.messageId;
      if (messageId) {
        onClickQuotedMessage(messageId);
      }
    },
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
    isFetchingUUID: conversation.isFetchingUUID,
    isMissingMandatoryProfileSharing: isMissingRequiredProfileSharing(
      conversation
    ),
    // Groups
    announcementsOnly,
    areWeAdmin,
    groupAdmins: getGroupAdminsSelector(state)(conversation.id),

    draftText: dropNull(draftText),
    draftBodyRanges,
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
