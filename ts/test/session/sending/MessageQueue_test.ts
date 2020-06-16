import { expect } from 'chai';
import Sinon, * as sinon from 'sinon';
import { GroupUtils } from '../../../session/utils';
import { Stubs, TestUtils } from '../../../test/test-utils';
import { MessageQueue } from '../../../session/sending/MessageQueue';
import { OpenGroupMessage, ChatMessage } from '../../../session/messages/outgoing';
import { PubKey, RawMessage } from '../../../session/types';
import { UserUtil } from '../../../util';
import { MessageSender } from '../../../session/sending';
import { toRawMessage } from '../../../session/utils/Messages';
import { SessionProtocol } from '../../../session/protocols';
import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';
import { generateChatMessage } from '../../test-utils/testUtils';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('MessageQueue', () => {
  // Initialize new stubbed cache
  let data: StorageItem;
  const sandbox = sinon.createSandbox();
  const ourNumber = TestUtils.generateFakePubkey().key;
  const pairedDevices = TestUtils.generateMemberList(2).map(m => m.key);

  // Initialize new stubbed queue
  let messageQueueStub: MessageQueue;

  // Spies
  // let messageQueueSpy: Sinon.SinonSpy;
  let sendMessageToDevicesSpy: Sinon.SinonSpy;

  // Message Sender Stubs
  let sendStub: sinon.SinonStub<[RawMessage, (number | undefined)?]>;
  let sendToOpenGroupStub: sinon.SinonStub<[OpenGroupMessage]>;
  // Group Utils Stubs
  let groupMembersStub: sinon.SinonStub;
  // Session Protocol Stubs
  let hasSessionStub: sinon.SinonStub<[PubKey]>;
  let sendSessionRequestIfNeededStub: sinon.SinonStub;

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
    sendMessageToDevicesSpy = sandbox.spy(
      MessageQueue.prototype,
      'sendMessageToDevices'
    );

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

    it('will send sync message if no session', async () => {
      hasSessionStub.resolves(false);

      const device = TestUtils.generateFakePubkey();
      const promise = messageQueueStub.processPending(device);

      expect(promise).to.be.fulfilled;

      await tick();
      expect(sendSessionRequestIfNeededStub.callCount).to.equal(1);
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
      const previousArgs = sendMessageToDevicesSpy.lastCall.args as [Array<PubKey>, ChatMessage];

      // Check that instances are equal
      expect(previousArgs).to.have.length(2);

      const argsPairedDevices = previousArgs[0];
      const argsChatMessage = previousArgs[1];

      expect(argsChatMessage instanceof ChatMessage).to.equal(true, 'message passed into sendMessageToDevices was not a valid ChatMessage');
      expect(argsChatMessage.isEqual(message)).to.equal(true, 'message passed into sendMessageToDevices has been mutated');

      argsPairedDevices.forEach((argsPaired: PubKey, index: number) => {
        expect(argsPaired instanceof PubKey).to.equal(true, 'a device passed into sendMessageToDevices was not a PubKey');
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

    it('can send to open group', async () => {
      const message = TestUtils.generateOpenGroupMessage();
      const success = await messageQueueStub.sendToGroup(message);

      expect(success).to.equal(true, 'sending to group failed');
    });

    it('can send to closed group', async () => {
      const message = TestUtils.generateClosedGroupMessage();
      const success = await messageQueueStub.sendToGroup(message);

      expect(success).to.equal(true, 'sending to group failed');
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

    it('wont send invalid message type to group', async () => {
      // Regular chat message should return false
      const message = TestUtils.generateChatMessage();
      const response = await messageQueueStub.sendToGroup(message);

      expect(response).to.equal(
        false,
        'sendToGroup considered an invalid message type as valid'
      );
    });
  });
});
