// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { randomBytes } from 'node:crypto';
import { getRandomBytes } from '../../Crypto.node.js';
import * as Bytes from '../../Bytes.std.js';
import { setupBasics, symmetricRoundtripHarness } from './helpers.preload.js';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders.preload.js';
import {
  deriveGroupID,
  deriveGroupSecretParams,
} from '../../util/zkgroup.node.js';
import { DataWriter } from '../../sql/Client.preload.js';
import { generateAci, generatePni } from '../../types/ServiceId.std.js';
import type { ConversationAttributesType } from '../../model-types.d.ts';
import { strictAssert } from '../../util/assert.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

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
    itemStorage.reset();

    await setupBasics();

    await loadAllAndReinitializeRedux();
  });

  it('roundtrips 1:1 conversations', async () => {
    const firstUnregisteredAt = Date.now();

    const fields: Partial<ConversationAttributesType> = {
      systemGivenName: 'systemGivenName',
      systemFamilyName: 'systemFamilyName',
      systemNickname: 'systemNickname',
      profileName: 'profileName',
      profileFamilyName: 'profileFamilyName',
      nicknameGivenName: 'nicknameGivenName',
      nicknameFamilyName: 'nicknameFamilyName',
      hideStory: true,
      username: 'username.12',
      muteExpiresAt: Number.MAX_SAFE_INTEGER,
      note: 'note',
      e164: '+16175550000',
      pni: generatePni(),
      removalStage: 'justNotification',
      firstUnregisteredAt,
      discoveredUnregisteredAt: firstUnregisteredAt,
      profileKey: Bytes.toBase64(randomBytes(32)),
      profileSharing: true,
    };

    const aci = generateAci();
    await window.ConversationController.getOrCreateAndWait(aci, 'private', {
      ...fields,
      active_at: 1,
    });

    await symmetricRoundtripHarness([]);

    const convoAfter = window.ConversationController.get(aci);
    strictAssert(convoAfter, 'convo is roundtripped');

    for (const [key, value] of Object.entries(fields)) {
      assert.strictEqual(
        (convoAfter.attributes as Record<string, unknown>)[key],
        value,
        `conversation.${key} does not match`
      );
    }
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

    await itemStorage.blocked.addBlockedGroup(blockedGroupInfo.groupId);

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
