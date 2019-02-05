const { assert } = require('chai');
const LokiP2pAPI = require('../../../js/modules/loki_p2p_api');

describe('LocalLokiServer', () => {
  const usedKey = 'aPubKey';
  const usedAddress = 'anAddress';
  const usedPort = 'aPort';

  beforeEach(() => {
    this.lokiP2pAPI = new LokiP2pAPI();
  });

  afterEach(() => {
    this.lokiP2pAPI.reset();
  });

  it("Should not emit a pingContact event if that contact doesn't exits", async () => {
    this.lokiP2pAPI.on('pingContact', () => {
      assert.fail();
    });
    this.lokiP2pAPI.pingContact('not stored');
  });

  it('Should emit an online event if the contact is online', async () => {
    let promise;
    const timer = setTimeout(() => {
      promise = Promise.resolve();
    }, 5000);
    this.lokiP2pAPI.on('online', pubKey => {
      clearTimeout(timer);
      promise = Promise.resolve(pubKey);
    });
    this.lokiP2pAPI.updateContactP2pDetails(
      usedKey,
      usedAddress,
      usedPort,
      true
    );
    assert.strictEqual(await promise, usedKey);
  });

  it("Should send a pingContact event if the contact isn't online", async () => {
    let promise;
    const timer = setTimeout(() => {
      promise = Promise.resolve();
    }, 5000);
    this.lokiP2pAPI.on('pingContact', (pubKey, forceP2p) => {
      assert.isTrue(forceP2p);
      clearTimeout(timer);
      promise = Promise.resolve(pubKey);
    });
    this.lokiP2pAPI.updateContactP2pDetails(
      usedKey,
      usedAddress,
      usedPort,
      false
    );
    assert.strictEqual(await promise, usedKey);
  });

  it('Should store a contacts p2p details', async () => {
    let promise;
    const timer = setTimeout(() => {
      promise = Promise.resolve();
    }, 5000);
    this.lokiP2pAPI.on('online', pubKey => {
      clearTimeout(timer);
      promise = Promise.resolve(pubKey);
    });
    this.lokiP2pAPI.updateContactP2pDetails(
      usedKey,
      usedAddress,
      usedPort,
      true
    );
    await promise;
    const p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
    assert.strictEqual(usedAddress, p2pDetails.address);
    assert.strictEqual(usedPort, p2pDetails.port);
  });

  it('Should say if a contact is online', async () => {
    this.lokiP2pAPI.updateContactP2pDetails(
      usedKey,
      usedAddress,
      usedPort,
      true
    );
    assert.isTrue(this.lokiP2pAPI.isOnline(usedKey));
    this.lokiP2pAPI.updateContactP2pDetails(
      usedKey,
      usedAddress,
      usedPort,
      false
    );
    assert.isFalse(this.lokiP2pAPI.isOnline(usedKey));
  });

  it('Should set a contact as offline', async () => {
    this.lokiP2pAPI.updateContactP2pDetails(
      usedKey,
      usedAddress,
      usedPort,
      true
    );
    let p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
    assert.isTrue(p2pDetails.isOnline);
    p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
    this.lokiP2pAPI.setContactOffline(usedKey);
    assert.isFalse(p2pDetails.isOnline);
  });
});
