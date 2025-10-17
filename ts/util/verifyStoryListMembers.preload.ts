// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { isNotNil } from './isNotNil.std.js';
import { updateIdentityKey } from '../services/profiles.preload.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { postBatchIdentityCheck } from '../textsecure/WebAPI.preload.js';
import * as Bytes from '../Bytes.std.js';

const log = createLogger('verifyStoryListMembers');

export async function verifyStoryListMembers(
  serviceIds: Array<ServiceIdString>
): Promise<{
  untrustedServiceIds: Set<ServiceIdString>;
  verifiedServiceIds: Set<ServiceIdString>;
}> {
  const verifiedServiceIds = new Set<ServiceIdString>();
  const untrustedServiceIds = new Set<ServiceIdString>();

  const elements = await Promise.all(
    serviceIds.map(async serviceId => {
      const fingerprint = await signalProtocolStore.getFingerprint(serviceId);

      if (!fingerprint) {
        log.warn('no fingerprint found for serviceId=', serviceId);
        untrustedServiceIds.add(serviceId);
        return;
      }

      verifiedServiceIds.add(serviceId);
      return { uuid: serviceId, fingerprint };
    })
  );

  const { elements: unverifiedServiceId } = await postBatchIdentityCheck(
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
