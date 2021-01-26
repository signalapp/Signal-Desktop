import chai from 'chai';
import * as sinon from 'sinon';
import _ from 'lodash';
import { describe } from 'mocha';

import { GroupUtils, PromiseUtils, UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../../test/test-utils';
import { MessageQueue } from '../../../../session/sending/MessageQueue';
import {
  ContentMessage,
  OpenGroupMessage,
} from '../../../../session/messages/outgoing';
import { PubKey, RawMessage } from '../../../../session/types';
import { MessageSender } from '../../../../session/sending';
import { PendingMessageCacheStub } from '../../../test-utils/stubs';
import { ClosedGroupV2Message } from '../../../../session/messages/outgoing/content/data/groupv2/ClosedGroupV2Message';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

// tslint:disable-next-line: max-func-body-length
describe('MessageQueue', () => {
  // Initialize new stubbed cache
  const sandbox = sinon.createSandbox();
  const ourDevice = TestUtils.generateFakePubKey();
  const ourNumber = ourDevice.key;

  // Initialize new stubbed queue
  let pendingMessageCache: PendingMessageCacheStub;
  let messageQueueStub: MessageQueue;

  // Message Sender Stubs
  let sendStub: sinon.SinonStub<[RawMessage, (number | undefined)?]>;

  beforeEach(async () => {
    // Utils Stubs
    sandbox.stub(UserUtils, 'getCurrentDevicePubKey').resolves(ourNumber);

    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
    } as any);

    // Message Sender Stubs
    sendStub = sandbox.stub(MessageSender, 'send').resolves();

    // Init Queue
    pendingMessageCache = new PendingMessageCacheStub();
    messageQueueStub = new MessageQueue(pendingMessageCache);
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  describe('processPending', () => {
    it('will send messages', async () => {
      const device = TestUtils.generateFakePubKey();
      await pendingMessageCache.add(device, TestUtils.generateChatMessage());

      const successPromise = PromiseUtils.waitForTask(done => {
        messageQueueStub.events.once('sendSuccess', done);
      });
      await messageQueueStub.processPending(device);
      await expect(successPromise).to.be.fulfilled;
    });

    it('should remove message from cache', async () => {
      const events = ['sendSuccess', 'sendFail'];
      for (const event of events) {
        if (event === 'sendSuccess') {
          sendStub.resolves();
        } else {
          sendStub.throws(new Error('fail'));
        }

        const device = TestUtils.generateFakePubKey();
        await pendingMessageCache.add(device, TestUtils.generateChatMessage());

        const initialMessages = await pendingMessageCache.getForDevice(device);
        expect(initialMessages).to.have.length(1);
        await messageQueueStub.processPending(device);

        const promise = PromiseUtils.waitUntil(async () => {
          const messages = await pendingMessageCache.getForDevice(device);
          return messages.length === 0;
        });
        await expect(promise).to.be.fulfilled;
      }
    }).timeout(15000);

    describe('events', () => {
      it('should send a success event if message was sent', async () => {
        const device = TestUtils.generateFakePubKey();
        const message = TestUtils.generateChatMessage();
        await pendingMessageCache.add(device, message);

        const eventPromise = PromiseUtils.waitForTask<
          RawMessage | OpenGroupMessage
        >(complete => {
          messageQueueStub.events.once('sendSuccess', complete);
        });

        await messageQueueStub.processPending(device);
        await expect(eventPromise).to.be.fulfilled;

        const rawMessage = await eventPromise;
        expect(rawMessage.identifier).to.equal(message.identifier);
      });

      it('should send a fail event if something went wrong while sending', async () => {
        sendStub.throws(new Error('failure'));

        const spy = sandbox.spy();
        messageQueueStub.events.on('sendFail', spy);

        const device = TestUtils.generateFakePubKey();
        const message = TestUtils.generateChatMessage();
        await pendingMessageCache.add(device, message);

        const eventPromise = PromiseUtils.waitForTask<
          [RawMessage | OpenGroupMessage, Error]
        >(complete => {
          messageQueueStub.events.once('sendFail', (...args) => {
            complete(args);
          });
        });

        await messageQueueStub.processPending(device);
        await expect(eventPromise).to.be.fulfilled;

        const [rawMessage, error] = await eventPromise;
        expect(rawMessage.identifier).to.equal(message.identifier);
        expect(error.message).to.equal('failure');
      });
    });
  });

  describe('sendToPubKey', () => {
    it('should send the message to the device', async () => {
      const devices = TestUtils.generateFakePubKeys(1);
      const stub = sandbox
        .stub(messageQueueStub, 'sendMessageToDevices')
        .resolves();

      const message = TestUtils.generateChatMessage();
      await messageQueueStub.sendToPubKey(devices[0], message);

      const args = stub.lastCall.args as [Array<PubKey>, ContentMessage];
      expect(args[0]).to.have.same.members(devices);
      expect(args[1]).to.equal(message);
    });
  });

  describe('sendMessageToDevices', () => {
    it('can send to many devices', async () => {
      const devices = TestUtils.generateFakePubKeys(5);
      const message = TestUtils.generateChatMessage();

      await messageQueueStub.sendMessageToDevices(devices, message);
      expect(pendingMessageCache.getCache()).to.have.length(devices.length);
    });
  });

  describe('sendToGroup', () => {
    it('should throw an error if invalid non-group message was passed', async () => {
      // const chatMessage = TestUtils.generateChatMessage();
      // await expect(
      //   messageQueueStub.sendToGroup(chatMessage)
      // ).to.be.rejectedWith('Invalid group message passed in sendToGroup.');
      // Cannot happen with typescript as this function only accept group message now
    });

    describe('closed groups', async () => {
      it('can send to closed group', async () => {
        const members = TestUtils.generateFakePubKeys(4).map(
          p => new PubKey(p.key)
        );
        sandbox.stub(GroupUtils, 'getGroupMembers').resolves(members);

        const send = sandbox.stub(messageQueueStub, 'send').resolves();

        const message = TestUtils.generateClosedGroupMessage();
        await messageQueueStub.sendToGroup(message);
        expect(send.callCount).to.equal(1);

        const arg = send.getCall(0).args;
        expect(arg[1] instanceof ClosedGroupV2Message).to.equal(
          true,
          'message sent to group member was not a ClosedGroupV2Message'
        );
      });

      describe('open groups', async () => {
        let sendToOpenGroupStub: sinon.SinonStub<
          [OpenGroupMessage],
          Promise<{ serverId: number; serverTimestamp: number }>
        >;
        beforeEach(() => {
          sendToOpenGroupStub = sandbox
            .stub(MessageSender, 'sendToOpenGroup')
            .resolves({ serverId: -1, serverTimestamp: -1 });
        });

        it('can send to open group', async () => {
          const message = TestUtils.generateOpenGroupMessage();
          await messageQueueStub.sendToGroup(message);
          expect(sendToOpenGroupStub.callCount).to.equal(1);
        });

        it('should emit a success event when send was successful', async () => {
          sendToOpenGroupStub.resolves({
            serverId: 5125,
            serverTimestamp: 5125,
          });

          const message = TestUtils.generateOpenGroupMessage();
          const eventPromise = PromiseUtils.waitForTask(complete => {
            messageQueueStub.events.once('sendSuccess', complete);
          }, 2000);

          await messageQueueStub.sendToGroup(message);
          await expect(eventPromise).to.be.fulfilled;
        });

        it('should emit a fail event if something went wrong', async () => {
          sendToOpenGroupStub.resolves({ serverId: -1, serverTimestamp: -1 });
          const message = TestUtils.generateOpenGroupMessage();
          const eventPromise = PromiseUtils.waitForTask(complete => {
            messageQueueStub.events.once('sendFail', complete);
          }, 2000);

          await messageQueueStub.sendToGroup(message);
          await expect(eventPromise).to.be.fulfilled;
        });
      });
    });
  });
});
