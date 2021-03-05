// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MessageAttributesType } from '../model-types.d';
import { createBatcher } from './batcher';
import { createWaitBatcher } from './waitBatcher';

export const updateMessageBatcher = createBatcher<MessageAttributesType>({
  wait: 500,
  maxSize: 50,
  processBatch: async (messageAttrs: Array<MessageAttributesType>) => {
    window.log.info('updateMessageBatcher', messageAttrs.length);
    await window.Signal.Data.saveMessages(messageAttrs, {});
  },
});

export const saveNewMessageBatcher = createWaitBatcher<MessageAttributesType>({
  wait: 500,
  maxSize: 30,
  processBatch: async (messageAttrs: Array<MessageAttributesType>) => {
    window.log.info('saveNewMessageBatcher', messageAttrs.length);
    await window.Signal.Data.saveMessages(messageAttrs, { forceSave: true });
  },
});
