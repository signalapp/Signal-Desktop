// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UUID } from '../types/UUID';
import * as log from '../logging/log';
import { isNotNil } from './isNotNil';
import { updateIdentityKey } from '../services/profiles';

export async function verifyStoryListMembers(
  uuids: Array<string>
): Promise<{ untrustedUuids: Set<string>; verifiedUuids: Set<string> }> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('verifyStoryListMembers: server not available');
  }

  const verifiedUuids = new Set<string>();
  const untrustedUuids = new Set<string>();

  const elements = await Promise.all(
    uuids.map(async aci => {
      const uuid = new UUID(aci);
      const fingerprint =
        await window.textsecure.storage.protocol.getFingerprint(uuid);

      if (!fingerprint) {
        log.warn('verifyStoryListMembers: no fingerprint found for uuid=', aci);
        untrustedUuids.add(aci);
        return;
      }

      verifiedUuids.add(aci);
      return { aci, fingerprint };
    })
  );

  const { elements: unverifiedACI } = await server.postBatchIdentityCheck(
    elements.filter(isNotNil)
  );

  await Promise.all(
    unverifiedACI.map(async ({ aci, identityKey }) => {
      untrustedUuids.add(aci);
      verifiedUuids.delete(aci);

      if (identityKey) {
        await updateIdentityKey(identityKey, new UUID(aci));
      } else {
        await window.ConversationController.get(aci)?.getProfiles();
      }
    })
  );

  return { untrustedUuids, verifiedUuids };
}
