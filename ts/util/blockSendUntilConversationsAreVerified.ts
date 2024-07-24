// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import * as log from '../logging/log';
import { explodePromise } from './explodePromise';
import type {
  RecipientsByConversation,
  RecipientEntry,
} from '../state/ducks/stories';
import { isNotNil } from './isNotNil';
import type { ServiceIdString } from '../types/ServiceId';
import { waitForAll } from './waitForAll';

export async function blockSendUntilConversationsAreVerified(
  byConversationId: RecipientsByConversation,
  source: SafetyNumberChangeSource,
  timestampThreshold?: number
): Promise<boolean> {
  const allServiceIds = getAllServiceIds(byConversationId);
  await waitForAll({
    tasks: Array.from(allServiceIds).map(
      serviceId => async () => updateServiceIdTrust(serviceId)
    ),
  });

  const untrustedByConversation = filterServiceIds(
    byConversationId,
    (serviceId: ServiceIdString) =>
      !isServiceIdTrusted(serviceId, timestampThreshold)
  );

  const untrustedServiceIds = getAllServiceIds(untrustedByConversation);
  if (untrustedServiceIds.size) {
    log.info(
      `blockSendUntilConversationsAreVerified: Blocking send; ${untrustedServiceIds.size} untrusted uuids`
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

async function updateServiceIdTrust(serviceId: ServiceIdString) {
  const conversation = window.ConversationController.get(serviceId);
  if (!conversation) {
    return;
  }

  await conversation.updateVerified();
}

function isServiceIdTrusted(
  serviceId: ServiceIdString,
  timestampThreshold?: number
) {
  const conversation = window.ConversationController.get(serviceId);
  if (!conversation) {
    log.warn(
      `blockSendUntilConversationsAreVerified/isServiceIdTrusted: No conversation for send target ${serviceId}`
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

export function getAllServiceIds(
  byConversation: RecipientsByConversation
): Set<ServiceIdString> {
  const allServiceIds = new Set<ServiceIdString>();
  Object.values(byConversation).forEach(conversationData => {
    conversationData.serviceIds.forEach(serviceId =>
      allServiceIds.add(serviceId)
    );

    if (conversationData.byDistributionId) {
      Object.values(conversationData.byDistributionId).forEach(
        distributionData => {
          distributionData.serviceIds.forEach(serviceId =>
            allServiceIds.add(serviceId)
          );
        }
      );
    }
  });
  return allServiceIds;
}

export function filterServiceIds(
  byConversation: RecipientsByConversation,
  predicate: (serviceId: ServiceIdString) => boolean
): RecipientsByConversation {
  const filteredByConversation: Record<string, RecipientEntry> = {};
  Object.entries(byConversation).forEach(
    ([conversationId, conversationData]) => {
      const conversationFiltered = conversationData.serviceIds
        .map(serviceId => {
          if (predicate(serviceId)) {
            return serviceId;
          }

          return undefined;
        })
        .filter(isNotNil);

      let byDistributionId:
        | Record<string, { serviceIds: Array<ServiceIdString> }>
        | undefined;

      if (conversationData.byDistributionId) {
        Object.entries(conversationData.byDistributionId).forEach(
          ([distributionId, distributionData]) => {
            const distributionFiltered = distributionData.serviceIds
              .map(serviceId => {
                if (predicate(serviceId)) {
                  return serviceId;
                }

                return undefined;
              })
              .filter(isNotNil);

            if (distributionFiltered.length) {
              byDistributionId = {
                ...byDistributionId,
                [distributionId]: {
                  serviceIds: distributionFiltered,
                },
              };
            }
          }
        );
      }

      if (conversationFiltered.length || byDistributionId) {
        filteredByConversation[conversationId] = {
          serviceIds: conversationFiltered,
          ...(byDistributionId ? { byDistributionId } : undefined),
        };
      }
    }
  );
  return filteredByConversation;
}
