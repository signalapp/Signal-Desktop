// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { hasExpired } from '../state/selectors/expiration.dom.js';
import { isOSUnsupported } from '../state/selectors/updates.std.js';

import type { AnyToast } from '../types/Toast.dom.js';
import { ToastType } from '../types/Toast.dom.js';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from './whatTypeOfConversation.dom.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

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

  const { e164, serviceId } = conversationAttributes;
  if (
    isDirectConversation(conversationAttributes) &&
    ((e164 && itemStorage.blocked.isBlocked(e164)) ||
      (serviceId && itemStorage.blocked.isServiceIdBlocked(serviceId)))
  ) {
    return { toastType: ToastType.Blocked };
  }

  const { groupId } = conversationAttributes;
  if (
    !isDirectConversation(conversationAttributes) &&
    groupId &&
    itemStorage.blocked.isGroupBlocked(groupId)
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
