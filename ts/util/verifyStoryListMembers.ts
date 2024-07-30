// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { isNotNil } from './isNotNil';
import { updateIdentityKey } from '../services/profiles';
import type { ServiceIdString } from '../types/ServiceId';
import * as Bytes from '../Bytes';

export async function verifyStoryListMembers(
  serviceIds: Array<ServiceIdString>
): Promise<{
  untrustedServiceIds: Set<ServiceIdString>;
  verifiedServiceIds: Set<ServiceIdString>;
}> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('verifyStoryListMembers: server not available');
  }

  const verifiedServiceIds = new Set<ServiceIdString>();
  const untrustedServiceIds = new Set<ServiceIdString>();

  const elements = await Promise.all(
    serviceIds.map(async serviceId => {
      const fingerprint =
        await window.textsecure.storage.protocol.getFingerprint(serviceId);

      if (!fingerprint) {
        log.warn(
          'verifyStoryListMembers: no fingerprint found for serviceId=',
          serviceId
        );
        untrustedServiceIds.add(serviceId);
        return;
      }

      verifiedServiceIds.add(serviceId);
      return { uuid: serviceId, fingerprint };
    })
  );

  const { elements: unverifiedServiceId } = await server.postBatchIdentityCheck(
    elements.filter(isNotNil)
  );

  await Promise.all(
    unverifiedServiceId.map(async ({ uuid: serviceId, identityKey }) => {
      untrustedServiceIds.add(serviceId);
      verifiedServiceIds.delete(serviceId);

      if (identityKey) {
        const identityKeyBytes = Bytes.fromBase64(identityKey);
        await updateIdentityKey(identityKeyBytes, serviceId);
      } else {
        await window.ConversationController.get(serviceId)?.getProfiles();
      }
    })
  );

  return { untrustedServiceIds, verifiedServiceIds };
}
