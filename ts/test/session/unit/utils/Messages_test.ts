import chai from 'chai';
import * as sinon from 'sinon';
import crypto from 'crypto';
import { TestUtils } from '../../../test-utils';
import { MessageUtils } from '../../../../session/utils';
import { EncryptionType, PubKey } from '../../../../session/types';
import { SessionProtocol } from '../../../../session/protocols';
import {
  MediumGroupChatMessage,
  SessionRequestMessage,
} from '../../../../session/messages/outgoing';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Message Utils', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('toRawMessage', () => {
    let hasSessionStub: sinon.SinonStub<[PubKey], Promise<boolean>>;

    beforeEach(() => {
      hasSessionStub = sandbox
        .stub(SessionProtocol, 'hasSession')
        .resolves(true);
    });

    it('can convert to raw message', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message);

      expect(Object.keys(rawMessage)).to.have.length(6);
      expect(rawMessage.identifier).to.exist;
      expect(rawMessage.device).to.exist;
      expect(rawMessage.encryption).to.exist;
      expect(rawMessage.plainTextBuffer).to.exist;
      expect(rawMessage.timestamp).to.exist;
      expect(rawMessage.ttl).to.exist;

      expect(rawMessage.identifier).to.equal(message.identifier);
      expect(rawMessage.device).to.equal(device.key);
      expect(rawMessage.plainTextBuffer).to.deep.equal(
        message.plainTextBuffer()
      );
      expect(rawMessage.timestamp).to.equal(message.timestamp);
      expect(rawMessage.ttl).to.equal(message.ttl());
    });

    it('should generate valid plainTextBuffer', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message);

      const rawBuffer = rawMessage.plainTextBuffer;
      const rawBufferJSON = JSON.stringify(rawBuffer);
      const messageBufferJSON = JSON.stringify(message.plainTextBuffer());

      expect(rawBuffer instanceof Uint8Array).to.equal(
        true,
        'raw message did not contain a plainTextBuffer'
      );
      expect(rawBufferJSON).to.equal(
        messageBufferJSON,
        'plainTextBuffer was not converted correctly'
      );
    });

    it('should maintain pubkey', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message);
      const derivedPubKey = PubKey.from(rawMessage.device);

      expect(derivedPubKey).to.exist;
      expect(derivedPubKey?.isEqual(device)).to.equal(
        true,
        'pubkey of message was not converted correctly'
      );
    });

    it('should set encryption to MediumGroup if a MediumGroupMessage is passed in', async () => {
      hasSessionStub.resolves(true);

      const device = TestUtils.generateFakePubKey();
      const groupId = TestUtils.generateFakePubKey();
      const chatMessage = TestUtils.generateChatMessage();
      const message = new MediumGroupChatMessage({ chatMessage, groupId });

      const rawMessage = await MessageUtils.toRawMessage(device, message);
      expect(rawMessage.encryption).to.equal(EncryptionType.MediumGroup);
    });

    it('should set encryption to Fallback if a SessionRequestMessage is passed in', async () => {
      hasSessionStub.resolves(true);

      const device = TestUtils.generateFakePubKey();
      const preKeyBundle = {
        deviceId: 123456,
        preKeyId: 654321,
        signedKeyId: 111111,
        preKey: crypto.randomBytes(16),
        signature: crypto.randomBytes(16),
        signedKey: crypto.randomBytes(16),
        identityKey: crypto.randomBytes(16),
      };
      const sessionRequest = new SessionRequestMessage({
        timestamp: Date.now(),
        preKeyBundle,
      });

      const rawMessage = await MessageUtils.toRawMessage(
        device,
        sessionRequest
      );

      expect(rawMessage.encryption).to.equal(EncryptionType.Fallback);
    });

    it('should set encryption to Fallback on other messages if we do not have a session', async () => {
      hasSessionStub.resolves(false);

      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();
      const rawMessage = await MessageUtils.toRawMessage(device, message);

      expect(rawMessage.encryption).to.equal(EncryptionType.Fallback);
    });

    it('should set encryption to Signal on other messages if we have a session', async () => {
      hasSessionStub.resolves(true);

      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();
      const rawMessage = await MessageUtils.toRawMessage(device, message);

      expect(rawMessage.encryption).to.equal(EncryptionType.Signal);
    });
  });
});
