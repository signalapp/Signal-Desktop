// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';
import { hasExpired } from '../state/selectors/expiration';
import { isOSUnsupported } from '../state/selectors/updates';

import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from './whatTypeOfConversation';

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

export function shouldShowInvalidMessageToast(
  conversationAttributes: ConversationAttributesType,
  messageText?: string
): AnyToast | undefined {
  const state = window.reduxStore.getState();
  if (hasExpired(state)) {
    if (isOSUnsupported(state)) {
      return { toastType: ToastType.UnsupportedOS };
    }
    return { toastType: ToastType.Expired };
  }

  const isValid =
    isDirectConversation(conversationAttributes) ||
    isGroupV1(conversationAttributes) ||
    isGroupV2(conversationAttributes);

  if (!isValid) {
    return { toastType: ToastType.InvalidConversation };
  }

  const { e164, uuid } = conversationAttributes;
  if (
    isDirectConversation(conversationAttributes) &&
    ((e164 && window.storage.blocked.isBlocked(e164)) ||
      (uuid && window.storage.blocked.isUuidBlocked(uuid)))
  ) {
    return { toastType: ToastType.Blocked };
  }

  const { groupId } = conversationAttributes;
  if (
    !isDirectConversation(conversationAttributes) &&
    groupId &&
    window.storage.blocked.isGroupBlocked(groupId)
  ) {
    return { toastType: ToastType.BlockedGroup };
  }

  if (
    !isDirectConversation(conversationAttributes) &&
    conversationAttributes.left
  ) {
    return { toastType: ToastType.LeftGroup };
  }

  if (messageText && messageText.length > MAX_MESSAGE_BODY_LENGTH) {
    return { toastType: ToastType.MessageBodyTooLong };
  }

  return undefined;
}
