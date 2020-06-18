import { expect } from 'chai';
import * as sinon from 'sinon';
import * as _ from 'lodash';
import { GroupUtils, SyncMessageUtils } from '../../../session/utils';
import { Stubs, TestUtils } from '../../../test/test-utils';
import { MessageQueue } from '../../../session/sending/MessageQueue';
import {
  ChatMessage,
  ClosedGroupMessage,
  ContentMessage,
  OpenGroupMessage,
} from '../../../session/messages/outgoing';
import { PubKey, RawMessage } from '../../../session/types';
import { UserUtil } from '../../../util';
import { MessageSender, PendingMessageCache } from '../../../session/sending';
import { toRawMessage } from '../../../session/utils/Messages';
import {
  SessionProtocol,
  MultiDeviceProtocol,
} from '../../../session/protocols';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

// Helper function to force sequential on events checks
async function tick() {
  return new Promise(resolve => {
    // tslint:disable-next-line: no-string-based-set-timeout
    setTimeout(resolve, 0);
  });
}

describe('MessageQueue', () => {
  // Initialize new stubbed cache
  let data: StorageItem;
  const sandbox = sinon.createSandbox();
  const ourDevice = TestUtils.generateFakePubKey();
  const ourNumber = ourDevice.key;
  const pairedDevices = TestUtils.generateFakePubKeys(2);

  // Initialize new stubbed queue
  let messageQueueStub: MessageQueue;

  // Spies
  let sendMessageToDevicesSpy: sinon.SinonSpy<
    [Array<PubKey>, ContentMessage],
    Promise<Array<void>>
  >;
  let sendSyncMessageSpy: sinon.SinonSpy<
    [ContentMessage, Array<PubKey>],
    Promise<Array<void>>
  >;
  let sendToGroupSpy: sinon.SinonSpy<
    [OpenGroupMessage | ClosedGroupMessage],
    Promise<boolean>
  >;

  // Message Sender Stubs
  let sendStub: sinon.SinonStub<[RawMessage, (number | undefined)?]>;
  let sendToOpenGroupStub: sinon.SinonStub<[OpenGroupMessage]>;
  // Utils Stubs
  let groupMembersStub: sinon.SinonStub;
  let canSyncStub: sinon.SinonStub<[ContentMessage], boolean>;
  // Session Protocol Stubs
  let hasSessionStub: sinon.SinonStub<[PubKey]>;
  let sendSessionRequestIfNeededStub: sinon.SinonStub<[PubKey], Promise<void>>;

  beforeEach(async () => {
    // Stub out methods which touch the database
    const storageID = 'pendingMessages';
    data = {
      id: storageID,
      value: '[]',
    };

    // Pending Message Cache Data Stubs
    TestUtils.stubData('getItemById')
      .withArgs('pendingMessages')
      .resolves(data);
    TestUtils.stubData('createOrUpdateItem').callsFake((item: StorageItem) => {
      if (item.id === storageID) {
        data = item;
      }
    });

    // Utils Stubs
    canSyncStub = sandbox.stub(SyncMessageUtils, 'canSync');
    canSyncStub.returns(false);
    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
    sandbox.stub(MultiDeviceProtocol, 'getAllDevices').resolves(pairedDevices);

    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherStub,
    } as any);

    // Message Sender Stubs
    sendStub = sandbox.stub(MessageSender, 'send').resolves();
    sendToOpenGroupStub = sandbox
      .stub(MessageSender, 'sendToOpenGroup')
      .resolves(true);

    // Group Utils Stubs
    sandbox.stub(GroupUtils, 'isMediumGroup').returns(false);
    groupMembersStub = sandbox
      .stub(GroupUtils, 'getGroupMembers' as any)
      .resolves(TestUtils.generateFakePubKeys(10));

    // Session Protocol Stubs
    sandbox.stub(SessionProtocol, 'sendSessionRequest').resolves();
    hasSessionStub = sandbox.stub(SessionProtocol, 'hasSession').resolves(true);
    sendSessionRequestIfNeededStub = sandbox
      .stub(SessionProtocol, 'sendSessionRequestIfNeeded')
      .resolves();

    // Pending Mesage Cache Stubs
    const chatMessages = Array.from(
      { length: 10 },
      TestUtils.generateChatMessage
    );
    const rawMessage = toRawMessage(
      TestUtils.generateFakePubKey(),
      TestUtils.generateChatMessage()
    );

    sandbox.stub(PendingMessageCache.prototype, 'add').resolves(rawMessage);
    sandbox.stub(PendingMessageCache.prototype, 'remove').resolves();
    sandbox
      .stub(PendingMessageCache.prototype, 'getDevices')
      .returns(TestUtils.generateFakePubKeys(10));
    sandbox
      .stub(PendingMessageCache.prototype, 'getForDevice')
      .returns(
        chatMessages.map(m => toRawMessage(TestUtils.generateFakePubKey(), m))
      );

    // Spies
    sendSyncMessageSpy = sandbox.spy(MessageQueue.prototype, 'sendSyncMessage');
    sendMessageToDevicesSpy = sandbox.spy(
      MessageQueue.prototype,
      'sendMessageToDevices'
    );
    sendToGroupSpy = sandbox.spy(MessageQueue.prototype, 'sendToGroup');

    // Init Queue
    messageQueueStub = new MessageQueue();
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  describe('send', () => {
    it('can send to a single device', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.send(device, message);
      await expect(promise).to.be.fulfilled;
    });

    it('can send sync message', async () => {
      const devices = TestUtils.generateFakePubKeys(3);
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.sendSyncMessage(message, devices);
      expect(promise).to.be.fulfilled;
    });
  });

  describe('processPending', () => {
    it('will send session request message if no session', async () => {
      hasSessionStub.resolves(false);

      const device = TestUtils.generateFakePubKey();
      const promise = messageQueueStub.processPending(device);

      await expect(promise).to.be.fulfilled;
      expect(sendSessionRequestIfNeededStub.callCount).to.equal(1);
    });

    it('will send message if session exists', async () => {
      const device = TestUtils.generateFakePubKey();
      const hasSession = await hasSessionStub(device);

      const promise = messageQueueStub.processPending(device);
      await expect(promise).to.be.fulfilled;

      expect(hasSession).to.equal(true, 'session does not exist');
      expect(sendSessionRequestIfNeededStub.callCount).to.equal(0);
    });
  });

  describe('sendUsingMultiDevice', () => {
    it('can send using multidevice', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.sendUsingMultiDevice(device, message);
      await expect(promise).to.be.fulfilled;

      // Ensure the arguments passed into sendMessageToDevices are correct
      const previousArgs = sendMessageToDevicesSpy.lastCall.args as [
        Array<PubKey>,
        ChatMessage
      ];

      // Check that instances are equal
      expect(previousArgs).to.have.length(2);

      const argsPairedDevices = previousArgs[0];
      const argsChatMessage = previousArgs[1];

      expect(argsChatMessage instanceof ChatMessage).to.equal(
        true,
        'message passed into sendMessageToDevices was not a valid ChatMessage'
      );
      expect(argsChatMessage.isEqual(message)).to.equal(
        true,
        'message passed into sendMessageToDevices has been mutated'
      );

      argsPairedDevices.forEach((argsPaired: PubKey, index: number) => {
        expect(argsPaired instanceof PubKey).to.equal(
          true,
          'a device passed into sendMessageToDevices was not a PubKey'
        );
        expect(argsPaired.isEqual(pairedDevices[index])).to.equal(
          true,
          'a device passed into sendMessageToDevices did not match MessageDeviceProtocol.getAllDevices'
        );
      });
    });
  });

  describe('sendMessageToDevices', () => {
    it('can send to many devices', async () => {
      const devices = TestUtils.generateFakePubKeys(10);
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.sendMessageToDevices(devices, message);
      await expect(promise).to.be.fulfilled;
    });

    it('can send sync message and confirm canSync is valid', async () => {
      canSyncStub.returns(true);

      const devices = TestUtils.generateFakePubKeys(3);
      const message = TestUtils.generateChatMessage();
      const pairedDeviceKeys = pairedDevices.map(device => device.key);

      const promise = messageQueueStub.sendMessageToDevices(devices, message);
      await expect(promise).to.be.fulfilled;

      // Check sendSyncMessage parameters
      const previousArgs = sendSyncMessageSpy.lastCall.args as [
        ChatMessage,
        Array<PubKey>
      ];
      expect(sendSyncMessageSpy.callCount).to.equal(1);

      // Check that instances are equal
      expect(previousArgs).to.have.length(2);

      const argsChatMessage = previousArgs[0];
      const argsPairedKeys = [...previousArgs[1]].map(d => d.key);

      expect(argsChatMessage instanceof ChatMessage).to.equal(
        true,
        'message passed into sendMessageToDevices was not a valid ChatMessage'
      );
      expect(argsChatMessage.isEqual(message)).to.equal(
        true,
        'message passed into sendMessageToDevices has been mutated'
      );

      // argsPairedKeys and pairedDeviceKeys should contain the same values
      const keyArgsValid = _.isEmpty(_.xor(argsPairedKeys, pairedDeviceKeys));
      expect(keyArgsValid).to.equal(
        true,
        'devices passed into sendSyncMessage were invalid'
      );
    });
  });

  describe('sendToGroup', () => {
    it('can send to closed group', async () => {
      const message = TestUtils.generateClosedGroupMessage();
      const success = await messageQueueStub.sendToGroup(message);
      expect(success).to.equal(true, 'sending to group failed');
    });

    it('uses correct parameters for sendToGroup with ClosedGroupMessage', async () => {
      const message = TestUtils.generateClosedGroupMessage();
      const success = await messageQueueStub.sendToGroup(message);

      expect(success).to.equal(true, 'sending to group failed');

      // Check parameters
      const previousArgs = sendMessageToDevicesSpy.lastCall.args as [
        Array<PubKey>,
        ClosedGroupMessage
      ];
      expect(previousArgs).to.have.length(2);

      const argsClosedGroupMessage = previousArgs[1];
      expect(argsClosedGroupMessage instanceof ClosedGroupMessage).to.equal(
        true,
        'message passed into sendMessageToDevices was not a ClosedGroupMessage'
      );
    });

    it("won't send to invalid groupId", async () => {
      const message = TestUtils.generateClosedGroupMessage('invalid-group-id');
      const success = await messageQueueStub.sendToGroup(message);

      // Ensure message parameter passed into sendToGroup is as expected
      expect(success).to.equal(
        false,
        'an invalid groupId was treated as valid'
      );
      expect(sendToGroupSpy.callCount).to.equal(1);

      const argsMessage = sendToGroupSpy.lastCall.args[0];
      expect(argsMessage instanceof ClosedGroupMessage).to.equal(
        true,
        'message passed into sendToGroup was not a ClosedGroupMessage'
      );
      expect(success).to.equal(
        false,
        'invalid ClosedGroupMessage was propogated through sendToGroup'
      );
    });

    it('wont send message to empty closed group', async () => {
      groupMembersStub.resolves(TestUtils.generateFakePubKeys(0));

      const message = TestUtils.generateClosedGroupMessage();
      const response = await messageQueueStub.sendToGroup(message);

      expect(response).to.equal(
        false,
        'sendToGroup send a message to an empty group'
      );
    });

    it('can send to open group', async () => {
      const message = TestUtils.generateOpenGroupMessage();
      const success = await messageQueueStub.sendToGroup(message);

      expect(success).to.equal(true, 'sending to group failed');
    });
  });

  describe('events', () => {
    it('can send events on message sending success', async () => {
      const successSpy = sandbox.spy();
      messageQueueStub.events.on('success', successSpy);

      const device = TestUtils.generateFakePubKey();
      const promise = messageQueueStub.processPending(device);
      await expect(promise).to.be.fulfilled;

      await tick();
      expect(successSpy.callCount).to.equal(1);
    });

    it('can send events on message sending failure', async () => {
      sendStub.throws(new Error('Failed to send message.'));

      const failureSpy = sandbox.spy();
      messageQueueStub.events.on('fail', failureSpy);

      const device = TestUtils.generateFakePubKey();
      const promise = messageQueueStub.processPending(device);
      await expect(promise).to.be.fulfilled;

      await tick();
      expect(failureSpy.callCount).to.equal(1);
    });
  });
});
