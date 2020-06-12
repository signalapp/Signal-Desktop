import { expect } from 'chai';
import * as _ from 'lodash';

import { MessageUtils, SyncMessageUtils } from '../../../session/utils';
import { TestUtils } from '../../../test/test-utils';

import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';
import { generateChatMessage } from '../../test-utils/testUtils';
import { OpenGroup } from '../../../session/types/OpenGroup';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('MessageQueue', () => {
  // Initialize new stubbed cache
  let data: StorageItem;
  let pendingMessageCacheStub: PendingMessageCache;

  beforeEach(async () => {
    //
  });

  afterEach(() => {
    //
  });

  it('can init queue', async () => {
    const device = TestUtils.generateFakePubkey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);


  });

  it('can add directly to jobs queue', async () => {
    const device = TestUtils.generateFakePubkey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);


  });

  it('can queue', async () => {
    const device = TestUtils.generateFakePubkey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);


  });

  it('can process pending', async () => {
    const device = TestUtils.generateFakePubkey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);


  });

});
