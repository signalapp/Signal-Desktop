import { expect } from 'chai';
import { SessionProtocol } from '../../../session/protocols';
import * as sinon from 'sinon';
import { Stubs, TestUtils } from '../../test-utils';
import { UserUtil } from '../../../util';
import { SessionRequestMessage } from '../../../session/messages/outgoing';
import { TextEncoder } from 'util';
import { MessageSender } from '../../../session/sending';
import { PubKey } from '../../../session/types';

// tslint:disable-next-line: max-func-body-length
describe('SessionProtocol', () => {
  const sandbox = sinon.createSandbox();
  const ourNumber = TestUtils.generateFakePubKey();
  const pubkey = TestUtils.generateFakePubKey();
  let getItemById: sinon.SinonStub;
  let send: sinon.SinonStub;

  const resetMessage: SessionRequestMessage = new SessionRequestMessage({
    timestamp: Date.now(),
    preKeyBundle: {
      identityKey: new TextEncoder().encode('identityKey'),
      deviceId: 1,
      preKeyId: 2,
      signedKeyId: 3,
      preKey: new TextEncoder().encode('preKey'),
      signedKey: new TextEncoder().encode('signedKey'),
      signature: new TextEncoder().encode('signature'),
    },
  });

  beforeEach(() => {
    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherStub,
    } as any);

    TestUtils.stubWindow('libloki', {
      storage: {
        getPreKeyBundleForContact: sandbox.stub(),
      },
    });

    TestUtils.stubWindow('textsecure', {
      storage: {
        protocol: sandbox.stub(),
      },
    });

    TestUtils.stubData('createOrUpdateItem');

    getItemById = TestUtils.stubData('getItemById').resolves({ value: {} });

    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber.key);
    send = sandbox.stub(MessageSender, 'send' as any);
    SessionProtocol.reset();
  });

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  describe('db fetch', () => {
    it('protocol: should fetch from DB `sentSessionsTimestamp` and `processedSessionsTimestamp`', async () => {
      await SessionProtocol.hasSentSessionRequest(pubkey);
      expect(getItemById.calledWith('sentSessionsTimestamp'));
      expect(getItemById.calledWith('processedSessionsTimestamp'));
      expect(getItemById.callCount).to.equal(2);
    });

    it('protocol: should fetch only once', async () => {
      await SessionProtocol.hasSentSessionRequest(pubkey);
      await SessionProtocol.hasSentSessionRequest(pubkey);
      await SessionProtocol.hasSentSessionRequest(pubkey);
      await SessionProtocol.hasSentSessionRequest(pubkey);
      expect(getItemById.calledWith('sentSessionsTimestamp'));
      expect(getItemById.calledWith('processedSessionsTimestamp'));
      expect(getItemById.callCount).to.equal(2);
    });
  });

  describe('sendSessionRequest', () => {
    beforeEach(async () => {
      // trigger a sessionReset
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey);
    });

    it('protocol: sendSessionRequest should add the deviceID to the sentMap', async () => {
      expect(SessionProtocol.getSentSessionsTimestamp())
        .to.have.property(pubkey.key)
        .to.be.approximately(Date.now(), 100);
    });

    it('protocol: sendSessionRequest should not have pendingSend set after', async () => {
      expect(
        SessionProtocol.getPendingSendSessionTimestamp()
      ).to.not.have.property(pubkey.key);
    });
  });

  describe('checkSessionRequestExpiry', () => {
    let clock: sinon.SinonFakeTimers;
    let now: number;
    let sendSessionRequestStub: sinon.SinonStub<
      [SessionRequestMessage, PubKey],
      Promise<void>
    >;
    beforeEach(() => {
      now = Date.now();
      clock = sandbox.useFakeTimers(now);

      sendSessionRequestStub = sandbox
        .stub(SessionProtocol, 'sendSessionRequest')
        .resolves();
    });

    it('should not send a session request if none have expired', async () => {
      getItemById.withArgs('sentSessionsTimestamp').resolves({
        id: 'sentSessionsTimestamp',
        value: {
          [pubkey.key]: now,
        },
      });

      // Set the time just before expiry
      clock.tick(SessionRequestMessage.getTTL() - 100);

      await SessionProtocol.checkSessionRequestExpiry();
      expect(getItemById.calledWith('sentSessionsTimestamp'));
      expect(sendSessionRequestStub.callCount).to.equal(0);
    });

    it('should send a session request if expired', async () => {
      getItemById.withArgs('sentSessionsTimestamp').resolves({
        id: 'sentSessionsTimestamp',
        value: {
          [pubkey.key]: now,
        },
      });

      // Expire the request
      clock.tick(SessionRequestMessage.getTTL() + 100);

      await SessionProtocol.checkSessionRequestExpiry();
      expect(getItemById.calledWith('sentSessionsTimestamp'));
      expect(sendSessionRequestStub.callCount).to.equal(1);
    });

    it('should remove the old sent timestamp when expired', async () => {
      getItemById.withArgs('sentSessionsTimestamp').resolves({
        id: 'sentSessionsTimestamp',
        value: {
          [pubkey.key]: now,
        },
      });

      // Remove this call from the equation
      sandbox.stub(SessionProtocol, 'sendSessionRequestIfNeeded').resolves();

      // Expire the request
      clock.tick(SessionRequestMessage.getTTL() + 100);

      await SessionProtocol.checkSessionRequestExpiry();
      expect(getItemById.calledWith('sentSessionsTimestamp'));
      expect(await SessionProtocol.hasSentSessionRequest(pubkey)).to.equal(
        false,
        'hasSentSessionRequest should return false.'
      );
      expect(SessionProtocol.getSentSessionsTimestamp()).to.not.have.property(
        pubkey.key
      );
    });
  });

  describe('onSessionEstablished', () => {
    beforeEach(async () => {
      // add an existing entry in the sentMap
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey);
    });

    it('protocol: onSessionEstablished should remove the device in sentTimestamps', async () => {
      expect(SessionProtocol.getSentSessionsTimestamp()).to.have.property(
        pubkey.key
      );
      await SessionProtocol.onSessionEstablished(pubkey);
      expect(SessionProtocol.getSentSessionsTimestamp()).to.not.have.property(
        pubkey.key
      );
    });

    it('protocol: onSessionEstablished should remove the device in sentTimestamps and ONLY that one', async () => {
      // add a second item to the map
      const anotherPubKey = TestUtils.generateFakePubKey();
      await SessionProtocol.sendSessionRequest(resetMessage, anotherPubKey);

      expect(SessionProtocol.getSentSessionsTimestamp()).to.have.property(
        pubkey.key
      );
      expect(SessionProtocol.getSentSessionsTimestamp()).to.have.property(
        anotherPubKey.key
      );

      await SessionProtocol.onSessionEstablished(pubkey);
      expect(SessionProtocol.getSentSessionsTimestamp()).to.not.have.property(
        pubkey.key
      );
      expect(SessionProtocol.getSentSessionsTimestamp()).to.have.property(
        anotherPubKey.key
      );
    });
  });

  describe('hasSentSessionRequest', () => {
    it('protocol: hasSentSessionRequest returns false if a message was not sent to that device', async () => {
      const hasSent = await SessionProtocol.hasSentSessionRequest(pubkey);
      expect(hasSent).to.be.equal(
        false,
        `hasSent should be false for ${pubkey.key}`
      );
    });

    it('protocol: hasSentSessionRequest returns true if a message is already sent for that device', async () => {
      // add an existing entry in the sentMap
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey);
      const hasSent = await SessionProtocol.hasSentSessionRequest(pubkey);
      expect(hasSent).to.be.equal(
        true,
        `hasSent should be true for ${pubkey.key}`
      );
    });

    // TODO add a test to validate that pending is filled when message is triggered and not yet sent
  });

  describe('sendSessionRequestIfNeeded', () => {
    it('protocol: sendSessionRequestIfNeeded should send a new sessionMessage ', async () => {
      // not called before, so the message reset sending should be triggered
      await SessionProtocol.sendSessionRequestIfNeeded(pubkey);
      expect(send.callCount).to.be.equal(
        1,
        'MessageSender.send() should have been called'
      );

      // check that the map is updated with that ID
      const hasSent = await SessionProtocol.hasSentSessionRequest(pubkey);
      expect(hasSent).to.be.equal(
        true,
        `hasSent should be true for ${pubkey.key}`
      );
    });

    it('protocol: sendSessionRequestIfNeeded should NOT send a new sessionMessage on second try ', async () => {
      await SessionProtocol.sendSessionRequestIfNeeded(pubkey);
      expect(send.callCount).to.be.equal(
        1,
        'MessageSender.send() should have been called'
      );

      // check that the map is updated with that ID
      const hasSent = await SessionProtocol.hasSentSessionRequest(pubkey);
      expect(hasSent).to.be.equal(
        true,
        `hasSent should be true for ${pubkey.key}`
      );
      send.resetHistory();

      // trigger a second call, Message.send().calledCount should still be 1
      await SessionProtocol.sendSessionRequestIfNeeded(pubkey);
      expect(send.callCount).to.be.equal(
        0,
        'MessageSender.send() should NOT have been called a second time'
      );
    });
  });

  describe('onSessionRequestProcessed', () => {
    it('protocol: onSessionRequestProcessed should insert a new item in the processedMap ', async () => {
      // trigger the requestProcessed and check the map is updated
      await SessionProtocol.onSessionRequestProcessed(pubkey);
      expect(SessionProtocol.getProcessedSessionsTimestamp())
        .to.have.property(pubkey.key)
        .to.be.approximately(Date.now(), 5);
    });

    it('protocol: onSessionRequestProcessed should update an existing item in the processedMap ', async () => {
      // trigger the requestProcessed and check the map is updated
      // then trigger it a second time, and expect a change in the processed timestamp

      await SessionProtocol.onSessionRequestProcessed(pubkey);
      expect(SessionProtocol.getProcessedSessionsTimestamp())
        .to.have.property(pubkey.key)
        .to.be.approximately(Date.now(), 5);
      await TestUtils.timeout(5);
      const oldTimestamp = SessionProtocol.getProcessedSessionsTimestamp()[
        pubkey.key
      ];
      await SessionProtocol.onSessionRequestProcessed(pubkey);
      expect(SessionProtocol.getProcessedSessionsTimestamp())
        .to.have.property(pubkey.key)
        .to.be.approximately(Date.now(), 5)
        .to.not.be.equal(oldTimestamp);
    });
  });

  describe('shouldProcessSessionRequest', () => {
    it('protocol: shouldProcessSessionRequest returns true if timestamp is more recent than processed timestamp', async () => {
      await SessionProtocol.onSessionRequestProcessed(pubkey); // adds a Date.now() entry
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, Date.now() + 1000)
      ).to.be.eventually.equal(
        true,
        'shouldProcessSessionRequest should return true when existingProcessed is less recent'
      );
    });

    it('protocol: shouldProcessSessionRequest returns true if there is no processed timestamp yet for this device', async () => {
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, 100)
      ).to.be.eventually.equal(
        true,
        'shouldProcessSessionRequest should return false when existingProcessed is empty for this device'
      );
    });

    it('protocol: shouldProcessSessionRequest returns false if timestamp is less recent than current processed timestamp', async () => {
      await SessionProtocol.onSessionRequestProcessed(pubkey); // adds a Date.now() entry
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, 100)
      ).to.be.eventually.equal(
        false,
        'shouldProcessSessionRequest should return false when existingProcessed is more recent'
      );
    });

    it('protocol: shouldProcessSessionRequest returns false if timestamp is less recent than current sent timestamp', async () => {
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey); // adds a Date.now() entry
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, 100)
      ).to.be.eventually.equal(
        false,
        'shouldProcessSessionRequest should return false when existingSent is more recent'
      );
    });

    it('protocol: shouldProcessSessionRequest returns true if timestamp is more recent than current sent timestamp', async () => {
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey); // adds a Date.now() entry
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, Date.now() + 1000)
      ).to.be.eventually.equal(
        true,
        'shouldProcessSessionRequest should return true when existingSent is less recent'
      );
    });

    it('protocol: shouldProcessSessionRequest returns true if there is no sent timestamp', async () => {
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, 100)
      ).to.be.eventually.equal(
        true,
        'shouldProcessSessionRequest should return true as there is no sent timestamp'
      );
    });

    it('protocol: shouldProcessSessionRequest returns false if there is a more recent sent but a less recent processed', async () => {
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey); // adds a Date.now() entry
      await TestUtils.timeout(100);
      await SessionProtocol.onSessionRequestProcessed(pubkey); // adds a Date.now() entry 100ms after

      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, Date.now() - 50)
      ).to.be.eventually.equal(
        false,
        'shouldProcessSessionRequest should return false if there is a more recent sent but a less recent processed'
      );
    });

    it('protocol: shouldProcessSessionRequest returns false if there is a more recent processed but a less recent sent', async () => {
      await SessionProtocol.onSessionRequestProcessed(pubkey); // adds a Date.now() entry
      await TestUtils.timeout(100);
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey); // adds a Date.now() entry 100ms after

      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, Date.now() - 50)
      ).to.be.eventually.equal(
        false,
        'shouldProcessSessionRequest should return false if there is a more recent processed but a less recent sent'
      );
    });

    it('protocol: shouldProcessSessionRequest returns true if both sent and processed timestamp are older', async () => {
      await SessionProtocol.onSessionRequestProcessed(pubkey); // adds a Date.now() entry
      await SessionProtocol.sendSessionRequest(resetMessage, pubkey); // adds a Date.now() entry
      expect(
        SessionProtocol.shouldProcessSessionRequest(pubkey, Date.now() + 1000)
      ).to.be.eventually.equal(
        true,
        'shouldProcessSessionRequest should return true if there if both processed and sent are set but are older'
      );
    });
  });
});
