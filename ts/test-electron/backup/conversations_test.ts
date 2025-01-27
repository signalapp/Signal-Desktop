// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getRandomBytes } from '../../Crypto';
import * as Bytes from '../../Bytes';
import { setupBasics, symmetricRoundtripHarness } from './helpers';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';
import { deriveGroupID, deriveGroupSecretParams } from '../../util/zkgroup';
import { DataWriter } from '../../sql/Client';

function getGroupTestInfo() {
  const masterKey = getRandomBytes(32);
  const secretParams = deriveGroupSecretParams(masterKey);
  const groupId = Bytes.toBase64(deriveGroupID(secretParams));

  return { masterKey: Bytes.toBase64(masterKey), secretParams, groupId };
}

describe('backup/conversations', () => {
  beforeEach(async () => {
    await DataWriter._removeAllMessages();
    await DataWriter._removeAllConversations();
    window.storage.reset();

    await setupBasics();

    await loadAllAndReinitializeRedux();
  });

  it('roundtrips block state on group conversations', async () => {
    const blockedGroupInfo = getGroupTestInfo();
    await window.ConversationController.getOrCreateAndWait(
      blockedGroupInfo.groupId,
      'group',
      {
        groupId: blockedGroupInfo.groupId,
        groupVersion: 2,
        masterKey: blockedGroupInfo.masterKey,
        name: 'Rock Enthusiasts',
      }
    );

    const unblockedGroupInfo = getGroupTestInfo();
    await window.ConversationController.getOrCreateAndWait(
      unblockedGroupInfo.groupId,
      'group',
      {
        groupId: unblockedGroupInfo.groupId,
        groupVersion: 2,
        masterKey: unblockedGroupInfo.masterKey,
        name: 'Rock Enthusiasts 2',
      }
    );

    await window.storage.blocked.addBlockedGroup(blockedGroupInfo.groupId);

    await symmetricRoundtripHarness([]);

    const blockedGroupAfter = window.ConversationController.get(
      blockedGroupInfo.groupId
    );
    assert.isTrue(blockedGroupAfter?.isBlocked());
    const unblockedGroupAfter = window.ConversationController.get(
      unblockedGroupInfo.groupId
    );
    assert.isFalse(unblockedGroupAfter?.isBlocked());
  });
});
