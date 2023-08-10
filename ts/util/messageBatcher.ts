// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { createBatcher } from './batcher';
import { createWaitBatcher } from './waitBatcher';
import * as log from '../logging/log';

const updateMessageBatcher = createBatcher<MessageAttributesType>({
  name: 'messageBatcher.updateMessageBatcher',
  wait: 75,
  maxSize: 50,
  processBatch: async (messageAttrs: Array<MessageAttributesType>) => {
    log.info('updateMessageBatcher', messageAttrs.length);
    await window.Signal.Data.saveMessages(messageAttrs, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  },
});

let shouldBatch = true;

export function queueUpdateMessage(messageAttr: MessageAttributesType): void {
  if (shouldBatch) {
    updateMessageBatcher.add(messageAttr);
  } else {
    void window.Signal.Data.saveMessage(messageAttr, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
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
    log.info('saveNewMessageBatcher', messageAttrs.length);
    await window.Signal.Data.saveMessages(messageAttrs, {
      forceSave: true,
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  },
});
