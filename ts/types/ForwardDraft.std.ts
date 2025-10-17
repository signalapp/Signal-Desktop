// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { AttachmentForUIType } from './Attachment.std.js';
import { isVoiceMessage, isDownloaded } from '../util/Attachment.std.js';
import type { HydratedBodyRangesType } from './BodyRange.std.js';
import type { LinkPreviewForUIType } from './message/LinkPreviews.std.js';

const { orderBy } = lodash;

export type MessageForwardDraft = Readonly<{
  attachments?: ReadonlyArray<AttachmentForUIType>;
  bodyRanges?: HydratedBodyRangesType;
  hasContact: boolean;
  isSticker: boolean;
  messageBody?: string;
  originalMessageId: string | null; // null for new messages
  previews: ReadonlyArray<LinkPreviewForUIType>;
}>;

export type ForwardMessageData = Readonly<{
  // only null for new messages
  originalMessage: ReadonlyMessageAttributesType | null;
  draft: MessageForwardDraft;
}>;

export function isDraftEditable(draft: MessageForwardDraft): boolean {
  if (draft.isSticker) {
    return false;
  }
  if (draft.hasContact) {
    return false;
  }
  const hasVoiceMessage = draft.attachments?.some(isVoiceMessage) ?? false;
  if (hasVoiceMessage) {
    return false;
  }
  return true;
}

function isDraftEmpty(draft: MessageForwardDraft) {
  const { messageBody, attachments, isSticker, hasContact } = draft;
  if (isSticker || hasContact) {
    return false;
  }
  if (attachments != null && attachments.length > 0) {
    return false;
  }
  if (messageBody != null && messageBody.length > 0) {
    return false;
  }
  return true;
}

export function isDraftForwardable(draft: MessageForwardDraft): boolean {
  const { attachments } = draft;
  if (isDraftEmpty(draft)) {
    return false;
  }
  if (attachments != null && attachments.length > 0) {
    if (!attachments.every(isDownloaded)) {
      return false;
    }
  }
  return true;
}

export function sortByMessageOrder<T>(
  items: ReadonlyArray<T>,
  getMesssage: (
    item: T
  ) => Pick<ReadonlyMessageAttributesType, 'sent_at' | 'received_at'> | null
): Array<T> {
  return orderBy(
    items,
    [
      item => getMesssage(item)?.received_at,
      item => getMesssage(item)?.sent_at,
    ],
    ['ASC', 'ASC']
  );
}
