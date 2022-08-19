// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations';
import type { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import * as log from '../logging/log';
import { explodePromise } from './explodePromise';
import { getConversationIdForLogging } from './idForLogging';

export async function blockSendUntilConversationsAreVerified(
  conversations: Array<ConversationModel>,
  source?: SafetyNumberChangeSource,
  timestampThreshold?: number
): Promise<boolean> {
  const conversationsToPause = new Map<string, Set<string>>();

  await Promise.all(
    conversations.map(async conversation => {
      if (!conversation) {
        return;
      }

      const uuidsStoppingSend = new Set<string>();

      await conversation.updateVerified();
      const unverifieds = conversation.getUnverified();

      if (unverifieds.length) {
        unverifieds.forEach(unverifiedConversation => {
          const uuid = unverifiedConversation.get('uuid');
          if (uuid) {
            uuidsStoppingSend.add(uuid);
          }
        });
      }

      const untrusted = conversation.getUntrusted(timestampThreshold);
      if (untrusted.length) {
        untrusted.forEach(untrustedConversation => {
          const uuid = untrustedConversation.get('uuid');
          if (uuid) {
            uuidsStoppingSend.add(uuid);
          }
        });
      }

      if (uuidsStoppingSend.size) {
        log.info('blockSendUntilConversationsAreVerified: blocking send', {
          id: getConversationIdForLogging(conversation.attributes),
          untrustedCount: uuidsStoppingSend.size,
        });
        conversationsToPause.set(conversation.id, uuidsStoppingSend);
      }
    })
  );

  if (conversationsToPause.size) {
    const explodedPromise = explodePromise<boolean>();
    window.reduxActions.globalModals.showBlockingSafetyNumberChangeDialog(
      conversationsToPause,
      explodedPromise,
      source
    );
    return explodedPromise.promise;
  }

  return true;
}
