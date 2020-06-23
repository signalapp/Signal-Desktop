import chai from 'chai';
import * as sinon from 'sinon';
import _ from 'lodash';
import {
  GroupUtils,
  PromiseUtils,
  SyncMessageUtils,
} from '../../../session/utils';
import { Stubs, TestUtils } from '../../../test/test-utils';
import { MessageQueue } from '../../../session/sending/MessageQueue';
import {
  ClosedGroupMessage,
  ContentMessage,
  OpenGroupMessage,
} from '../../../session/messages/outgoing';
import { PrimaryPubKey, PubKey, RawMessage } from '../../../session/types';
import { UserUtil } from '../../../util';
import { MessageSender } from '../../../session/sending';
import {
  MultiDeviceProtocol,
  SessionProtocol,
} from '../../../session/protocols';
import { PendingMessageCacheStub } from '../../test-utils/stubs';
import { describe } from 'mocha';
import { TestSyncMessage } from '../../test-utils/stubs/messages/TestSyncMessage';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

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
  // Utils Stubs
  let isMediumGroupStub: sinon.SinonStub<[PubKey], boolean>;
  // Session Protocol Stubs
  let hasSessionStub: sinon.SinonStub<[PubKey]>;
  let sendSessionRequestIfNeededStub: sinon.SinonStub<[PubKey], Promise<void>>;

  beforeEach(async () => {
    // Utils Stubs
    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);

    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherStub,
    } as any);

    // Message Sender Stubs
    sendStub = sandbox.stub(MessageSender, 'send').resolves();

    // Group Utils Stubs
    isMediumGroupStub = sandbox
      .stub(GroupUtils, 'isMediumGroup')
      .returns(false);

    // Session Protocol Stubs
    sandbox.stub(SessionProtocol, 'sendSessionRequest').resolves();
    hasSessionStub = sandbox.stub(SessionProtocol, 'hasSession').resolves(true);
    sendSessionRequestIfNeededStub = sandbox
      .stub(SessionProtocol, 'sendSessionRequestIfNeeded')
      .resolves();

    // Init Queue
    pendingMessageCache = new PendingMessageCacheStub();
    messageQueueStub = new MessageQueue(pendingMessageCache);
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  describe('processPending', () => {
    it('will send session request message if no session', async () => {
      hasSessionStub.resolves(false);
      isMediumGroupStub.returns(false);

      const device = TestUtils.generateFakePubKey();

      await messageQueueStub.processPending(device);

      const stubCallPromise = PromiseUtils.waitUntil(
        () => sendSessionRequestIfNeededStub.callCount === 1
      );
      await expect(stubCallPromise).to.be.fulfilled;
    });

    it('will send message if session exists', async () => {
      hasSessionStub.resolves(true);
      isMediumGroupStub.returns(false);
      sendStub.resolves();

      const device = TestUtils.generateFakePubKey();
      await pendingMessageCache.add(device, TestUtils.generateChatMessage());

      const successPromise = PromiseUtils.waitForTask(done => {
        messageQueueStub.events.once('success', done);
      });

      await messageQueueStub.processPending(device);
      await expect(successPromise).to.be.fulfilled;
      expect(sendSessionRequestIfNeededStub.called).to.equal(
        false,
        'Session request triggered when we have a session.'
      );
    });

    it('will send message if sending to medium group', async () => {
      isMediumGroupStub.returns(true);
      sendStub.resolves();

      const device = TestUtils.generateFakePubKey();
      await pendingMessageCache.add(device, TestUtils.generateChatMessage());

      const successPromise = PromiseUtils.waitForTask(done => {
        messageQueueStub.events.once('success', done);
      });

      await messageQueueStub.processPending(device);
      await expect(successPromise).to.be.fulfilled;
      expect(sendSessionRequestIfNeededStub.called).to.equal(
        false,
        'Session request triggered on medium group'
      );
    });

    it('should remove message from cache', async () => {
      hasSessionStub.resolves(true);
      isMediumGroupStub.returns(false);

      const events = ['success', 'fail'];
      for (const event of events) {
        if (event === 'success') {
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
        hasSessionStub.resolves(true);
        isMediumGroupStub.returns(false);
        sendStub.resolves();

        const device = TestUtils.generateFakePubKey();
        const message = TestUtils.generateChatMessage();
        await pendingMessageCache.add(device, message);

        const eventPromise = PromiseUtils.waitForTask<
          RawMessage | OpenGroupMessage
        >(complete => {
          messageQueueStub.events.once('success', complete);
        });

        await messageQueueStub.processPending(device);
        await expect(eventPromise).to.be.fulfilled;

        const rawMessage = await eventPromise;
        expect(rawMessage.identifier).to.equal(message.identifier);
      });

      it('should send a fail event if something went wrong while sending', async () => {
        hasSessionStub.resolves(true);
        isMediumGroupStub.returns(false);
        sendStub.throws(new Error('failure'));

        const spy = sandbox.spy();
        messageQueueStub.events.on('fail', spy);

        const device = TestUtils.generateFakePubKey();
        const message = TestUtils.generateChatMessage();
        await pendingMessageCache.add(device, message);

        const eventPromise = PromiseUtils.waitForTask<
          [RawMessage | OpenGroupMessage, Error]
        >(complete => {
          messageQueueStub.events.once('fail', (...args) => {
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

  describe('sendUsingMultiDevice', () => {
    it('should send the message to all the devices', async () => {
      const devices = TestUtils.generateFakePubKeys(3);
      sandbox.stub(MultiDeviceProtocol, 'getAllDevices').resolves(devices);
      const stub = sandbox
        .stub(messageQueueStub, 'sendMessageToDevices')
        .resolves();

      const message = TestUtils.generateChatMessage();
      await messageQueueStub.sendUsingMultiDevice(devices[0], message);

      const args = stub.lastCall.args as [Array<PubKey>, ContentMessage];
      expect(args[0]).to.have.same.members(devices);
      expect(args[1]).to.equal(message);
    });
  });

  describe('sendMessageToDevices', () => {
    it('can send to many devices', async () => {
      hasSessionStub.resolves(false);

      const devices = TestUtils.generateFakePubKeys(5);
      const message = TestUtils.generateChatMessage();

      await messageQueueStub.sendMessageToDevices(devices, message);
      expect(pendingMessageCache.getCache()).to.have.length(devices.length);
    });

    it('should send sync message if possible', async () => {
      hasSessionStub.returns(false);

      sandbox.stub(SyncMessageUtils, 'canSync').returns(true);

      sandbox
        .stub(SyncMessageUtils, 'from')
        .returns(new TestSyncMessage({ timestamp: Date.now() }));

      // This stub ensures that the message won't process
      const sendSyncMessageStub = sandbox
        .stub(messageQueueStub, 'sendSyncMessage')
        .resolves();

      const ourDevices = [ourDevice, ...TestUtils.generateFakePubKeys(2)];
      sandbox
        .stub(MultiDeviceProtocol, 'getAllDevices')
        .callsFake(async user => {
          if (ourDevice.isEqual(user)) {
            return ourDevices;
          }

          return [];
        });

      const devices = [...ourDevices, ...TestUtils.generateFakePubKeys(3)];
      const message = TestUtils.generateChatMessage();

      await messageQueueStub.sendMessageToDevices(devices, message);
      expect(sendSyncMessageStub.called).to.equal(
        true,
        'sendSyncMessage was not called.'
      );
      expect(
        pendingMessageCache.getCache().map(c => c.device)
      ).to.not.have.members(
        ourDevices.map(d => d.key),
        'Sending regular messages to our own device is not allowed.'
      );
      expect(pendingMessageCache.getCache()).to.have.length(
        devices.length - ourDevices.length,
        'Messages should not be sent to our devices.'
      );
    });
  });

  describe('sendSyncMessage', () => {
    it('should send a message to all our devices', async () => {
      hasSessionStub.resolves(false);

      const ourOtherDevices = TestUtils.generateFakePubKeys(2);
      const ourDevices = [ourDevice, ...ourOtherDevices];
      sandbox.stub(MultiDeviceProtocol, 'getAllDevices').resolves(ourDevices);

      await messageQueueStub.sendSyncMessage(
        new TestSyncMessage({ timestamp: Date.now() })
      );

      expect(pendingMessageCache.getCache()).to.have.length(
        ourOtherDevices.length
      );
      expect(pendingMessageCache.getCache().map(c => c.device)).to.have.members(
        ourOtherDevices.map(d => d.key)
      );
    });
  });

  describe('sendToGroup', () => {
    describe('closed groups', async () => {
      it('can send to closed group', async () => {
        const members = TestUtils.generateFakePubKeys(4).map(
          p => new PrimaryPubKey(p.key)
        );
        sandbox.stub(GroupUtils, 'getGroupMembers').resolves(members);

        const sendUsingMultiDeviceStub = sandbox
          .stub(messageQueueStub, 'sendUsingMultiDevice')
          .resolves();

        const message = TestUtils.generateClosedGroupMessage();
        const success = await messageQueueStub.sendToGroup(message);
        expect(success).to.equal(true, 'sending to group failed');
        expect(sendUsingMultiDeviceStub.callCount).to.equal(members.length);

        const arg = sendUsingMultiDeviceStub.getCall(0).args;
        expect(arg[1] instanceof ClosedGroupMessage).to.equal(
          true,
          'message sent to group member was not a ClosedGroupMessage'
        );
      });

      it('wont send message to empty closed group', async () => {
        sandbox.stub(GroupUtils, 'getGroupMembers').resolves([]);
        const sendUsingMultiDeviceStub = sandbox
          .stub(messageQueueStub, 'sendUsingMultiDevice')
          .resolves();

        const message = TestUtils.generateClosedGroupMessage();
        const response = await messageQueueStub.sendToGroup(message);

        expect(response).to.equal(
          false,
          'sendToGroup sent a message to an empty group'
        );
        expect(sendUsingMultiDeviceStub.callCount).to.equal(0);
      });
    });

    describe('open groups', async () => {
      let sendToOpenGroupStub: sinon.SinonStub<
        [OpenGroupMessage],
        Promise<boolean>
      >;
      beforeEach(() => {
        sendToOpenGroupStub = sandbox
          .stub(MessageSender, 'sendToOpenGroup')
          .resolves(true);
      });

      it('can send to open group', async () => {
        const message = TestUtils.generateOpenGroupMessage();
        const success = await messageQueueStub.sendToGroup(message);
        expect(sendToOpenGroupStub.callCount).to.equal(1);
        expect(success).to.equal(true, 'Sending to open group failed');
      });

      it('should emit a success event when send was successful', async () => {
        const message = TestUtils.generateOpenGroupMessage();
        const eventPromise = PromiseUtils.waitForTask(complete => {
          messageQueueStub.events.once('success', complete);
        }, 2000);

        await messageQueueStub.sendToGroup(message);
        await expect(eventPromise).to.be.fulfilled;
      });

      it('should emit a fail event if something went wrong', async () => {
        sendToOpenGroupStub.resolves(false);
        const message = TestUtils.generateOpenGroupMessage();
        const eventPromise = PromiseUtils.waitForTask(complete => {
          messageQueueStub.events.once('fail', complete);
        }, 2000);

        await messageQueueStub.sendToGroup(message);
        await expect(eventPromise).to.be.fulfilled;
      });
    });
  });
});
