import { expect } from 'chai';
import * as sinon from 'sinon';
import * as _ from 'lodash';
import { MessageUtils } from '../../../../session/utils';
import { TestUtils } from '../../../../test/test-utils';
import { PendingMessageCache } from '../../../../session/sending/PendingMessageCache';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('PendingMessageCache', () => {
  const sandbox = sinon.createSandbox();
  // Initialize new stubbed cache
  let data: StorageItem;
  let pendingMessageCacheStub: PendingMessageCache;

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

    pendingMessageCacheStub = new PendingMessageCache();
  });

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  it('can initialize cache', async () => {
    const cache = await pendingMessageCacheStub.getAllPending();

    // We expect the cache to initialise as an empty array
    expect(cache).to.be.instanceOf(Array);
    expect(cache).to.have.length(0);
  });

  it('can add to cache', async () => {
    const device = TestUtils.generateFakePubKey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = await MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);

    // Verify that the message is in the cache
    const finalCache = await pendingMessageCacheStub.getAllPending();

    expect(finalCache).to.have.length(1);

    const addedMessage = finalCache[0];
    expect(addedMessage.device).to.deep.equal(rawMessage.device);
    expect(addedMessage.timestamp).to.deep.equal(rawMessage.timestamp);
  });

  it('can add multiple messages belonging to the same user', async () => {
    const device = TestUtils.generateFakePubKey();

    await pendingMessageCacheStub.add(device, TestUtils.generateChatMessage());
    // We have to timeout here otherwise it's processed too fast and messages start having the same timestamp
    await TestUtils.timeout(5);
    await pendingMessageCacheStub.add(device, TestUtils.generateChatMessage());
    await TestUtils.timeout(5);
    await pendingMessageCacheStub.add(device, TestUtils.generateChatMessage());

    // Verify that the message is in the cache
    const finalCache = await pendingMessageCacheStub.getAllPending();

    expect(finalCache).to.have.length(3);
  });

  it('can remove from cache', async () => {
    const device = TestUtils.generateFakePubKey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = await MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);

    const initialCache = await pendingMessageCacheStub.getAllPending();
    expect(initialCache).to.have.length(1);

    // Remove the message
    await pendingMessageCacheStub.remove(rawMessage);

    const finalCache = await pendingMessageCacheStub.getAllPending();

    // Verify that the message was removed
    expect(finalCache).to.have.length(0);
  });

  it('should only remove messages with different timestamp and device', async () => {
    const device = TestUtils.generateFakePubKey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = await MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);
    await TestUtils.timeout(5);
    const one = await pendingMessageCacheStub.add(
      device,
      TestUtils.generateChatMessage(message.identifier)
    );
    const two = await pendingMessageCacheStub.add(
      TestUtils.generateFakePubKey(),
      message
    );

    const initialCache = await pendingMessageCacheStub.getAllPending();
    expect(initialCache).to.have.length(3);

    // Remove the message
    await pendingMessageCacheStub.remove(rawMessage);

    const finalCache = await pendingMessageCacheStub.getAllPending();

    // Verify that the message was removed
    expect(finalCache).to.have.length(2);
    expect(finalCache).to.have.deep.members([one, two]);
  });

  it('can get devices', async () => {
    const cacheItems = [
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
    ];

    for (const item of cacheItems) {
      await pendingMessageCacheStub.add(item.device, item.message);
    }

    const cache = await pendingMessageCacheStub.getAllPending();
    expect(cache).to.have.length(cacheItems.length);

    // Get list of devices
    const devicesKeys = cacheItems.map(item => item.device.key);
    const pulledDevices = await pendingMessageCacheStub.getDevices();
    const pulledDevicesKeys = pulledDevices.map(d => d.key);

    // Verify that device list from cache is equivalent to devices added
    expect(pulledDevicesKeys).to.have.members(devicesKeys);
  });

  it('can get pending for device', async () => {
    const cacheItems = [
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
    ];

    for (const item of cacheItems) {
      await pendingMessageCacheStub.add(item.device, item.message);
    }

    const initialCache = await pendingMessageCacheStub.getAllPending();
    expect(initialCache).to.have.length(cacheItems.length);

    // Get pending for each specific device
    for (const item of cacheItems) {
      const pendingForDevice = await pendingMessageCacheStub.getForDevice(
        item.device
      );
      expect(pendingForDevice).to.have.length(1);
      expect(pendingForDevice[0].device).to.equal(item.device.key);
    }
  });

  it('can find nothing when empty', async () => {
    const device = TestUtils.generateFakePubKey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = await MessageUtils.toRawMessage(device, message);

    const foundMessage = pendingMessageCacheStub.find(rawMessage);
    expect(foundMessage, 'a message was found in empty cache').to.be.undefined;
  });

  it('can find message in cache', async () => {
    const device = TestUtils.generateFakePubKey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = await MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);

    const finalCache = await pendingMessageCacheStub.getAllPending();
    expect(finalCache).to.have.length(1);

    const foundMessage = pendingMessageCacheStub.find(rawMessage);
    expect(foundMessage, 'message not found in cache').to.be.ok;
    foundMessage && expect(foundMessage.device).to.equal(device.key);
  });

  it('can clear cache', async () => {
    const cacheItems = [
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
    ];

    for (const item of cacheItems) {
      await pendingMessageCacheStub.add(item.device, item.message);
    }

    const initialCache = await pendingMessageCacheStub.getAllPending();
    expect(initialCache).to.have.length(cacheItems.length);

    // Clear cache
    await pendingMessageCacheStub.clear();

    const finalCache = await pendingMessageCacheStub.getAllPending();
    expect(finalCache).to.have.length(0);
  });

  it('can restore from db', async () => {
    const cacheItems = [
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
      {
        device: TestUtils.generateFakePubKey(),
        message: TestUtils.generateChatMessage(),
      },
    ];

    for (const item of cacheItems) {
      await pendingMessageCacheStub.add(item.device, item.message);
    }

    const addedMessages = await pendingMessageCacheStub.getAllPending();
    expect(addedMessages).to.have.length(cacheItems.length);

    // Rebuild from DB
    const freshCache = new PendingMessageCache();

    // Verify messages
    const rebuiltMessages = await freshCache.getAllPending();

    for (const [index, message] of rebuiltMessages.entries()) {
      const addedMessage = addedMessages[index];

      // Pull out plainTextBuffer for a separate check
      const buffersCompare =
        Buffer.compare(
          message.plainTextBuffer,
          addedMessage.plainTextBuffer
        ) === 0;
      expect(buffersCompare).to.equal(
        true,
        'buffers were not loaded properly from database'
      );

      // Compare all other valures
      const trimmedAdded = _.omit(addedMessage, ['plainTextBuffer']);
      const trimmedRebuilt = _.omit(message, ['plainTextBuffer']);

      expect(_.isEqual(trimmedAdded, trimmedRebuilt)).to.equal(
        true,
        'cached messages were not rebuilt properly'
      );
    }
  });
});
