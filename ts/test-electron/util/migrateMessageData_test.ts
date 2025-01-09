// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { v7 as uuid } from 'uuid';
import { _migrateMessageData as migrateMessageData } from '../../messages/migrateMessageData';
import type { MessageAttributesType } from '../../model-types';
import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { postSaveUpdates } from '../../util/cleanup';

function composeMessage(timestamp: number): MessageAttributesType {
  return {
    schemaVersion: 1,
    conversationId: uuid(),
    id: uuid(),
    type: 'incoming',
    received_at: timestamp,
    received_at_ms: timestamp,
    sent_at: timestamp,
    timestamp,
  };
}

describe('utils/migrateMessageData', async () => {
  before(async () => {
    await DataWriter.removeAll();
    await window.storage.put('uuid_id', generateAci());
  });
  after(async () => {
    await DataWriter.removeAll();
  });
  it('increments attempts for messages which fail to save', async () => {
    const messages = new Array(5)
      .fill(null)
      .map((_, idx) => composeMessage(idx + 1));

    const CANNOT_UPGRADE_MESSAGE_ID = messages[1].id;
    const CANNOT_SAVE_MESSAGE_ID = messages[2].id;
    await DataWriter.saveMessages(messages, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates,
    });

    const result = await migrateMessageData({
      numMessagesPerBatch: 10_000,
      upgradeMessageSchema: async (message, ...rest) => {
        if (message.id === CANNOT_UPGRADE_MESSAGE_ID) {
          throw new Error('upgrade failed');
        }
        return window.Signal.Migrations.upgradeMessageSchema(message, ...rest);
      },
      getMessagesNeedingUpgrade: async (...args) => {
        const messagesToUpgrade = await DataReader.getMessagesNeedingUpgrade(
          ...args
        );

        return messagesToUpgrade.map(message => {
          if (message.id === CANNOT_SAVE_MESSAGE_ID) {
            return {
              ...message,
              // mimic bad data in DB
              sent_at: { low: 0, high: 0 } as unknown as number,
            };
          }
          return message;
        });
      },
      saveMessagesIndividually: DataWriter.saveMessagesIndividually,
      incrementMessagesMigrationAttempts:
        DataWriter.incrementMessagesMigrationAttempts,
    });

    assert.equal(result.done, true);
    assert.equal(result.numProcessed, 5);
    assert.equal(result.numSucceeded, 3);
    assert.equal(result.numFailedSave, 1);
    assert.equal(result.numFailedUpgrade, 1);

    const upgradedMessages = await DataReader._getAllMessages();
    for (const message of upgradedMessages) {
      if (
        message.id === CANNOT_SAVE_MESSAGE_ID ||
        message.id === CANNOT_UPGRADE_MESSAGE_ID
      ) {
        assert.equal(message.schemaMigrationAttempts, 1);
        assert.equal(message.schemaVersion, 1);
      } else {
        assert.equal(message.schemaMigrationAttempts ?? 0, 0);
        assert.equal((message.schemaVersion ?? 0) > 1, true);
      }
    }
  });
});
