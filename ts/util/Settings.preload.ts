// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { itemStorage } from '../textsecure/Storage.preload.js';

export function getLinkPreviewSetting(): boolean {
  return itemStorage.get('linkPreviews', false);
}

export function getTypingIndicatorSetting(): boolean {
  return itemStorage.get('typingIndicators', false);
}
export function getReadReceiptSetting(): boolean {
  return itemStorage.get('read-receipt-setting', false);
}
export function getSealedSenderIndicatorSetting(): boolean {
  return itemStorage.get('sealedSenderIndicators', false);
}

export function areStoryViewReceiptsEnabled(): boolean {
  return (
    itemStorage.get('storyViewReceiptsEnabled') ??
    itemStorage.get('read-receipt-setting') ??
    false
  );
}

export async function setStoryViewReceiptsEnabled(
  value: boolean
): Promise<void> {
  await itemStorage.put('storyViewReceiptsEnabled', value);
  const account = window.ConversationController.getOurConversationOrThrow();
  account.captureChange('storyViewReceiptsEnabled');
}
