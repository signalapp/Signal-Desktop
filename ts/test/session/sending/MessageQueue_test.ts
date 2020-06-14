import { expect } from 'chai';
import * as _ from 'lodash';
import { MessageUtils } from '../../../session/utils';
import { TestUtils } from '../../../test/test-utils';
import { PendingMessageCache, MessageQueue } from '../../../session/sending/MessageQueue';
import { generateFakePubkey, generateChatMessage } from '../../test-utils/testUtils';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('Message Queue', () => {
  // Initialize new stubbed cache
  let data: StorageItem;
  let messageQueueStub: MessageQueue;

  beforeEach(async () => {
    // Stub out methods which touch the database
    const storageID = 'pendingMessages';
    data = {
      id: storageID,
      value: '[]',
    };

    TestUtils.stubData('getItemById')
      .withArgs('pendingMessages')
      .callsFake(async () => {
        return data;
      });

    TestUtils.stubData('createOrUpdateItem').callsFake((item: StorageItem) => {
      if (item.id === storageID) {
        data = item;
      }
    });

    messageQueueStub = new MessageQueue();
  });

  afterEach(() => {
    TestUtils.restoreStubs();
  });

  it('can send to many devices', async () => {
    const devices = Array.from({length: 40}, generateFakePubkey);
    const message = generateChatMessage();

    await messageQueueStub.sendMessageToDevices(devices, message);

    // Failure will make an error
  });

  it('can send using multidevice', async () => {
    const device = generateFakePubkey();
    const message = generateChatMessage();

    await messageQueueStub.sendUsingMultiDevice(device, message);
    
  });

  it('', async () => {
    
  });

  it("won't process invalid message", async () => {
    // process with message undefined
  });

});
