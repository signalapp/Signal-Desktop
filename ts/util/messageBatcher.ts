// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { createWaitBatcher } from './waitBatcher';
import { DataWriter } from '../sql/Client';
import { createLogger } from '../logging/log';
import { postSaveUpdates } from './cleanup';
import { MessageModel } from '../models/messages';

const log = createLogger('messageBatcher');

const updateMessageBatcher = createWaitBatcher<ReadonlyMessageAttributesType>({
  name: 'messageBatcher.updateMessageBatcher',
  wait: 75,
  maxSize: 50,
  processBatch: async (messageAttrs: Array<ReadonlyMessageAttributesType>) => {
    log.info('updateMessageBatcher', messageAttrs.length);

    // Grab the latest from the cache in case they've changed
    const messagesToSave = messageAttrs.map(
      message => window.MessageCache.getById(message.id)?.attributes ?? message
    );

    await DataWriter.saveMessages(messagesToSave, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
      postSaveUpdates,
    });
  },
});

let shouldBatch = true;

export async function queueUpdateMessage(
  messageAttr: ReadonlyMessageAttributesType
): Promise<void> {
  if (shouldBatch) {
    await updateMessageBatcher.add(messageAttr);
  } else {
    await window.MessageCache.saveMessage(messageAttr);
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
        message =>
          window.MessageCache.register(new MessageModel(message))?.attributes ??
          message
      );

      await DataWriter.saveMessages(messagesToSave, {
        forceSave: true,
        ourAci: window.textsecure.storage.user.getCheckedAci(),
        postSaveUpdates,
      });
    },
  });
