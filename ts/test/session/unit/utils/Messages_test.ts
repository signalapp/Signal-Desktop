// tslint:disable: no-implicit-dependencies

import chai from 'chai';
import { TestUtils } from '../../../test-utils';
import { MessageUtils, UserUtils } from '../../../../session/utils';
import { PubKey } from '../../../../session/types';
import { ClosedGroupVisibleMessage } from '../../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { ConfigurationMessage } from '../../../../session/messages/outgoing/controlMessage/ConfigurationMessage';

import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);
import { ClosedGroupEncryptionPairReplyMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairReplyMessage';
import { SignalService } from '../../../../protobuf';
import { ClosedGroupAddedMembersMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupNameChangeMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';
import { ClosedGroupNewMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import Sinon from 'sinon';

const { expect } = chai;

describe('Message Utils', () => {
  afterEach(() => {
    Sinon.restore();
  });

  // tslint:disable-next-line: max-func-body-length
  describe('toRawMessage', () => {
    it('can convert to raw message', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message);

      expect(Object.keys(rawMessage)).to.have.length(5);
      expect(rawMessage.identifier).to.exist;
      expect(rawMessage.device).to.exist;
      expect(rawMessage.encryption).to.exist;
      expect(rawMessage.plainTextBuffer).to.exist;
      expect(rawMessage.ttl).to.exist;

      expect(rawMessage.identifier).to.equal(message.identifier);
      expect(rawMessage.device).to.equal(device.key);
      expect(rawMessage.plainTextBuffer).to.deep.equal(message.plainTextBuffer());
      expect(rawMessage.ttl).to.equal(message.ttl());
    });

    it('should generate valid plainTextBuffer', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

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
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message);
      const derivedPubKey = PubKey.from(rawMessage.device);

      expect(derivedPubKey).to.not.be.eq(undefined, 'should maintain pubkey');
      expect(derivedPubKey?.isEqual(device)).to.equal(
        true,
        'pubkey of message was not converted correctly'
      );
    });

    it('should set encryption to ClosedGroup if a ClosedGroupVisibleMessage is passed in', async () => {
      const device = TestUtils.generateFakePubKey();
      const groupId = TestUtils.generateFakePubKey();
      const chatMessage = TestUtils.generateVisibleMessage();
      const message = new ClosedGroupVisibleMessage({ chatMessage, groupId });

      const rawMessage = await MessageUtils.toRawMessage(device, message);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('should set encryption to Fallback on other messages', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();
      const rawMessage = await MessageUtils.toRawMessage(device, message);

      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });

    it('passing ClosedGroupNewMessage returns Fallback', async () => {
      const device = TestUtils.generateFakePubKey();
      const member = TestUtils.generateFakePubKey().key;

      const msg = new ClosedGroupNewMessage({
        timestamp: Date.now(),
        name: 'df',
        members: [member],
        admins: [member],
        groupId: TestUtils.generateFakePubKey().key,
        keypair: TestUtils.generateFakeECKeyPair(),
        expireTimer: 0,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });

    it('passing ClosedGroupNameChangeMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ClosedGroupNameChangeMessage({
        timestamp: Date.now(),
        name: 'df',
        groupId: TestUtils.generateFakePubKey().key,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupAddedMembersMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ClosedGroupAddedMembersMessage({
        timestamp: Date.now(),
        addedMembers: [TestUtils.generateFakePubKey().key],
        groupId: TestUtils.generateFakePubKey().key,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupRemovedMembersMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ClosedGroupRemovedMembersMessage({
        timestamp: Date.now(),
        removedMembers: [TestUtils.generateFakePubKey().key],
        groupId: TestUtils.generateFakePubKey().key,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupEncryptionPairMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const fakeWrappers = new Array<
        SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper
      >();
      fakeWrappers.push(
        new SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper({
          publicKey: new Uint8Array(8),
          encryptedKeyPair: new Uint8Array(8),
        })
      );
      const msg = new ClosedGroupEncryptionPairMessage({
        timestamp: Date.now(),
        groupId: TestUtils.generateFakePubKey().key,
        encryptedKeyPairs: fakeWrappers,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupEncryptionKeyPairReply returns Fallback', async () => {
      const device = TestUtils.generateFakePubKey();

      const fakeWrappers = new Array<
        SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper
      >();
      fakeWrappers.push(
        new SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper({
          publicKey: new Uint8Array(8),
          encryptedKeyPair: new Uint8Array(8),
        })
      );
      const msg = new ClosedGroupEncryptionPairReplyMessage({
        timestamp: Date.now(),
        groupId: TestUtils.generateFakePubKey().key,
        encryptedKeyPairs: fakeWrappers,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });

    it('passing a ConfigurationMessage returns Fallback', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ConfigurationMessage({
        timestamp: Date.now(),
        activeOpenGroups: [],
        activeClosedGroups: [],
        displayName: 'displayName',
        contacts: [],
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });
  });

  describe('getCurrentConfigurationMessage', () => {
    const ourNumber = TestUtils.generateFakePubKey().key;

    // let convos: Array<ConversationModel>;
    // const mockValidOpenGroup = new MockConversation({
    //   type: ConversationTypeEnum.GROUP,
    //   id: `${openGroupPrefix}1@chat-dev.lokinet.org`,
    // });

    // const mockValidOpenGroup2 = new MockConversation({
    //   type: ConversationTypeEnum.GROUP,
    //   id: `${openGroupPrefix}1@chat-dev2.lokinet.org`,
    // });

    // const mockValidClosedGroup = new MockConversation({
    //   type: ConversationTypeEnum.GROUP,
    // });

    // const mockValidPrivate = {
    //   id: TestUtils.generateFakePubKey(),
    //   isMediumGroup: () => false,
    //   isPublic: () => false,
    // };

    beforeEach(() => {
      // convos = [];
      Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').resolves(ourNumber);
      Sinon.stub(UserUtils, 'getOurPubKeyFromCache').resolves(PubKey.cast(ourNumber));
    });

    beforeEach(() => {
      // convos = [];
      Sinon.restore();
    });

    // it('filter out non active open groups', async () => {
    //   // override the first open group and make it inactive
    //   (mockValidOpenGroup as any).attributes.active_at = undefined;

    //   convos.push(
    //     mockValidOpenGroup as any,
    //     mockValidOpenGroup as any,
    //     mockValidPrivate as any,
    //     mockValidClosedGroup as any,
    //     mockValidOpenGroup2 as any
    //   );

    //   const configMessage = await getCurrentConfigurationMessage(convos);
    //   expect(configMessage.activeOpenGroups.length).to.equal(1);
    //   expect(configMessage.activeOpenGroups[0]).to.equal('chat-dev2.lokinet.org');
    // });
  });
});
