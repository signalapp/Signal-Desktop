// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MessageAttributesType } from '../model-types.d';
import { createBatcher } from './batcher';
import { createWaitBatcher } from './waitBatcher';

const updateMessageBatcher = createBatcher<MessageAttributesType>({
  name: 'messageBatcher.updateMessageBatcher',
  wait: 75,
  maxSize: 50,
  processBatch: async (messageAttrs: Array<MessageAttributesType>) => {
    window.log.info('updateMessageBatcher', messageAttrs.length);
    await window.Signal.Data.saveMessages(messageAttrs, {});
  },
});

let shouldBatch = true;

export function queueUpdateMessage(messageAttr: MessageAttributesType): void {
  if (shouldBatch) {
    updateMessageBatcher.add(messageAttr);
  } else {
    window.Signal.Data.saveMessage(messageAttr, {
      Message: window.Whisper.Message,
    });
  }
}

export function setBatchingStrategy(keepBatching = false): void {
  shouldBatch = keepBatching;
}

export const saveNewMessageBatcher = createWaitBatcher<MessageAttributesType>({
  name: 'messageBatcher.saveNewMessageBatcher',
  wait: 75,
  maxSize: 30,
  processBatch: async (messageAttrs: Array<MessageAttributesType>) => {
    window.log.info('saveNewMessageBatcher', messageAttrs.length);
    await window.Signal.Data.saveMessages(messageAttrs, { forceSave: true });
  },
});
