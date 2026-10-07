// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { EmbeddedContactForUIType } from '../types/EmbeddedContact.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { missingCaseError } from './missingCaseError.std.ts';

const log = createLogger('sharedContact');

/**
 * Should only be called when the user has taken an action to interact with
 * the shared contact (e.g. by clicking "Message" or "Call")
 */
export function lookupOrCreateConversationIdForSharedContact(
  contact: ReadonlyDeep<EmbeddedContactForUIType>
): string | undefined {
  const { resolution } = contact;

  switch (resolution.type) {
    case 'not-on-signal':
      log.warn(`cannot start conversation with ${resolution.type} contact`);
      return undefined;

    case 'existing':
      return resolution.conversationId;

    case 'aci': {
      // The conversation may have been created since the contact was resolved
      const existing = window.ConversationController.get(resolution.aci);
      if (existing) {
        return existing.id;
      }

      const conversation = window.ConversationController.getOrCreate(
        resolution.aci,
        'private',
        {
          sharedGivenName: contact.name?.givenName,
          sharedFamilyName: contact.name?.familyName,
        }
      );
      log.info(`created ${conversation.idForLogging()} from shared contact`);

      return conversation.id;
    }

    default:
      throw missingCaseError(resolution);
  }
}
