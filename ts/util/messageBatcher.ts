// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { createBatcher } from './batcher';
import { createWaitBatcher } from './waitBatcher';
import { DataWriter } from '../sql/Client';
import * as log from '../logging/log';

const updateMessageBatcher = createBatcher<ReadonlyMessageAttributesType>({
  name: 'messageBatcher.updateMessageBatcher',
  wait: 75,
  maxSize: 50,
  processBatch: async (messageAttrs: Array<ReadonlyMessageAttributesType>) => {
    log.info('updateMessageBatcher', messageAttrs.length);

    // Grab the latest from the cache in case they've changed
    const messagesToSave = messageAttrs.map(
      message => window.MessageCache.accessAttributes(message.id) ?? message
    );

    await DataWriter.saveMessages(messagesToSave, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  },
});

let shouldBatch = true;

export function queueUpdateMessage(
  messageAttr: ReadonlyMessageAttributesType
): void {
  if (shouldBatch) {
    updateMessageBatcher.add(messageAttr);
  } else {
    void DataWriter.saveMessage(messageAttr, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  }
}

export function setBatchingStrategy(keepBatching = false): void {
  shouldBatch = keepBatching;
}

export const saveNewMessageBatcher =
  createWaitBatcher<ReadonlyMessageAttributesType>({
    name: 'messageBatcher.saveNewMessageBatcher',
    wait: 75,
    maxSize: 30,
    processBatch: async (
      messageAttrs: Array<ReadonlyMessageAttributesType>
    ) => {
      log.info('saveNewMessageBatcher', messageAttrs.length);

      // Grab the latest from the cache in case they've changed
      const messagesToSave = messageAttrs.map(
        message => window.MessageCache.accessAttributes(message.id) ?? message
      );

      await DataWriter.saveMessages(messagesToSave, {
        forceSave: true,
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    },
  });
