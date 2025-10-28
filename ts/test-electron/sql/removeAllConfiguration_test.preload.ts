// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import { DataWriter, DataReader } from '../../sql/Client.preload.js';

describe('Remove all configuration test', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
  });
  it('Removes conversation-specific configuration', async () => {
    const { attributes } =
      await window.ConversationController.getOrCreateAndWait(
        generateGuid(),
        'private',
        {
          expireTimerVersion: 3,
          senderKeyInfo: {
            createdAtDate: Date.now(),
            distributionId: generateGuid(),
            memberDevices: [],
          },
          storageID: 'storageId',
          needsStorageServiceSync: true,
          storageUnknownFields: 'base64==',
          name: 'Name (and all other fields) should be preserved',
        }
      );

    await DataWriter.removeAllConfiguration();

    const convoAfter = await DataReader.getConversationById(attributes.id);
    assert.strictEqual(convoAfter?.expireTimerVersion, 1);
    assert.isUndefined(convoAfter?.storageID);
    assert.isUndefined(convoAfter?.needsStorageServiceSync);
    assert.isUndefined(convoAfter?.storageUnknownFields);
    assert.isUndefined(convoAfter?.senderKeyInfo);
    assert.strictEqual(
      convoAfter?.name,
      'Name (and all other fields) should be preserved'
    );
  });
});
