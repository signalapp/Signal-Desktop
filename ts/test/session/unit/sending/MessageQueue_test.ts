// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

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
import { ClosedGroupMessage } from '../../../../session/messages/outgoing/content/data/group/ClosedGroupMessage';

import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);
chai.should();

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

  beforeEach(() => {
    // Utils Stubs
    sandbox.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

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
      // tslint:disable-next-line: no-unused-expression
      expect(successPromise).to.eventually.be.fulfilled;
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
        return promise.should.be.fulfilled;
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

        const [rawMessage, error] = await eventPromise;
        expect(rawMessage.identifier).to.equal(message.identifier);
        expect(error.message).to.equal('failure');
      });
    });
  });

  describe('sendToPubKey', () => {
    it('should send the message to the device', async () => {
      const device = TestUtils.generateFakePubKey();
      const stub = sandbox.stub(messageQueueStub as any, 'process').resolves();

      const message = TestUtils.generateChatMessage();
      await messageQueueStub.sendToPubKey(device, message);

      const args = stub.lastCall.args as [Array<PubKey>, ContentMessage];
      expect(args[0]).to.be.equal(device);
      expect(args[1]).to.equal(message);
    });
  });

  describe('sendToGroup', () => {
    it('should throw an error if invalid non-group message was passed', () => {
      // const chatMessage = TestUtils.generateChatMessage();
      // await expect(
      //   messageQueueStub.sendToGroup(chatMessage)
      // ).to.be.rejectedWith('Invalid group message passed in sendToGroup.');
      // Cannot happen with typescript as this function only accept group message now
    });

    describe('closed groups', () => {
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
        expect(arg[1] instanceof ClosedGroupMessage).to.equal(
          true,
          'message sent to group member was not a ClosedGroupMessage'
        );
      });

      describe('open groups', () => {
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
          return eventPromise.should.be.fulfilled;
        });

        it('should emit a fail event if something went wrong', async () => {
          sendToOpenGroupStub.resolves({ serverId: -1, serverTimestamp: -1 });
          const message = TestUtils.generateOpenGroupMessage();
          const eventPromise = PromiseUtils.waitForTask(complete => {
            messageQueueStub.events.once('sendFail', complete);
          }, 2000);

          await messageQueueStub.sendToGroup(message);
          return eventPromise.should.be.fulfilled;
        });
      });
    });
  });
});
