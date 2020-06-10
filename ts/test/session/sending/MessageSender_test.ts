import { expect } from 'chai';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import { toNumber } from 'lodash';
import { MessageSender } from '../../../session/sending';
import LokiMessageAPI from '../../../../js/modules/loki_message_api';
import { TestUtils } from '../../test-utils';
import { UserUtil } from '../../../util';
import { MessageEncrypter } from '../../../session/crypto';
import { SignalService } from '../../../protobuf';
import LokiPublicChatFactoryAPI from '../../../../js/modules/loki_public_chat_api';
import { OpenGroupMessage } from '../../../session/messages/outgoing';
import { LokiPublicChannelAPI } from '../../../../js/modules/loki_app_dot_net_api';
import { EncryptionType } from '../../../session/types/EncryptionType';

describe('MessageSender', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  describe('canSendToSnode', () => {
    it('should return the correct value', () => {
      const stub = TestUtils.stubWindow('lokiMessageAPI', undefined);
      expect(MessageSender.canSendToSnode()).to.equal(
        false,
        'We cannot send if lokiMessageAPI is not set'
      );
      stub.set(sandbox.createStubInstance(LokiMessageAPI));
      expect(MessageSender.canSendToSnode()).to.equal(
        true,
        'We can send if lokiMessageAPI is set'
      );
    });
  });

  describe('send', () => {
    const ourNumber = 'ourNumber';
    let lokiMessageAPIStub: sinon.SinonStubbedInstance<LokiMessageAPI>;
    let encryptStub: sinon.SinonStub<[string, Uint8Array, EncryptionType]>;

    beforeEach(() => {
      // We can do this because LokiMessageAPI has a module export in it
      lokiMessageAPIStub = sandbox.createStubInstance(LokiMessageAPI, {
        sendMessage: sandbox.stub(),
      });
      TestUtils.stubWindow('lokiMessageAPI', lokiMessageAPIStub);

      encryptStub = sandbox.stub(MessageEncrypter, 'encrypt').resolves({
        envelopeType: SignalService.Envelope.Type.CIPHERTEXT,
        cipherText: crypto.randomBytes(10),
      });

      sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
    });

    describe('retry', () => {
      const rawMessage = {
        identifier: '1',
        device: '0',
        plainTextBuffer: crypto.randomBytes(10),
        encryption: EncryptionType.Signal,
        timestamp: Date.now(),
        ttl: 100,
      };

      it('should not retry if an error occurred during encryption', async () => {
        encryptStub.throws(new Error('Failed to encrypt.'));
        const promise = MessageSender.send(rawMessage);
        await expect(promise).is.rejectedWith('Failed to encrypt.');
        expect(lokiMessageAPIStub.sendMessage.callCount).to.equal(0);
      });

      it('should only call lokiMessageAPI once if no errors occured', async () => {
        await MessageSender.send(rawMessage);
        expect(lokiMessageAPIStub.sendMessage.callCount).to.equal(1);
      });

      it('should only retry the specified amount of times before throwing', async () => {
        lokiMessageAPIStub.sendMessage.throws(new Error('API error'));
        const attempts = 2;
        const promise = MessageSender.send(rawMessage, attempts);
        await expect(promise).is.rejectedWith('API error');
        expect(lokiMessageAPIStub.sendMessage.callCount).to.equal(attempts);
      });

      it('should not throw error if successful send occurs within the retry limit', async () => {
        lokiMessageAPIStub.sendMessage
          .onFirstCall()
          .throws(new Error('API error'));
        await MessageSender.send(rawMessage, 3);
        expect(lokiMessageAPIStub.sendMessage.callCount).to.equal(2);
      });
    });

    describe('logic', () => {
      let messageEncyrptReturnEnvelopeType =
        SignalService.Envelope.Type.CIPHERTEXT;

      beforeEach(() => {
        encryptStub.callsFake(async (_device, plainTextBuffer, _type) => ({
          envelopeType: messageEncyrptReturnEnvelopeType,
          cipherText: plainTextBuffer,
        }));
      });

      it('should pass the correct values to lokiMessageAPI', async () => {
        const device = '0';
        const timestamp = Date.now();
        const ttl = 100;

        await MessageSender.send({
          identifier: '1',
          device,
          plainTextBuffer: crypto.randomBytes(10),
          encryption: EncryptionType.Signal,
          timestamp,
          ttl,
        });

        const args = lokiMessageAPIStub.sendMessage.getCall(0).args;
        expect(args[0]).to.equal(device);
        expect(args[2]).to.equal(timestamp);
        expect(args[3]).to.equal(ttl);
      });

      it('should correctly build the envelope', async () => {
        messageEncyrptReturnEnvelopeType =
          SignalService.Envelope.Type.CIPHERTEXT;

        // This test assumes the encryption stub returns the plainText passed into it.
        const plainTextBuffer = crypto.randomBytes(10);
        const timestamp = Date.now();

        await MessageSender.send({
          identifier: '1',
          device: '0',
          plainTextBuffer,
          encryption: EncryptionType.Signal,
          timestamp,
          ttl: 1,
        });

        const data = lokiMessageAPIStub.sendMessage.getCall(0).args[1];
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
        expect(envelope.type).to.equal(SignalService.Envelope.Type.CIPHERTEXT);
        expect(envelope.source).to.equal(ourNumber);
        expect(envelope.sourceDevice).to.equal(1);
        expect(toNumber(envelope.timestamp)).to.equal(timestamp);
        expect(envelope.content).to.deep.equal(plainTextBuffer);
      });

      describe('UNIDENTIFIED_SENDER', () => {
        it('should set the envelope source to be empty', async () => {
          messageEncyrptReturnEnvelopeType =
            SignalService.Envelope.Type.UNIDENTIFIED_SENDER;

          // This test assumes the encryption stub returns the plainText passed into it.
          const plainTextBuffer = crypto.randomBytes(10);
          const timestamp = Date.now();

          await MessageSender.send({
            identifier: '1',
            device: '0',
            plainTextBuffer,
            encryption: EncryptionType.Signal,
            timestamp,
            ttl: 1,
          });

          const data = lokiMessageAPIStub.sendMessage.getCall(0).args[1];
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
          expect(envelope.type).to.equal(
            SignalService.Envelope.Type.UNIDENTIFIED_SENDER
          );
          expect(envelope.source).to.equal(
            '',
            'envelope source should be empty in UNIDENTIFIED_SENDER'
          );
        });
      });
    });
  });

  describe('sendToOpenGroup', () => {
    it('should send the message to the correct server and channel', async () => {
      // We can do this because LokiPublicChatFactoryAPI has a module export in it
      const stub = sandbox.createStubInstance(LokiPublicChatFactoryAPI, {
        findOrCreateChannel: sandbox.stub().resolves({
          sendMessage: sandbox.stub(),
        } as LokiPublicChannelAPI) as any,
      });
      TestUtils.stubWindow('lokiPublicChatAPI', stub);

      const group = {
        server: 'server',
        channel: 1,
        conversationId: '0',
      };

      const message = new OpenGroupMessage({
        timestamp: Date.now(),
        group,
      });

      await MessageSender.sendToOpenGroup(message);

      const [
        server,
        channel,
        conversationId,
      ] = stub.findOrCreateChannel.getCall(0).args;
      expect(server).to.equal(group.server);
      expect(channel).to.equal(group.channel);
      expect(conversationId).to.equal(group.conversationId);
    });
  });
});
