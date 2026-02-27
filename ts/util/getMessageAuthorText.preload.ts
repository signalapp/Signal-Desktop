// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d.ts';
import type { AciString } from '../types/ServiceId.std.js';
import { isIncoming, isOutgoing } from '../state/selectors/message.preload.js';
import { isAciString } from './isAciString.std.js';
import { getTitle } from './getTitle.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

function getIncomingContact(
  messageAttributes: ReadonlyMessageAttributesType
): ConversationAttributesType | undefined {
  if (!isIncoming(messageAttributes)) {
    return undefined;
  }
  const { sourceServiceId } = messageAttributes;
  if (!sourceServiceId) {
    return undefined;
  }

  return window.ConversationController.getOrCreate(sourceServiceId, 'private')
    .attributes;
}

/** @deprecated Use getMessageAuthorAci instead */
export function getMessageAuthorText(
  messageAttributes?: ReadonlyMessageAttributesType
): string | undefined {
  if (!messageAttributes) {
    return undefined;
  }

  // if it's outgoing, it must be self-authored
  const selfAuthor = isOutgoing(messageAttributes)
    ? window.SignalContext.i18n('icu:you')
    : undefined;

  if (selfAuthor) {
    return selfAuthor;
  }

  const incomingContact = getIncomingContact(messageAttributes);
  if (incomingContact) {
    return getTitle(incomingContact, { isShort: true });
  }

  // if it's not selfAuthor and there's no incoming contact,
  // it might be a group notification, so we return undefined
  return undefined;
}

export function getMessageAuthorAci(
  messageAttributes: ReadonlyMessageAttributesType
): AciString | null {
  if (isOutgoing(messageAttributes)) {
    return itemStorage.user.getCheckedAci();
  }
  if (isIncoming(messageAttributes)) {
    const { sourceServiceId } = messageAttributes;
    if (isAciString(sourceServiceId)) {
      return sourceServiceId;
    }
  }
  return null;
}
