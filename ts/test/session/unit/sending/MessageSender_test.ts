import { expect } from 'chai';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import { toNumber } from 'lodash';
import { LokiMessageApi, MessageSender } from '../../../../session/sending';
import { TestUtils } from '../../../test-utils';
import { MessageEncrypter } from '../../../../session/crypto';
import { SignalService } from '../../../../protobuf';
import { EncryptionType } from '../../../../session/types/EncryptionType';
import { PubKey } from '../../../../session/types';
import { UserUtils } from '../../../../session/utils';
import { ApiV2 } from '../../../../opengroup/opengroupV2';

describe('MessageSender', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  // tslint:disable-next-line: max-func-body-length
  describe('send', () => {
    const ourNumber = '0123456789abcdef';
    let lokiMessageAPISendStub: sinon.SinonStub<any>;
    let encryptStub: sinon.SinonStub<[PubKey, Uint8Array, EncryptionType]>;

    beforeEach(() => {
      lokiMessageAPISendStub = sandbox.stub(LokiMessageApi, 'sendMessage').resolves();

      encryptStub = sandbox.stub(MessageEncrypter, 'encrypt').resolves({
        envelopeType: SignalService.Envelope.Type.SESSION_MESSAGE,
        cipherText: crypto.randomBytes(10),
      });

      sandbox.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    });

    describe('retry', () => {
      const rawMessage = {
        identifier: '1',
        device: TestUtils.generateFakePubKey().key,
        plainTextBuffer: crypto.randomBytes(10),
        encryption: EncryptionType.Fallback,
        timestamp: Date.now(),
        ttl: 100,
      };

      it('should not retry if an error occurred during encryption', async () => {
        encryptStub.throws(new Error('Failed to encrypt.'));
        const promise = MessageSender.send(rawMessage);
        await expect(promise).is.rejectedWith('Failed to encrypt.');
        expect(lokiMessageAPISendStub.callCount).to.equal(0);
      });

      it('should only call lokiMessageAPI once if no errors occured', async () => {
        await MessageSender.send(rawMessage);
        expect(lokiMessageAPISendStub.callCount).to.equal(1);
      });

      it('should only retry the specified amount of times before throwing', async () => {
        // const clock = sinon.useFakeTimers();

        lokiMessageAPISendStub.throws(new Error('API error'));
        const attempts = 2;
        const promise = MessageSender.send(rawMessage, attempts, 10);
        await expect(promise).is.rejectedWith('API error');
        // clock.restore();
        expect(lokiMessageAPISendStub.callCount).to.equal(attempts);
      });

      it('should not throw error if successful send occurs within the retry limit', async () => {
        lokiMessageAPISendStub.onFirstCall().throws(new Error('API error'));
        await MessageSender.send(rawMessage, 3, 10);
        expect(lokiMessageAPISendStub.callCount).to.equal(2);
      });
    });

    describe('logic', () => {
      let messageEncyrptReturnEnvelopeType = SignalService.Envelope.Type.SESSION_MESSAGE;

      beforeEach(() => {
        encryptStub.callsFake(async (_device, plainTextBuffer, _type) => ({
          envelopeType: messageEncyrptReturnEnvelopeType,
          cipherText: plainTextBuffer,
        }));
      });

      it('should pass the correct values to lokiMessageAPI', async () => {
        const device = TestUtils.generateFakePubKey().key;
        const timestamp = Date.now();
        const ttl = 100;

        await MessageSender.send({
          identifier: '1',
          device,
          plainTextBuffer: crypto.randomBytes(10),
          encryption: EncryptionType.Fallback,
          timestamp,
          ttl,
        });

        const args = lokiMessageAPISendStub.getCall(0).args;
        expect(args[0]).to.equal(device);
        expect(args[2]).to.equal(timestamp);
        expect(args[3]).to.equal(ttl);
      });

      it('should correctly build the envelope', async () => {
        messageEncyrptReturnEnvelopeType = SignalService.Envelope.Type.SESSION_MESSAGE;

        // This test assumes the encryption stub returns the plainText passed into it.
        const device = TestUtils.generateFakePubKey().key;
        const plainTextBuffer = crypto.randomBytes(10);
        const timestamp = Date.now();

        await MessageSender.send({
          identifier: '1',
          device,
          plainTextBuffer,
          encryption: EncryptionType.Fallback,
          timestamp,
          ttl: 1,
        });

        const data = lokiMessageAPISendStub.getCall(0).args[1];
        const webSocketMessage = SignalService.WebSocketMessage.decode(data);
        expect(webSocketMessage.request?.body).to.not.equal(
          undefined,
          'Request body should not be undefined'
        );
        expect(webSocketMessage.request?.body).to.not.equal(
          null,
          'Request body should not be null'
        );

        const envelope = SignalService.Envelope.decode(
          webSocketMessage.request?.body as Uint8Array
        );
        expect(envelope.type).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
        expect(envelope.source).to.equal('');
        expect(toNumber(envelope.timestamp)).to.equal(timestamp);
        expect(envelope.content).to.deep.equal(plainTextBuffer);
      });

      describe('SESSION_MESSAGE', () => {
        it('should set the envelope source to be empty', async () => {
          messageEncyrptReturnEnvelopeType = SignalService.Envelope.Type.SESSION_MESSAGE;

          // This test assumes the encryption stub returns the plainText passed into it.
          const device = TestUtils.generateFakePubKey().key;
          const plainTextBuffer = crypto.randomBytes(10);
          const timestamp = Date.now();

          await MessageSender.send({
            identifier: '1',
            device,
            plainTextBuffer,
            encryption: EncryptionType.Fallback,
            timestamp,
            ttl: 1,
          });

          const data = lokiMessageAPISendStub.getCall(0).args[1];
          const webSocketMessage = SignalService.WebSocketMessage.decode(data);
          expect(webSocketMessage.request?.body).to.not.equal(
            undefined,
            'Request body should not be undefined'
          );
          expect(webSocketMessage.request?.body).to.not.equal(
            null,
            'Request body should not be null'
          );

          const envelope = SignalService.Envelope.decode(
            webSocketMessage.request?.body as Uint8Array
          );
          expect(envelope.type).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
          expect(envelope.source).to.equal(
            '',
            'envelope source should be empty in SESSION_MESSAGE'
          );
        });
      });
    });
  });

  describe('sendToOpenGroupV2', () => {
    const sandbox2 = sinon.createSandbox();
    let postMessageRetryableStub: sinon.SinonStub;
    beforeEach(() => {
      sandbox
        .stub(UserUtils, 'getOurPubKeyStrFromCache')
        .resolves(TestUtils.generateFakePubKey().key);

      postMessageRetryableStub = sandbox
        .stub(ApiV2, 'postMessageRetryable')
        .resolves(TestUtils.generateOpenGroupMessageV2());
    });

    afterEach(() => {
      sandbox2.restore();
    });

    it('should call postMessageRetryableStub', async () => {
      const message = TestUtils.generateOpenGroupVisibleMessage();
      const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();

      await MessageSender.sendToOpenGroupV2(message, roomInfos);
      expect(postMessageRetryableStub.callCount).to.eq(1);
    });

    it('should retry postMessageRetryableStub ', async () => {
      const message = TestUtils.generateOpenGroupVisibleMessage();
      const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();

      postMessageRetryableStub.throws('whate');
      sandbox2.stub(ApiV2, 'getMinTimeout').returns(2);

      postMessageRetryableStub.onThirdCall().resolves();
      await MessageSender.sendToOpenGroupV2(message, roomInfos);
      expect(postMessageRetryableStub.callCount).to.eq(3);
    });

    it('should not retry more than 3 postMessageRetryableStub ', async () => {
      const message = TestUtils.generateOpenGroupVisibleMessage();
      const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();
      sandbox2.stub(ApiV2, 'getMinTimeout').returns(2);
      postMessageRetryableStub.throws('fake error');
      postMessageRetryableStub.onCall(4).resolves();
      try {
        await MessageSender.sendToOpenGroupV2(message, roomInfos);
        throw new Error('Error expected');
      } catch (e) {
        expect(e.name).to.eq('fake error');
      }
      expect(postMessageRetryableStub.calledThrice);
    });
  });
});
