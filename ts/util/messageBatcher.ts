// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MessageAttributesType } from '../model-types.d';
import { createBatcher } from './batcher';
import { createWaitBatcher } from './waitBatcher';

export const updateMessageBatcher = createBatcher<MessageAttributesType>({
  wait: 500,
  maxSize: 50,
  processBatch: async (messages: Array<MessageAttributesType>) => {
    window.log.info('updateMessageBatcher', messages.length);
    await window.Signal.Data.saveMessages(messages, {});
  },
});

export const saveNewMessageBatcher = createWaitBatcher<MessageAttributesType>({
  wait: 500,
  maxSize: 30,
  processBatch: async (messages: Array<MessageAttributesType>) => {
    window.log.info('saveNewMessageBatcher', messages.length);
    await window.Signal.Data.saveMessages(messages, { forceSave: true });
  },
});
