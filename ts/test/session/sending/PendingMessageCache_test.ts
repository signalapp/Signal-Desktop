import { expect } from 'chai';
import * as sinon from 'sinon';
import uuid from 'uuid';

import { ChatMessage } from '../../../session/messages/outgoing';
import * as MessageUtils from '../../../session/utils';

import { TestUtils } from '../../../test/test-utils';
import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';
import { RawMessage } from '../../../session/types/RawMessage';
import { PubKey } from '../../../session/types';
import * as Data from '../../../../js/modules/data';

describe('PendingMessageCache', () => {
  const sandbox = sinon.createSandbox();
  let pendingMessageCacheStub: PendingMessageCache;

  // tslint:disable-next-line: promise-function-async
  const wrapInPromise = (value: any) =>
    new Promise(resolve => {
      resolve(value);
    });

  beforeEach(async () => {

    // Stub out methods which touch the database
    const storageID = 'pendingMessages';
    let data: Data.StorageItem = {
      id: storageID,
      value: '',
    };

    TestUtils.stubData('getItemById').withArgs('pendingMessages').callsFake(async () => {
      return wrapInPromise(data);
    });

    TestUtils.stubData('createOrUpdateItem').callsFake((item: Data.StorageItem) => {
      data = item;
    });

    // Initialize new stubbed cache
    pendingMessageCacheStub = new PendingMessageCache();
    await pendingMessageCacheStub.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('can initialize cache', async () => {
    const { cache } = pendingMessageCacheStub;

    // We expect the cache to initialise as an empty array
    expect(cache).to.be.instanceOf(Array);
    expect(cache).to.have.length(0);
  });

  it('can add to cache', async () => {
    const device = PubKey.generateFake();
    const message = MessageUtils.generateUniqueChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);

    // Verify that the message is in the cache
    const finalCache = pendingMessageCacheStub.cache;

    expect(finalCache).to.have.length(1);

    const addedMessage = finalCache[0];
    expect(addedMessage.device).to.deep.equal(rawMessage.device);
    expect(addedMessage.timestamp).to.deep.equal(rawMessage.timestamp);
  });

  it('can remove from cache', async () => {
    const device = PubKey.generateFake();
    const message = MessageUtils.generateUniqueChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);

    const initialCache = pendingMessageCacheStub.cache;
    expect(initialCache).to.have.length(1);

    // Remove the message
    await pendingMessageCacheStub.remove(rawMessage);

    const finalCache = pendingMessageCacheStub.cache;

    // Verify that the message was removed
    expect(finalCache).to.have.length(0);
  });

  it('can get devices', async () => {
    const cacheItems = [
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
    ];

    cacheItems.forEach(async item => {
      await pendingMessageCacheStub.add(item.device, item.message);
    });

    const { cache } = pendingMessageCacheStub;
    expect(cache).to.have.length(cacheItems.length);

    // Get list of devices
    const devicesKeys = cacheItems.map(item => item.device.key);
    const pulledDevices = pendingMessageCacheStub.getDevices();
    const pulledDevicesKeys = pulledDevices.map(d => d.key);

    // Verify that device list from cache is equivalent to devices added
    expect(pulledDevicesKeys).to.have.members(devicesKeys);
  });

  it('can get pending for device', async () => {
    const cacheItems = [
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
    ];

    cacheItems.forEach(async item => {
      await pendingMessageCacheStub.add(item.device, item.message);
    });

    const initialCache = pendingMessageCacheStub.cache;
    expect(initialCache).to.have.length(cacheItems.length);

    // Get pending for each specific device
    cacheItems.forEach(item => {
      const pendingForDevice = pendingMessageCacheStub.getForDevice(
        item.device
      );
      expect(pendingForDevice).to.have.length(1);
      expect(pendingForDevice[0].device).to.equal(item.device.key);
    });
  });

  it('can find nothing when empty', async () => {
    const device = PubKey.generateFake();
    const message = MessageUtils.generateUniqueChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);

    const foundMessage = pendingMessageCacheStub.find(rawMessage);
    expect(foundMessage, 'a message was found in empty cache').to.be.undefined;
  });

  it('can find message in cache', async () => {
    const device = PubKey.generateFake();
    const message = MessageUtils.generateUniqueChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);

    await pendingMessageCacheStub.add(device, message);

    const finalCache = pendingMessageCacheStub.cache;
    expect(finalCache).to.have.length(1);

    const foundMessage = pendingMessageCacheStub.find(rawMessage);
    expect(foundMessage, 'message not found in cache').to.be.ok;
    foundMessage && expect(foundMessage.device).to.equal(device.key);
  });

  it('can clear cache', async () => {
    const cacheItems = [
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
      {
        device: PubKey.generateFake(),
        message: MessageUtils.generateUniqueChatMessage(),
      },
    ];

    cacheItems.forEach(async item => {
      await pendingMessageCacheStub.add(item.device, item.message);
    });

    const initialCache = pendingMessageCacheStub.cache;
    expect(initialCache).to.have.length(cacheItems.length);

    // Clear cache
    await pendingMessageCacheStub.clear();

    const finalCache = pendingMessageCacheStub.cache;
    expect(finalCache).to.have.length(0);
  });
});
