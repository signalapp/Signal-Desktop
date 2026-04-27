// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { DraftPreviewType } from '../state/ducks/conversations.preload.ts';
import { BodyRange } from '../types/BodyRange.std.ts';
import { findAndFormatContact } from './findAndFormatContact.preload.ts';
import { hydrateRanges } from './BodyRange.node.ts';
import { isVoiceMessage } from './Attachment.std.ts';
import { stripNewlinesForLeftPane } from './stripNewlinesForLeftPane.std.ts';
import { isDirectConversation } from './whatTypeOfConversation.dom.ts';

const { i18n } = window.SignalContext;

export function getDraftPreview(
  attributes: ConversationAttributesType
): DraftPreviewType {
  const { draft } = attributes;

  const rawBodyRanges = attributes.draftBodyRanges || [];
  const bodyRangesToHydrate = isDirectConversation(attributes)
    ? rawBodyRanges.filter(range => !BodyRange.isMention(range))
    : rawBodyRanges;
  const bodyRanges = hydrateRanges(bodyRangesToHydrate, findAndFormatContact);

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
        text: i18n('icu:message--getNotificationText--voice-message'),
        prefix: '🎤',
      };
    }
    return {
      text: i18n('icu:Conversation--getDraftPreview--attachment'),
    };
  }

  const { quotedMessageId } = attributes;
  if (quotedMessageId) {
    return {
      text: i18n('icu:Conversation--getDraftPreview--quote'),
    };
  }

  return {
    text: i18n('icu:Conversation--getDraftPreview--draft'),
  };
}
