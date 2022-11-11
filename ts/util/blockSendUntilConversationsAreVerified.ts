// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import * as log from '../logging/log';
import { explodePromise } from './explodePromise';
import type { RecipientsByConversation } from '../state/ducks/stories';
import { isNotNil } from './isNotNil';
import type { UUIDStringType } from '../types/UUID';
import { waitForAll } from './waitForAll';

export async function blockSendUntilConversationsAreVerified(
  byConversationId: RecipientsByConversation,
  source: SafetyNumberChangeSource,
  timestampThreshold?: number
): Promise<boolean> {
  const allUuids = getAllUuids(byConversationId);
  await waitForAll({
    tasks: Array.from(allUuids).map(uuid => async () => updateUuidTrust(uuid)),
  });

  const untrustedByConversation = filterUuids(
    byConversationId,
    (uuid: UUIDStringType) => !isUuidTrusted(uuid, timestampThreshold)
  );

  const untrustedUuids = getAllUuids(untrustedByConversation);
  if (untrustedUuids.size) {
    log.info(
      `blockSendUntilConversationsAreVerified: Blocking send; ${untrustedUuids.size} untrusted uuids`
    );

    const explodedPromise = explodePromise<boolean>();
    window.reduxActions.globalModals.showBlockingSafetyNumberChangeDialog(
      untrustedByConversation,
      explodedPromise,
      source
    );
    return explodedPromise.promise;
  }

  return true;
}

async function updateUuidTrust(uuid: string) {
  const conversation = window.ConversationController.get(uuid);
  if (!conversation) {
    return;
  }

  await conversation.updateVerified();
}

function isUuidTrusted(uuid: string, timestampThreshold?: number) {
  const conversation = window.ConversationController.get(uuid);
  if (!conversation) {
    log.warn(
      `blockSendUntilConversationsAreVerified/isUuidTrusted: No conversation for send target ${uuid}`
    );
    return true;
  }

  const unverifieds = conversation.getUnverified();
  if (unverifieds.length) {
    return false;
  }

  const untrusted = conversation.getUntrusted(timestampThreshold);
  if (untrusted.length) {
    return false;
  }

  return true;
}

export function getAllUuids(
  byConversation: RecipientsByConversation
): Set<UUIDStringType> {
  const allUuids = new Set<UUIDStringType>();
  Object.values(byConversation).forEach(conversationData => {
    conversationData.uuids.forEach(uuid => allUuids.add(uuid));

    if (conversationData.byDistributionId) {
      Object.values(conversationData.byDistributionId).forEach(
        distributionData => {
          distributionData.uuids.forEach(uuid => allUuids.add(uuid));
        }
      );
    }
  });
  return allUuids;
}

export function filterUuids(
  byConversation: RecipientsByConversation,
  predicate: (uuid: UUIDStringType) => boolean
): RecipientsByConversation {
  const filteredByConversation: RecipientsByConversation = {};
  Object.entries(byConversation).forEach(
    ([conversationId, conversationData]) => {
      const conversationFiltered = conversationData.uuids
        .map(uuid => {
          if (predicate(uuid)) {
            return uuid;
          }

          return undefined;
        })
        .filter(isNotNil);

      let byDistributionId:
        | Record<string, { uuids: Array<UUIDStringType> }>
        | undefined;

      if (conversationData.byDistributionId) {
        Object.entries(conversationData.byDistributionId).forEach(
          ([distributionId, distributionData]) => {
            const distributionFiltered = distributionData.uuids
              .map(uuid => {
                if (predicate(uuid)) {
                  return uuid;
                }

                return undefined;
              })
              .filter(isNotNil);

            if (distributionFiltered.length) {
              byDistributionId = {
                ...byDistributionId,
                [distributionId]: {
                  uuids: distributionFiltered,
                },
              };
            }
          }
        );
      }

      if (conversationFiltered.length || byDistributionId) {
        filteredByConversation[conversationId] = {
          uuids: conversationFiltered,
          ...(byDistributionId ? { byDistributionId } : undefined),
        };
      }
    }
  );
  return filteredByConversation;
}
