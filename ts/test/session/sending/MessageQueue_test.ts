import { expect } from 'chai';
import * as sinon from 'sinon';
import { GroupUtils } from '../../../session/utils';
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
import { SessionProtocol } from '../../../session/protocols';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('MessageQueue', () => {
  // Initialize new stubbed cache
  let data: StorageItem;
  const sandbox = sinon.createSandbox();
  const ourDevice = TestUtils.generateFakePubkey();
  const ourNumber = ourDevice.key;
  const pairedDevices = TestUtils.generateMemberList(2).map(m => m.key);

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
    [ContentMessage | OpenGroupMessage],
    Promise<boolean>
  >;

  // Message Sender Stubs
  let sendStub: sinon.SinonStub<[RawMessage, (number | undefined)?]>;
  let sendToOpenGroupStub: sinon.SinonStub<[OpenGroupMessage]>;
  // Group Utils Stubs
  let groupMembersStub: sinon.SinonStub;
  // Session Protocol Stubs
  let hasSessionStub: sinon.SinonStub<[PubKey]>;
  let sendSessionRequestIfNeededStub: sinon.SinonStub<[PubKey], Promise<void>>;

  // Helper function returns a promise that resolves after all other promise mocks,
  // even if they are chained like Promise.resolve().then(...)
  // Technically: this is designed to resolve on the next macrotask
  async function tick() {
    return new Promise(resolve => {
      // tslint:disable-next-line: no-string-based-set-timeout
      setTimeout(resolve, 0);
    });
  }

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
      .callsFake(async () => {
        return data;
      });
    TestUtils.stubData('createOrUpdateItem').callsFake((item: StorageItem) => {
      if (item.id === storageID) {
        data = item;
      }
    });

    // Utils Stubs
    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
    TestUtils.stubData('getPairedDevicesFor').resolves(pairedDevices);
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
      .callsFake(async () => TestUtils.generateMemberList(10));

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
      TestUtils.generateFakePubkey(),
      TestUtils.generateChatMessage()
    );

    sandbox.stub(PendingMessageCache.prototype, 'add').resolves(rawMessage);
    sandbox.stub(PendingMessageCache.prototype, 'remove').resolves();
    sandbox
      .stub(PendingMessageCache.prototype, 'getDevices')
      .returns(TestUtils.generateMemberList(10));
    sandbox
      .stub(PendingMessageCache.prototype, 'getForDevice')
      .returns(
        chatMessages.map(m => toRawMessage(TestUtils.generateFakePubkey(), m))
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
      const device = TestUtils.generateFakePubkey();
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.send(device, message);
      await expect(promise).to.be.fulfilled;
    });

    it('can send sync message', async () => {
      const devices = TestUtils.generateMemberList(3);
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.sendSyncMessage(message, devices);
      expect(promise).to.be.fulfilled;
    });
  });

  describe('processPending', () => {
    it('will send sync message if no session', async () => {
      hasSessionStub.resolves(false);

      const device = TestUtils.generateFakePubkey();
      const promise = messageQueueStub.processPending(device);

      expect(promise).to.be.fulfilled;

      await tick();
      expect(sendSessionRequestIfNeededStub.callCount).to.equal(1);
    });

    it('will send message if session exists', async () => {
      const device = TestUtils.generateFakePubkey();
      const hasSession = await hasSessionStub(device);

      const promise = messageQueueStub.processPending(device);
      expect(promise).to.be.fulfilled;

      await tick();
      expect(hasSession).to.equal(true, 'session does not exist');
      expect(sendSessionRequestIfNeededStub.callCount).to.equal(0);
    });
  });

  describe('sendUsingMultiDevice', () => {
    it('can send using multidevice', async () => {
      const device = TestUtils.generateFakePubkey();
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.sendUsingMultiDevice(device, message);
      expect(promise).to.be.fulfilled;

      // Ensure the arguments passed into sendMessageToDevices are correct
      await tick();
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
        expect(argsPaired.key).to.equal(pairedDevices[index]);
      });
    });
  });

  describe('sendMessageToDevices', () => {
    it('can send to many devices', async () => {
      const devices = TestUtils.generateMemberList(10);
      const message = TestUtils.generateChatMessage();

      const promise = messageQueueStub.sendMessageToDevices(devices, message);
      await expect(promise).to.be.fulfilled;
    });

    it('can send sync message and confirm canSync is valid', async () => {
      const devices = TestUtils.generateMemberList(3);
      const message = TestUtils.generateChatMessage();
      const ourDevices = [...pairedDevices, ourNumber].sort();

      const promise = messageQueueStub.sendMessageToDevices(devices, message);
      expect(promise).to.be.fulfilled;

      // Check sendSyncMessage parameters
      await tick();
      const previousArgs = sendSyncMessageSpy.lastCall.args as [
        ChatMessage,
        Array<PubKey>
      ];
      expect(sendSyncMessageSpy.callCount).to.equal(1);

      // Check that instances are equal
      expect(previousArgs).to.have.length(2);

      const argsChatMessage = previousArgs[0];
      const argsPairedKeys = [...previousArgs[1]].map(d => d.key).sort();

      expect(argsChatMessage instanceof ChatMessage).to.equal(
        true,
        'message passed into sendMessageToDevices was not a valid ChatMessage'
      );
      expect(argsChatMessage.isEqual(message)).to.equal(
        true,
        'message passed into sendMessageToDevices has been mutated'
      );

      argsPairedKeys.forEach((argsPaired: string, index: number) => {
        expect(argsPaired).to.equal(ourDevices[index]);
      });
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
      await tick();
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
      await tick();
      expect(sendToGroupSpy.callCount).to.equal(1);
      expect(sendToGroupSpy.lastCall.args).to.have.length(1);

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
      groupMembersStub.callsFake(async () => TestUtils.generateMemberList(0));

      const message = TestUtils.generateClosedGroupMessage();
      const response = await messageQueueStub.sendToGroup(message);

      expect(response).to.equal(
        false,
        'sendToGroup send a message to an empty group'
      );
    });

    it('wont send invalid message type to closed group', async () => {
      // Regular chat message should return false
      const message = TestUtils.generateChatMessage();
      const response = await messageQueueStub.sendToGroup(message);

      expect(response).to.equal(
        false,
        'sendToGroup considered an invalid message type as valid'
      );

      // These should not be called; early exit
      expect(sendMessageToDevicesSpy.callCount).to.equal(0);
      expect(sendToOpenGroupStub.callCount).to.equal(0);
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

      const device = TestUtils.generateFakePubkey();
      const promise = messageQueueStub.processPending(device);
      expect(promise).to.be.fulfilled;

      await tick();
      expect(successSpy.callCount).to.equal(1);
    });

    it('can send events on message sending failure', async () => {
      sendStub.throws(new Error('Failed to send message.'));

      const failureSpy = sandbox.spy();
      messageQueueStub.events.on('fail', failureSpy);

      const device = TestUtils.generateFakePubkey();
      const promise = messageQueueStub.processPending(device);
      expect(promise).to.be.fulfilled;

      await tick();
      expect(failureSpy.callCount).to.equal(1);
    });
  });
});
