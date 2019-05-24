const { assert } = require('chai');
const LokiP2pAPI = require('../../../js/modules/loki_p2p_api');

describe('LokiP2pAPI', () => {
  const usedKey = 'aPubKey';
  const usedAddress = 'anAddress';
  const usedPort = 'aPort';

  const usedDetails = {
    address: usedAddress,
    port: usedPort,
    timerDuration: 100,
    pingTimer: null,
    isOnline: false,
  };

  beforeEach(() => {
    this.lokiP2pAPI = new LokiP2pAPI();
  });

  afterEach(() => {
    this.lokiP2pAPI.removeAllListeners();
    this.lokiP2pAPI.reset();
  });

  describe('getContactP2pDetails', () => {
    it('Should return null if no contact details exist', () => {
      const details = this.lokiP2pAPI.getContactP2pDetails(usedKey);
      assert.isNull(details);
    });

    it('Should return the exact same object if contact details exist', () => {
      this.lokiP2pAPI.contactP2pDetails[usedKey] = usedDetails;
      const details = this.lokiP2pAPI.getContactP2pDetails(usedKey);
      assert.deepEqual(details, usedDetails);
    });
  });

  describe('pingContact', () => {
    it("Should not emit a pingContact event if that contact doesn't exits", () => {
      this.lokiP2pAPI.on('pingContact', () => {
        assert.fail();
      });
      this.lokiP2pAPI.pingContact('not stored');
    });
  });

  describe('updateContactP2pDetails', () => {
    it("Shouldn't ping a contact if contact exists, p2p message was sent, contact was online and details didn't change", () => {
      this.lokiP2pAPI.on('pingContact', () => {
        assert.fail();
      });

      // contact exists
      const details = { ...usedDetails };
      // P2p message
      const isP2P = true;
      // Contact was online
      details.isOnline = true;
      // details were the same
      const { address, port } = details;

      this.lokiP2pAPI.contactP2pDetails[usedKey] = details;
      this.lokiP2pAPI.updateContactP2pDetails(usedKey, address, port, isP2P);

      // They should also be marked as online
      assert.isTrue(this.lokiP2pAPI.isOnline(usedKey));
    });

    it("Should ping a contact if we don't have details for it", done => {
      this.lokiP2pAPI.on('pingContact', pubKey => {
        assert.strictEqual(pubKey, usedKey);
        assert.isFalse(this.lokiP2pAPI.isContactOnline(usedKey));
        done();
      });
      this.lokiP2pAPI.updateContactP2pDetails(
        usedKey,
        usedAddress,
        usedPort,
        true
      );
    });

    it("Should ping a contact if a P2P message wasn't received", done => {
      // The precondition for this is that we had the contact stored
      this.lokiP2pAPI.contactP2pDetails[usedKey] = { ...usedDetails };

      this.lokiP2pAPI.on('pingContact', pubKey => {
        assert.strictEqual(pubKey, usedKey);
        assert.isFalse(this.lokiP2pAPI.isContactOnline(usedKey));
        done();
      });
      this.lokiP2pAPI.updateContactP2pDetails(
        usedKey,
        usedAddress,
        usedPort,
        false // We didn't get a p2p message
      );
    });

    it('Should ping a contact if they were marked as offline', done => {
      // The precondition for this is that we had the contact stored
      // And that p2p message was true
      this.lokiP2pAPI.contactP2pDetails[usedKey] = { ...usedDetails };

      this.lokiP2pAPI.on('pingContact', pubKey => {
        assert.strictEqual(pubKey, usedKey);
        assert.isFalse(this.lokiP2pAPI.isContactOnline(usedKey));
        done();
      });
      this.lokiP2pAPI.updateContactP2pDetails(
        usedKey,
        usedAddress,
        usedPort,
        true // We got a p2p message
      );
    });

    it('Should ping a contact if the address was different', done => {
      // The precondition for this is that we had the contact stored
      // And that p2p message was true
      // And that the user was online
      this.lokiP2pAPI.contactP2pDetails[usedKey] = { ...usedDetails };
      this.lokiP2pAPI.contactP2pDetails[usedKey].isOnline = true;

      this.lokiP2pAPI.on('pingContact', pubKey => {
        assert.strictEqual(pubKey, usedKey);
        done();
      });
      this.lokiP2pAPI.updateContactP2pDetails(
        usedKey,
        'different address',
        usedPort,
        true // We got a p2p message
      );
    });

    it('Should ping a contact if the port was different', done => {
      // The precondition for this is that we had the contact stored
      // And that p2p message was true
      // And that the user was online
      this.lokiP2pAPI.contactP2pDetails[usedKey] = { ...usedDetails };
      this.lokiP2pAPI.contactP2pDetails[usedKey].isOnline = true;

      this.lokiP2pAPI.on('pingContact', pubKey => {
        assert.strictEqual(pubKey, usedKey);
        done();
      });
      this.lokiP2pAPI.updateContactP2pDetails(
        usedKey,
        usedAddress,
        'different port',
        true // We got a p2p message
      );
    });

    it('Should emit an online event if the contact is online', done => {
      this.lokiP2pAPI.on('online', pubKey => {
        assert.strictEqual(pubKey, usedKey);
        done();
      });
      this.lokiP2pAPI.contactP2pDetails[usedKey] = { ...usedDetails };
      this.lokiP2pAPI.setContactOnline(usedKey);
    }).timeout(1000);

    it('Should store a contacts p2p details', () => {
      this.lokiP2pAPI.updateContactP2pDetails(
        usedKey,
        usedAddress,
        usedPort,
        true
      );
      const p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
      assert.strictEqual(usedAddress, p2pDetails.address);
      assert.strictEqual(usedPort, p2pDetails.port);
    });

    it('Should set a contact as offline and online', () => {
      this.lokiP2pAPI.contactP2pDetails[usedKey] = { ...usedDetails };
      let p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
      assert.isNotNull(p2pDetails);
      assert.isFalse(p2pDetails.isOnline);
      this.lokiP2pAPI.setContactOnline(usedKey);

      p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
      assert.isTrue(p2pDetails.isOnline);
      this.lokiP2pAPI.setContactOffline(usedKey);

      p2pDetails = this.lokiP2pAPI.getContactP2pDetails(usedKey);
      assert.isFalse(p2pDetails.isOnline);
    });
  });
});
