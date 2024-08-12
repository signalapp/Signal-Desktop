/* eslint-disable no-unused-expressions */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { beforeEach } from 'mocha';
import Sinon from 'sinon';

import { ConfigurationMessage } from '../../../../session/messages/outgoing/controlMessage/ConfigurationMessage';
import { ClosedGroupVisibleMessage } from '../../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../../../../session/types';
import { MessageUtils, UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';

import { OpenGroupData } from '../../../../data/opengroups';
import { SignalService } from '../../../../protobuf';
import { getOpenGroupV2ConversationId } from '../../../../session/apis/open_group_api/utils/OpenGroupUtils';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import { getConversationController } from '../../../../session/conversations';
import { ClosedGroupAddedMembersMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupEncryptionPairReplyMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairReplyMessage';
import { ClosedGroupNameChangeMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';
import { ClosedGroupNewMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import { getCurrentConfigurationMessage } from '../../../../session/utils/sync/syncUtils';
import { stubData, stubOpenGroupData } from '../../../test-utils/utils';
import { OpenGroupV2Room } from '../../../../data/types';
import { ConversationTypeEnum } from '../../../../models/types';

chai.use(chaiAsPromised as any);

const { expect } = chai;

const sharedNoExpire = {
  expireTimer: null,
  expirationType: null,
};

describe('Message Utils', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('toRawMessage', () => {
    it('can convert to raw message', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(
        device,
        message,
        SnodeNamespaces.UserContacts
      );

      expect(Object.keys(rawMessage)).to.have.length(6);

      expect(rawMessage.identifier).to.exist;
      expect(rawMessage.namespace).to.exist;
      expect(rawMessage.device).to.exist;
      expect(rawMessage.encryption).to.exist;
      expect(rawMessage.plainTextBuffer).to.exist;
      expect(rawMessage.ttl).to.exist;

      expect(rawMessage.identifier).to.equal(message.identifier);
      expect(rawMessage.device).to.equal(device.key);
      expect(rawMessage.plainTextBuffer).to.deep.equal(message.plainTextBuffer());
      expect(rawMessage.ttl).to.equal(message.ttl());
      expect(rawMessage.namespace).to.equal(3);
    });

    it('should generate valid plainTextBuffer', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(
        device,
        message,
        SnodeNamespaces.UserMessages
      );

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

      const rawMessage = await MessageUtils.toRawMessage(
        device,
        message,
        SnodeNamespaces.UserMessages
      );
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
      const message = new ClosedGroupVisibleMessage({
        groupId,
        timestamp: Date.now(),
        chatMessage,
        ...sharedNoExpire,
      });

      const rawMessage = await MessageUtils.toRawMessage(
        device,
        message,
        SnodeNamespaces.UserMessages
      );
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('should set encryption to Fallback on other messages', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();
      const rawMessage = await MessageUtils.toRawMessage(
        device,
        message,
        SnodeNamespaces.UserMessages
      );

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
        ...sharedNoExpire,
        expireTimer: 0,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });

    it('passing ClosedGroupNameChangeMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ClosedGroupNameChangeMessage({
        timestamp: Date.now(),
        name: 'df',
        groupId: TestUtils.generateFakePubKey().key,
        ...sharedNoExpire,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupAddedMembersMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ClosedGroupAddedMembersMessage({
        timestamp: Date.now(),
        addedMembers: [TestUtils.generateFakePubKey().key],
        groupId: TestUtils.generateFakePubKey().key,
        ...sharedNoExpire,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupRemovedMembersMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const msg = new ClosedGroupRemovedMembersMessage({
        timestamp: Date.now(),
        removedMembers: [TestUtils.generateFakePubKey().key],
        groupId: TestUtils.generateFakePubKey().key,
        ...sharedNoExpire,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupEncryptionPairMessage returns ClosedGroup', async () => {
      const device = TestUtils.generateFakePubKey();

      const fakeWrappers =
        new Array<SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper>();
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
        ...sharedNoExpire,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE);
    });

    it('passing ClosedGroupEncryptionKeyPairReply returns Fallback', async () => {
      const device = TestUtils.generateFakePubKey();

      const fakeWrappers =
        new Array<SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper>();
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
        ...sharedNoExpire,
      });
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
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
      const rawMessage = await MessageUtils.toRawMessage(device, msg, SnodeNamespaces.UserMessages);
      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });
  });

  describe('getCurrentConfigurationMessage', () => {
    const ourNumber = TestUtils.generateFakePubKey().key;

    beforeEach(async () => {
      Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').resolves(ourNumber);
      Sinon.stub(UserUtils, 'getOurPubKeyFromCache').resolves(PubKey.cast(ourNumber));
      stubData('getAllConversations').resolves([]);
      stubData('saveConversation').resolves();
      stubOpenGroupData('getAllV2OpenGroupRooms').resolves();
      TestUtils.stubData('getItemById').callsFake(async () => {
        return { value: '[]' };
      });
      getConversationController().reset();

      await getConversationController().load();
    });

    afterEach(() => {
      Sinon.restore();
    });

    // open groups are actually removed when we leave them so this doesn't make much sense, but just in case we break something later
    it('filter out non active open groups', async () => {
      await getConversationController().getOrCreateAndWait(
        '05123456789',
        ConversationTypeEnum.PRIVATE
      );
      await getConversationController().getOrCreateAndWait(
        '0512345678',
        ConversationTypeEnum.PRIVATE
      );

      const convoId3 = getOpenGroupV2ConversationId('http://chat-dev2.lokinet.org', 'fish');
      const convoId4 = getOpenGroupV2ConversationId('http://chat-dev3.lokinet.org', 'fish2');
      const convoId5 = getOpenGroupV2ConversationId('http://chat-dev3.lokinet.org', 'fish3');

      const convo3 = await getConversationController().getOrCreateAndWait(
        convoId3,
        ConversationTypeEnum.GROUP
      );
      convo3.set({ active_at: Date.now() });

      stubOpenGroupData('getV2OpenGroupRoom')
        .returns(null)
        .withArgs(convoId3)
        .returns({
          serverUrl: 'http://chat-dev2.lokinet.org',
          roomId: 'fish',
          serverPublicKey: 'serverPublicKey',
        } as OpenGroupV2Room);

      const convo4 = await getConversationController().getOrCreateAndWait(
        convoId4,
        ConversationTypeEnum.GROUP
      );
      convo4.set({ active_at: undefined });

      await OpenGroupData.opengroupRoomsLoad();
      const convo5 = await getConversationController().getOrCreateAndWait(
        convoId5,
        ConversationTypeEnum.GROUP
      );
      convo5.set({ active_at: 0 });

      await getConversationController().getOrCreateAndWait(
        '051234567',
        ConversationTypeEnum.PRIVATE
      );
      const convos = getConversationController().getConversations();

      // convoID3 is active but 4 and 5 are not
      const configMessage = await getCurrentConfigurationMessage(convos);
      expect(configMessage.activeOpenGroups.length).to.equal(1);
      expect(configMessage.activeOpenGroups[0]).to.equal(
        'http://chat-dev2.lokinet.org/fish?public_key=serverPublicKey'
      );
    });
  });
});
