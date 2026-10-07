// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { ReadonlyDeep } from 'type-fest';

import type { ConversationType } from '../ducks/conversations.preload.ts';
import type { EmbeddedContactType } from '../../types/EmbeddedContact.std.ts';
import type {
  SharedContactRecipientType,
  SharedContactResolutionType,
} from '../../util/sharedContact.std.ts';
import { resolveSharedContact } from '../../util/sharedContact.std.ts';
import { getOwn } from '../../util/getOwn.std.ts';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.ts';
import {
  getConversationsByE164,
  getConversationsByServiceId,
} from './conversations.dom.ts';

function toRecipient(
  conversation: ConversationType | undefined
): SharedContactRecipientType | undefined {
  if (conversation == null) {
    return undefined;
  }
  return {
    conversationId: conversation.id,
    isUnregistered: isConversationUnregistered(conversation),
  };
}

export type ResolveSharedContactType = (
  contact: ReadonlyDeep<EmbeddedContactType>
) => SharedContactResolutionType;

export const getResolveSharedContactSelector = createSelector(
  getConversationsByServiceId,
  getConversationsByE164,
  (conversationsByServiceId, conversationsByE164): ResolveSharedContactType =>
    contact =>
      resolveSharedContact(contact, {
        getRecipientByServiceId: serviceId =>
          toRecipient(getOwn(conversationsByServiceId, serviceId)),
        getRecipientByE164: e164 =>
          toRecipient(getOwn(conversationsByE164, e164)),
      })
);
