import { expect } from 'chai';
import * as sinon from 'sinon';
import * as _ from 'lodash';
import { GroupUtils, MessageUtils } from '../../../session/utils';
import { TestUtils, Stubs } from '../../../test/test-utils';
import { MessageQueue } from '../../../session/sending/MessageQueue';
import {
  generateChatMessage,
  generateFakePubkey,
  generateMemberList,
  generateOpenGroupMessage,
  generateClosedGroupMessage,
} from '../../test-utils/testUtils';
import { getGroupMembers, isMediumGroup } from '../../../session/utils/Groups';
import { OpenGroupMessage } from '../../../session/messages/outgoing';
import { RawMessage, PubKey } from '../../../session/types';
import { UserUtil } from '../../../util';
import { MessageSender } from '../../../session/sending';
import { toRawMessage } from '../../../session/utils/Messages';
import { SessionProtocol } from '../../../session/protocols';
import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';


describe('MessageQueue', () => {
  const sandbox = sinon.createSandbox();
  const ourNumber = generateFakePubkey().key;

  let PendingMessageCacheStub: any;

  // Keep track of Session Requests in each test
  let sessionRequestSent: boolean;

  // Initialize new stubbed cache
  let messageQueueStub: MessageQueue;
  // Message Sender Stubs
  let sendStub: sinon.SinonStub<[RawMessage, (number | undefined)?]>;
  let sendToOpenGroupStub: sinon.SinonStub<[OpenGroupMessage]>;
  // Group Utils Stubs
  let isMediumGroupStub: sinon.SinonStub;
  let groupMembersStub: sinon.SinonStub;
  // Session Protocol Stubs
  let hasSessionStub: sinon.SinonStub;
  let sendSessionRequestIfNeededStub: sinon.SinonStub;
  // Pending Mesage Cache Stubs
  let getForDeviceStub: sinon.SinonStub;


  beforeEach(async () => {
    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);

    TestUtils.stubData('getPairedDevicesFor').callsFake(async () => {
      return generateMemberList(2);
    });

    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherStub,
    } as any);


    // Message Sender Stubs
    sendStub = sandbox.stub(MessageSender, 'send').resolves();
    sendToOpenGroupStub = sandbox.stub(MessageSender, 'sendToOpenGroup').resolves(true);

    // Group Utils Stubs
    isMediumGroupStub = sandbox.stub(GroupUtils, 'isMediumGroup').resolves(false);
    groupMembersStub = sandbox.stub(GroupUtils, 'getGroupMembers' as any).callsFake(
      async () => generateMemberList(10)
    );

    // Session Protocol Stubs
    hasSessionStub = sandbox.stub(SessionProtocol, 'hasSession').resolves(true);
    sendSessionRequestIfNeededStub = sandbox.stub(SessionProtocol, 'sendSessionRequestIfNeeded').callsFake(
      async (pubkey: PubKey) => {
        pubkey;
        sessionRequestSent = true;
      }
    );

    // Pending Mesage Cache Stubs
    PendingMessageCacheStub = sinon.createStubInstance(PendingMessageCache);
    const chatMessages = Array.from({ length: 10 }, generateChatMessage);
    getForDeviceStub = sandbox.stub(PendingMessageCacheStub, 'getForDevice').resolves(
      chatMessages.map(m => toRawMessage(generateFakePubkey(), m))
    );

    const rawMessage = toRawMessage(generateFakePubkey(), generateChatMessage());
    sandbox.stub(PendingMessageCacheStub, 'add').resolves(rawMessage);
    sandbox.stub(PendingMessageCacheStub, 'remove').resolves();
    sandbox.stub(PendingMessageCacheStub, 'getDevices').resolves(generateMemberList(10));

    PendingMessageCacheStub.add = sandbox.stub().resolves(rawMessage);

    messageQueueStub = new MessageQueue();
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();

    PendingMessageCacheStub.add.restore();
    PendingMessageCacheStub.remove.restore();
    PendingMessageCacheStub.getDevices.restore();
    PendingMessageCacheStub.getForDevice.restore();
  });

  it('can send to a single device', async () => {
    const device = generateFakePubkey();
    const message = generateChatMessage();

    const promise = messageQueueStub.send(device, message);
    await expect(promise).to.be.fulfilled;
  });

  it('can send to many devices', async () => {
    const devices = generateMemberList(10);
    const message = generateChatMessage();

    const promise = messageQueueStub.sendMessageToDevices(devices, message);
    await expect(promise).to.be.fulfilled;
  });

  it('can send using multidevice', async () => {
    const device = generateFakePubkey();
    const message = generateChatMessage();

    const promise = messageQueueStub.sendUsingMultiDevice(device, message);
    await expect(promise).to.be.fulfilled;
  });

  it('can send to open group', async () => {
    const message = generateOpenGroupMessage();
    const success = await messageQueueStub.sendToGroup(message);

    expect(success).to.equal(true, 'sending to group failed');
  });

  it('can send to closed group', async () => {
    const message = generateClosedGroupMessage();
    const success = await messageQueueStub.sendToGroup(message);

    expect(success).to.equal(true, 'sending to group failed');
  });

  it('wont send message to empty group', async () => {
    groupMembersStub.callsFake(
      async () => generateMemberList(0)
    );

    const message = generateClosedGroupMessage();
    const response = await messageQueueStub.sendToGroup(message);

    expect(response).to.equal(
      false,
      'sendToGroup send a message to an empty group'
    );
  });

  it('wont send invalid message type to group', async () => {
    // Regular chat message should return false
    const message = generateChatMessage();
    const response = await messageQueueStub.sendToGroup(message);

    expect(response).to.equal(
      false,
      'sendToGroup considered an invalid message type as valid'
    );
  });

  it('will send sync message if no session', async () => {
    hasSessionStub.resolves(false);

    const device = generateFakePubkey();
    const message = generateChatMessage();
    const promise = messageQueueStub.processPending(device);

    expect(promise).to.be.fulfilled;
  });

  it('can send sync message', async () => {

  });
});
