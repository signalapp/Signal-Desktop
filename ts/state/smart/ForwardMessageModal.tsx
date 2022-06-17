// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import type { AttachmentType } from '../../types/Attachment';
import type { BodyRangeType } from '../../types/Util';
import type { DataPropsType } from '../../components/ForwardMessageModal';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import type { StateType } from '../reducer';
import { ForwardMessageModal } from '../../components/ForwardMessageModal';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { getAllComposableConversations } from '../selectors/conversations';
import { getEmojiSkinTone } from '../selectors/items';
import { getIntl, getTheme, getRegionCode } from '../selectors/user';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { mapDispatchToProps } from '../actions';
import { selectRecentEmojis } from '../selectors/emojis';

export type SmartForwardMessageModalProps = {
  attachments?: Array<AttachmentType>;
  doForwardMessage: (
    selectedContacts: Array<string>,
    messageBody?: string,
    attachments?: Array<AttachmentType>,
    linkPreview?: LinkPreviewType
  ) => void;
  hasContact: boolean;
  isSticker: boolean;
  messageBody?: string;
  onClose: () => void;
  onEditorStateChange: (
    messageText: string,
    bodyRanges: Array<BodyRangeType>,
    caretLocation?: number
  ) => unknown;
  onTextTooLong: () => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartForwardMessageModalProps
): DataPropsType => {
  const {
    attachments,
    doForwardMessage,
    hasContact,
    isSticker,
    messageBody,
    onClose,
    onEditorStateChange,
    onTextTooLong,
  } = props;

  const candidateConversations = getAllComposableConversations(state);
  const recentEmojis = selectRecentEmojis(state);
  const skinTone = getEmojiSkinTone(state);
  const linkPreviewForSource = getLinkPreview(state);

  return {
    attachments,
    candidateConversations,
    doForwardMessage,
    getPreferredBadge: getPreferredBadgeSelector(state),
    hasContact,
    i18n: getIntl(state),
    isSticker,
    linkPreview: linkPreviewForSource(
      LinkPreviewSourceType.ForwardMessageModal
    ),
    messageBody,
    onClose,
    onEditorStateChange,
    recentEmojis,
    skinTone,
    onTextTooLong,
    theme: getTheme(state),
    regionCode: getRegionCode(state),
  };
};

const smart = connect(mapStateToProps, {
  ...mapDispatchToProps,
  onPickEmoji: mapDispatchToProps.onUseEmoji,
});

export const SmartForwardMessageModal = smart(ForwardMessageModal);
