// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';
import type { DraftPreviewType } from '../state/ducks/conversations';
import { findAndFormatContact } from './findAndFormatContact';
import { hydrateRanges } from '../types/BodyRange';
import { isVoiceMessage } from '../types/Attachment';
import { stripNewlinesForLeftPane } from './stripNewlinesForLeftPane';

export function getDraftPreview(
  attributes: ConversationAttributesType
): DraftPreviewType {
  const { draft } = attributes;

  const rawBodyRanges = attributes.draftBodyRanges || [];
  const bodyRanges = hydrateRanges(rawBodyRanges, findAndFormatContact);

  if (draft) {
    return {
      text: stripNewlinesForLeftPane(draft),
      bodyRanges,
    };
  }

  const draftAttachments = attributes.draftAttachments || [];
  if (draftAttachments.length > 0) {
    if (isVoiceMessage(draftAttachments[0])) {
      return {
        text: window.i18n('icu:message--getNotificationText--voice-message'),
        prefix: '🎤',
      };
    }
    return {
      text: window.i18n('icu:Conversation--getDraftPreview--attachment'),
    };
  }

  const { quotedMessageId } = attributes;
  if (quotedMessageId) {
    return {
      text: window.i18n('icu:Conversation--getDraftPreview--quote'),
    };
  }

  return {
    text: window.i18n('icu:Conversation--getDraftPreview--draft'),
  };
}
