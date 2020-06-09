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

describe('MessageSender', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  describe('send', () => {
    const ourNumber = 'ourNumber';
    let lokiMessageAPIStub: sinon.SinonStubbedInstance<LokiMessageAPI>;
    let stubEnvelopeType = SignalService.Envelope.Type.CIPHERTEXT;

    beforeEach(() => {
      // We can do this because LokiMessageAPI has a module export in it
      lokiMessageAPIStub = sandbox.createStubInstance(LokiMessageAPI, {
        sendMessage: sandbox.stub(),
      });
      TestUtils.stubWindow('lokiMessageAPI', lokiMessageAPIStub);

      sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
      sandbox
        .stub(MessageEncrypter, 'encrypt')
        .callsFake(async (_device, plainTextBuffer, _type) => ({
          envelopeType: stubEnvelopeType,
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
        encryption: 0,
        timestamp,
        ttl,
      });

      const args = lokiMessageAPIStub.sendMessage.getCall(0).args;
      expect(args[0]).to.equal(device);
      expect(args[2]).to.equal(timestamp);
      expect(args[3]).to.equal(ttl);
    });

    it('should correctly build the envelope', async () => {
      stubEnvelopeType = SignalService.Envelope.Type.CIPHERTEXT;

      // This test assumes the encryption stub returns the plainText passed into it.
      const plainTextBuffer = crypto.randomBytes(10);
      const timestamp = Date.now();

      await MessageSender.send({
        identifier: '1',
        device: '0',
        plainTextBuffer,
        encryption: 0,
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
        stubEnvelopeType = SignalService.Envelope.Type.UNIDENTIFIED_SENDER;

        // This test assumes the encryption stub returns the plainText passed into it.
        const plainTextBuffer = crypto.randomBytes(10);
        const timestamp = Date.now();

        await MessageSender.send({
          identifier: '1',
          device: '0',
          plainTextBuffer,
          encryption: 0,
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
          'envelope source should not exist in UNIDENTIFIED_SENDER'
        );
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
