/* eslint-disable consistent-return */
/* eslint-disable no-unused-expressions */
/* eslint-disable more/no-then */
/* eslint-disable no-loop-func */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-unreachable-loop */
/* eslint-disable no-restricted-syntax */
import { randomBytes } from 'crypto';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { describe } from 'mocha';
import Sinon, * as sinon from 'sinon';

import { ContentMessage } from '../../../../session/messages/outgoing';
import { ClosedGroupMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupMessage';
import { MessageSender } from '../../../../session/sending';
import { MessageQueue } from '../../../../session/sending/MessageQueue';
import { PubKey } from '../../../../session/types';
import { GroupUtils, PromiseUtils, UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';
import { PendingMessageCacheStub } from '../../../test-utils/stubs';

import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import { MessageSentHandler } from '../../../../session/sending/MessageSentHandler';
import { stubData } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('MessageQueue', () => {
  // Initialize new stubbed cache
  const ourDevice = TestUtils.generateFakePubKey();
  const ourNumber = ourDevice.key;

  // Initialize new stubbed queue
  let pendingMessageCache: PendingMessageCacheStub;
  let messageSentHandlerFailedStub: sinon.SinonStub;
  let messageSentHandlerSuccessStub: sinon.SinonStub;
  let messageSentPublicHandlerSuccessStub: sinon.SinonStub;
  let messageQueueStub: MessageQueue;

  // Message Sender Stubs
  let sendStub: sinon.SinonStub;

  beforeEach(() => {
    // Utils Stubs
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

    // Message Sender Stubs
    sendStub = Sinon.stub(MessageSender, 'send');
    messageSentHandlerFailedStub = Sinon.stub(
      MessageSentHandler,
      'handleMessageSentFailure'
    ).resolves();
    messageSentHandlerSuccessStub = Sinon.stub(
      MessageSentHandler,
      'handleMessageSentSuccess'
    ).resolves();
    messageSentPublicHandlerSuccessStub = Sinon.stub(
      MessageSentHandler,
      'handlePublicMessageSentSuccess'
    ).resolves();

    // Init Queue
    pendingMessageCache = new PendingMessageCacheStub();
    messageQueueStub = new MessageQueue(pendingMessageCache);
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('processPending', () => {
    it('will send messages', done => {
      const device = TestUtils.generateFakePubKey();

      const waitForMessageSentEvent = new Promise(resolve => {
        resolve(true);
        done();
      });

      void pendingMessageCache
        .add(device, TestUtils.generateVisibleMessage(), waitForMessageSentEvent as any)
        .then(async () => {
          return messageQueueStub.processPending(device);
        })
        .then(() => {
          expect(waitForMessageSentEvent).to.be.fulfilled;
        });
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
        await pendingMessageCache.add(
          device,
          TestUtils.generateVisibleMessage(),
          SnodeNamespaces.UserMessages
        );

        const initialMessages = await pendingMessageCache.getForDevice(device);
        expect(initialMessages).to.have.length(1);
        await messageQueueStub.processPending(device);

        const promise = PromiseUtils.waitUntil(async () => {
          const messages = await pendingMessageCache.getForDevice(device);
          return messages.length === 0;
        }, 100);
        return promise.should.be.fulfilled;
      }
    }).timeout(15000);

    describe('events', () => {
      it('should send a success event if message was sent', done => {
        stubData('getMessageById').resolves();
        const message = TestUtils.generateVisibleMessage();

        sendStub.resolves({ effectiveTimestamp: Date.now(), wrappedEnvelope: randomBytes(10) });
        const device = TestUtils.generateFakePubKey();
        Sinon.stub(MessageSender, 'getMinRetryTimeout').returns(10);
        const waitForMessageSentEvent = async () =>
          new Promise<void>(resolve => {
            resolve();
            try {
              expect(messageSentHandlerSuccessStub.callCount).to.be.equal(1);
              expect(messageSentHandlerSuccessStub.lastCall.args[0].identifier).to.be.equal(
                message.identifier
              );
              done();
            } catch (e) {
              done(e);
            }
          });

        void pendingMessageCache
          .add(device, message, SnodeNamespaces.UserMessages, waitForMessageSentEvent)
          .then(() => messageQueueStub.processPending(device));
      });

      it('should send a fail event if something went wrong while sending', async () => {
        sendStub.throws(new Error('failure'));

        const device = TestUtils.generateFakePubKey();
        const message = TestUtils.generateVisibleMessage();
        void pendingMessageCache
          .add(device, message, SnodeNamespaces.UserMessages)
          .then(() => messageQueueStub.processPending(device));
        // The cb is only invoke is all reties fails. Here we poll until the messageSentHandlerFailed was invoked as this is what we want to do

        return PromiseUtils.poll(done => {
          if (messageSentHandlerFailedStub.callCount === 1) {
            try {
              expect(messageSentHandlerFailedStub.callCount).to.be.equal(1);
              expect(messageSentHandlerFailedStub.lastCall.args[0].identifier).to.be.equal(
                message.identifier
              );
              expect(messageSentHandlerFailedStub.lastCall.args[1].message).to.equal('failure');
              done();
            } catch (e) {
              done(e);
            }
          }
        });
      });
    });
  });

  describe('sendToPubKey', () => {
    it('should send the message to the device', async () => {
      const device = TestUtils.generateFakePubKey();
      const stub = Sinon.stub(messageQueueStub as any, 'process').resolves();

      const message = TestUtils.generateVisibleMessage();
      await messageQueueStub.sendToPubKey(device, message, SnodeNamespaces.UserMessages);

      const args = stub.lastCall.args as [Array<PubKey>, ContentMessage];
      expect(args[0]).to.be.equal(device);
      expect(args[1]).to.equal(message);
    });
  });

  describe('sendToGroup', () => {
    it('should throw an error if invalid non-group message was passed', async () => {
      const chatMessage = TestUtils.generateVisibleMessage();
      return expect(
        messageQueueStub.sendToGroup({
          message: chatMessage as any,
          namespace: SnodeNamespaces.ClosedGroupMessage,
        })
      ).to.be.rejectedWith('Invalid group message passed in sendToGroup.');
    });

    describe('closed groups', () => {
      it('can send to closed group', async () => {
        const members = TestUtils.generateFakePubKeys(4);
        Sinon.stub(GroupUtils, 'getGroupMembers').returns(members);

        const send = Sinon.stub(messageQueueStub, 'sendToPubKey').resolves();

        const message = TestUtils.generateClosedGroupMessage();
        await messageQueueStub.sendToGroup({
          message,
          namespace: SnodeNamespaces.ClosedGroupMessage,
        });
        expect(send.callCount).to.equal(1);

        const arg = send.getCall(0).args;
        expect(arg[1] instanceof ClosedGroupMessage).to.equal(
          true,
          'message sent to group member was not a ClosedGroupMessage'
        );
      });

      describe('open groupsv2', () => {
        let sendToOpenGroupV2Stub: sinon.SinonStub;
        beforeEach(() => {
          sendToOpenGroupV2Stub = Sinon.stub(MessageSender, 'sendToOpenGroupV2').resolves(
            TestUtils.generateOpenGroupMessageV2()
          );
        });

        it('can send to open group', async () => {
          const message = TestUtils.generateOpenGroupVisibleMessage();
          const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();

          await messageQueueStub.sendToOpenGroupV2({
            message,
            roomInfos,
            blinded: false,
            filesToLink: [],
          });
          expect(sendToOpenGroupV2Stub.callCount).to.equal(1);
        });

        it('should emit a success event when send was successful', async () => {
          sendToOpenGroupV2Stub.resolves({
            serverId: 5125,
            sentTimestamp: 5127,
          });

          const message = TestUtils.generateOpenGroupVisibleMessage();
          const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();
          await messageQueueStub.sendToOpenGroupV2({
            message,
            roomInfos,
            blinded: false,
            filesToLink: [],
          });

          expect(messageSentPublicHandlerSuccessStub.callCount).to.equal(1);
          expect(messageSentPublicHandlerSuccessStub.lastCall.args[0]).to.equal(message.identifier);
          expect(messageSentPublicHandlerSuccessStub.lastCall.args[1].serverId).to.equal(5125);
          expect(messageSentPublicHandlerSuccessStub.lastCall.args[1].serverTimestamp).to.equal(
            5127
          );
        });

        it('should emit a fail event if something went wrong', async () => {
          sendToOpenGroupV2Stub.resolves({ serverId: -1, serverTimestamp: -1 });
          const message = TestUtils.generateOpenGroupVisibleMessage();
          const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();

          await messageQueueStub.sendToOpenGroupV2({
            message,
            roomInfos,
            blinded: false,
            filesToLink: [],
          });
          expect(messageSentHandlerFailedStub.callCount).to.equal(1);
          expect(messageSentHandlerFailedStub.lastCall.args[0].identifier).to.equal(
            message.identifier
          );
        });
      });
    });
  });
});
