// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { randomBytes } from 'node:crypto';
import { MuteExpiration, Uint32 } from '@signalapp/types';

import { getRandomBytes } from '../../Crypto.node.ts';
import * as Bytes from '../../Bytes.std.ts';
import { setupBasics, symmetricRoundtripHarness } from './helpers.preload.ts';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders.preload.ts';
import {
  deriveGroupID,
  deriveGroupSecretParams,
} from '../../util/zkgroup.node.ts';
import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import type { AxoColor } from '../../axo/AxoColor.std.ts';
import type { ConversationAttributesType } from '../../model-types.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import {
  generateAci,
  generatePni,
} from '../../test-helpers/serviceIdUtils.std.ts';

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
      muteExpiresAt: MuteExpiration.ALWAYS,
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

    const timestamp = Date.now();
    await itemStorage.blocked.addBlockedGroup(
      blockedGroupInfo.groupId,
      timestamp
    );

    await symmetricRoundtripHarness([]);

    const blockedGroupAfter = window.ConversationController.get(
      blockedGroupInfo.groupId
    );
    assert.isTrue(blockedGroupAfter?.isBlocked());
    const blockedGroupItem = itemStorage.blocked
      .getBlockedGroups()
      .get(blockedGroupInfo.groupId);
    assert.strictEqual(
      blockedGroupItem?.blockedAt,
      timestamp,
      'Timestamp on blocked group should be rountripped'
    );

    const unblockedGroupAfter = window.ConversationController.get(
      unblockedGroupInfo.groupId
    );
    assert.isFalse(unblockedGroupAfter?.isBlocked());
  });

  it('roundtrips custom chat colors', async () => {
    const RED = { solid: 0xffff0000 as AxoColor.ARGBInt };
    const GRADIENT = {
      gradient: {
        start: 0xffff0000 as AxoColor.ARGBInt,
        end: 0xff0000ff as AxoColor.ARGBInt,
        angle: Uint32.fromNumber(45),
      },
    };

    // So that database ids don't start at 1
    const deleted = await DataWriter.createCustomChatColor(RED);
    await DataWriter.deleteCustomChatColor(deleted.id);

    const red = await DataWriter.createCustomChatColor(RED);
    const gradient = await DataWriter.createCustomChatColor(GRADIENT);
    await DataWriter.updateAccountDefaultBubbleColor({
      customChatColorId: gradient.id,
    });

    const customAci = generateAci();
    const presetAci = generateAci();
    const deletedAci = generateAci();
    await window.ConversationController.getOrCreateAndWait(
      customAci,
      'private',
      { active_at: 1, customChatColorId: red.id }
    );
    await window.ConversationController.getOrCreateAndWait(
      presetAci,
      'private',
      { active_at: 1, bubbleColorPreset: 'crimson' }
    );
    // An in-memory model still holding onto a deleted color
    await window.ConversationController.getOrCreateAndWait(
      deletedAci,
      'private',
      { active_at: 1, customChatColorId: deleted.id }
    );

    await symmetricRoundtripHarness([]);

    const customChatColors = await DataReader.getAllCustomChatColors();
    assert.deepEqual(
      customChatColors.map(customChatColor => customChatColor.color),
      [RED, GRADIENT]
    );
    const [redAfter, gradientAfter] = customChatColors;
    strictAssert(redAfter != null && gradientAfter != null, 'colors exist');

    assert.deepEqual(await DataReader.getAccount(), {
      defaultBubbleColor: { customChatColorId: gradientAfter.id },
    });

    const customAfter = window.ConversationController.get(customAci);
    assert.strictEqual(customAfter?.get('customChatColorId'), redAfter.id);
    assert.isUndefined(customAfter?.get('bubbleColorPreset'));

    const presetAfter = window.ConversationController.get(presetAci);
    assert.strictEqual(presetAfter?.get('bubbleColorPreset'), 'crimson');
    assert.isUndefined(presetAfter?.get('customChatColorId'));

    const deletedAfter = window.ConversationController.get(deletedAci);
    assert.isUndefined(deletedAfter?.get('customChatColorId'));
    assert.isUndefined(deletedAfter?.get('bubbleColorPreset'));
  });
});
