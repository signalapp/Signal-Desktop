// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d';
import { isIncoming, isOutgoing } from '../state/selectors/message';
import { getTitle } from './getTitle';

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

export function getMessageAuthorText(
  messageAttributes?: ReadonlyMessageAttributesType
): string | undefined {
  if (!messageAttributes) {
    return undefined;
  }

  // if it's outgoing, it must be self-authored
  const selfAuthor = isOutgoing(messageAttributes)
    ? window.i18n('icu:you')
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
