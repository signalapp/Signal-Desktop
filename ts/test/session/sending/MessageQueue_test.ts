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
} from '../../test-utils/testUtils';
import { getGroupMembers } from '../../../session/utils/Groups';
import { OpenGroupMessage } from '../../../session/messages/outgoing';
import { RawMessage } from '../../../session/types';
import { UserUtil } from '../../../util';
import { MessageSender } from '../../../session/sending';
import { sendToOpenGroup } from '../../../session/sending/MessageSender';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('MessageQueue', () => {
  const sandbox = sinon.createSandbox();
  const ourNumber = generateFakePubkey().key;

  // Initialize new stubbed cache
  let data: StorageItem;
  let messageQueueStub: MessageQueue;

  let sendStub: sinon.SinonStub<[RawMessage, (number | undefined)?]>;
  let sendToOpenGroupStub: sinon.SinonStub<[OpenGroupMessage]>;

  beforeEach(async () => {
    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);

    // PendingMessageCache stubs
    const storageID = 'pendingMessages';
    data = {
      id: storageID,
      value: '[]',
    };

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

    TestUtils.stubData('getPairedDevicesFor').callsFake(async () => {
      return generateMemberList(2);
    });

    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherStub,
    } as any);

    // Other stubs
    sendStub = sandbox.stub(MessageSender, 'send').resolves(undefined);
    sendToOpenGroupStub = sandbox.stub(MessageSender, 'sendToOpenGroup').resolves(true);

    sandbox.stub(GroupUtils, 'getGroupMembers').callsFake(
      async () =>
        new Promise(r => {
          r(generateMemberList(10));
        })
    );

    messageQueueStub = new MessageQueue();
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  it('can send to many devices', async () => {
    const devices = generateMemberList(10);
    const message = generateChatMessage();

    await messageQueueStub.sendMessageToDevices(devices, message);

    // Failure will make an error; check messageQueueStub.events
  });

  it('can send using multidevice', async () => {
    const device = generateFakePubkey();
    const message = generateChatMessage();

    await messageQueueStub.sendUsingMultiDevice(device, message);

    // Failure will make an error; check messageQueueStub.events
  });

  it('can send to open group', async () => {
    const message = generateOpenGroupMessage();
    const success = await messageQueueStub.sendToGroup(message);

    expect(success).to.equal(true, 'sending to group failed');

    // Failure will make an error; check messageQueueStub.events
  });

  it('can send to closed group', async () => {
    const message = generateOpenGroupMessage();
    const success = await messageQueueStub.sendToGroup(message);

    expect(success).to.equal(true, 'sending to group failed');

    // Failure will make an error; check messageQueueStub.events
  });

  it('can send to open group', async () => {
    const message = generateOpenGroupMessage();

    await messageQueueStub.sendToGroup(message);

    // Failure will make an error; check messageQueueStub.events
  });

  it('wont send wrong message type to group', async () => {
    // Regular chat message should return false
    const message = generateChatMessage();

    const response = await messageQueueStub.sendToGroup(message);

    expect(response).to.equal(
      false,
      'sendToGroup considered an invalid message type as valid'
    );

    // Failure will make an error; check messageQueueStub.events
  });

  it("won't process invalid message", async () => {
    // SHOULD make an error; expect error

    // EXAMPLE FROM MESSAGESENDER_TEST
    // it('should not retry if an error occurred during encryption', async () => {
    //   encryptStub.throws(new Error('Failed to encrypt.'));
    //   const promise = MessageSender.send(rawMessage);
    //   await expect(promise).is.rejectedWith('Failed to encrypt.');
    //   expect(lokiMessageAPIStub.sendMessage.callCount).to.equal(0);
    // });

  });

  it('can send sync message', async () => {

  });
});
