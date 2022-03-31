var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var import_chai = __toESM(require("chai"));
var sinon = __toESM(require("sinon"));
var import_mocha = require("mocha");
var import_crypto = require("crypto");
var Data = __toESM(require("../../../../../ts/data/data"));
var import_utils = require("../../../../session/utils");
var import_test_utils = require("../../../../test/test-utils");
var import_MessageQueue = require("../../../../session/sending/MessageQueue");
var import_types = require("../../../../session/types");
var import_sending = require("../../../../session/sending");
var import_stubs = require("../../../test-utils/stubs");
var import_ClosedGroupMessage = require("../../../../session/messages/outgoing/controlMessage/group/ClosedGroupMessage");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
var import_MessageSentHandler = require("../../../../session/sending/MessageSentHandler");
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { expect } = import_chai.default;
(0, import_mocha.describe)("MessageQueue", () => {
  const sandbox = sinon.createSandbox();
  const ourDevice = import_test_utils.TestUtils.generateFakePubKey();
  const ourNumber = ourDevice.key;
  let pendingMessageCache;
  let messageSentHandlerFailedStub;
  let messageSentHandlerSuccessStub;
  let messageSentPublicHandlerSuccessStub;
  let messageQueueStub;
  let sendStub;
  beforeEach(() => {
    sandbox.stub(import_utils.UserUtils, "getOurPubKeyStrFromCache").returns(ourNumber);
    sendStub = sandbox.stub(import_sending.MessageSender, "send");
    messageSentHandlerFailedStub = sandbox.stub(import_MessageSentHandler.MessageSentHandler, "handleMessageSentFailure").resolves();
    messageSentHandlerSuccessStub = sandbox.stub(import_MessageSentHandler.MessageSentHandler, "handleMessageSentSuccess").resolves();
    messageSentPublicHandlerSuccessStub = sandbox.stub(import_MessageSentHandler.MessageSentHandler, "handlePublicMessageSentSuccess").resolves();
    pendingMessageCache = new import_stubs.PendingMessageCacheStub();
    messageQueueStub = new import_MessageQueue.MessageQueue(pendingMessageCache);
    import_test_utils.TestUtils.stubWindowLog();
  });
  afterEach(() => {
    import_test_utils.TestUtils.restoreStubs();
    sandbox.restore();
  });
  (0, import_mocha.describe)("processPending", () => {
    it("will send messages", (done) => {
      const device = import_test_utils.TestUtils.generateFakePubKey();
      const waitForMessageSentEvent = new Promise((resolve) => {
        resolve(true);
        done();
      });
      void pendingMessageCache.add(device, import_test_utils.TestUtils.generateVisibleMessage(), waitForMessageSentEvent).then(async () => {
        return messageQueueStub.processPending(device);
      }).then(() => {
        expect(waitForMessageSentEvent).to.be.fulfilled;
      });
    });
    it("should remove message from cache", async () => {
      const events = ["sendSuccess", "sendFail"];
      for (const event of events) {
        if (event === "sendSuccess") {
          sendStub.resolves();
        } else {
          sendStub.throws(new Error("fail"));
        }
        const device = import_test_utils.TestUtils.generateFakePubKey();
        await pendingMessageCache.add(device, import_test_utils.TestUtils.generateVisibleMessage());
        const initialMessages = await pendingMessageCache.getForDevice(device);
        expect(initialMessages).to.have.length(1);
        await messageQueueStub.processPending(device);
        const promise = import_utils.PromiseUtils.waitUntil(async () => {
          const messages = await pendingMessageCache.getForDevice(device);
          return messages.length === 0;
        }, 100);
        return promise.should.be.fulfilled;
      }
    }).timeout(15e3);
    (0, import_mocha.describe)("events", () => {
      it("should send a success event if message was sent", (done) => {
        sandbox.stub(Data, "getMessageById").resolves();
        const message = import_test_utils.TestUtils.generateVisibleMessage();
        sendStub.resolves({ effectiveTimestamp: Date.now(), wrappedEnvelope: (0, import_crypto.randomBytes)(10) });
        const device = import_test_utils.TestUtils.generateFakePubKey();
        sandbox.stub(import_sending.MessageSender, "getMinRetryTimeout").returns(10);
        const waitForMessageSentEvent = /* @__PURE__ */ __name(async () => new Promise((resolve) => {
          resolve();
          try {
            expect(messageSentHandlerSuccessStub.callCount).to.be.equal(1);
            expect(messageSentHandlerSuccessStub.lastCall.args[0].identifier).to.be.equal(message.identifier);
            done();
          } catch (e) {
            done(e);
          }
        }), "waitForMessageSentEvent");
        void pendingMessageCache.add(device, message, waitForMessageSentEvent).then(() => messageQueueStub.processPending(device));
      });
      it("should send a fail event if something went wrong while sending", async () => {
        sendStub.throws(new Error("failure"));
        const device = import_test_utils.TestUtils.generateFakePubKey();
        const message = import_test_utils.TestUtils.generateVisibleMessage();
        void pendingMessageCache.add(device, message).then(() => messageQueueStub.processPending(device));
        return import_utils.PromiseUtils.poll((done) => {
          if (messageSentHandlerFailedStub.callCount === 1) {
            try {
              expect(messageSentHandlerFailedStub.callCount).to.be.equal(1);
              expect(messageSentHandlerFailedStub.lastCall.args[0].identifier).to.be.equal(message.identifier);
              expect(messageSentHandlerFailedStub.lastCall.args[1].message).to.equal("failure");
              done();
            } catch (e) {
              done(e);
            }
          }
        });
      });
    });
  });
  (0, import_mocha.describe)("sendToPubKey", () => {
    it("should send the message to the device", async () => {
      const device = import_test_utils.TestUtils.generateFakePubKey();
      const stub = sandbox.stub(messageQueueStub, "process").resolves();
      const message = import_test_utils.TestUtils.generateVisibleMessage();
      await messageQueueStub.sendToPubKey(device, message);
      const args = stub.lastCall.args;
      expect(args[0]).to.be.equal(device);
      expect(args[1]).to.equal(message);
    });
  });
  (0, import_mocha.describe)("sendToGroup", () => {
    it("should throw an error if invalid non-group message was passed", async () => {
      const chatMessage = import_test_utils.TestUtils.generateVisibleMessage();
      return expect(messageQueueStub.sendToGroup(chatMessage)).to.be.rejectedWith("Invalid group message passed in sendToGroup.");
    });
    (0, import_mocha.describe)("closed groups", () => {
      it("can send to closed group", async () => {
        const members = import_test_utils.TestUtils.generateFakePubKeys(4).map((p) => new import_types.PubKey(p.key));
        sandbox.stub(import_utils.GroupUtils, "getGroupMembers").returns(members);
        const send = sandbox.stub(messageQueueStub, "sendToPubKey").resolves();
        const message = import_test_utils.TestUtils.generateClosedGroupMessage();
        await messageQueueStub.sendToGroup(message);
        expect(send.callCount).to.equal(1);
        const arg = send.getCall(0).args;
        expect(arg[1] instanceof import_ClosedGroupMessage.ClosedGroupMessage).to.equal(true, "message sent to group member was not a ClosedGroupMessage");
      });
      (0, import_mocha.describe)("open groupsv2", () => {
        let sendToOpenGroupV2Stub;
        beforeEach(() => {
          sendToOpenGroupV2Stub = sandbox.stub(import_sending.MessageSender, "sendToOpenGroupV2").resolves(import_test_utils.TestUtils.generateOpenGroupMessageV2());
        });
        it("can send to open group", async () => {
          const message = import_test_utils.TestUtils.generateOpenGroupVisibleMessage();
          const roomInfos = import_test_utils.TestUtils.generateOpenGroupV2RoomInfos();
          await messageQueueStub.sendToOpenGroupV2(message, roomInfos);
          expect(sendToOpenGroupV2Stub.callCount).to.equal(1);
        });
        it("should emit a success event when send was successful", async () => {
          sendToOpenGroupV2Stub.resolves({
            serverId: 5125,
            sentTimestamp: 5126
          });
          const message = import_test_utils.TestUtils.generateOpenGroupVisibleMessage();
          const roomInfos = import_test_utils.TestUtils.generateOpenGroupV2RoomInfos();
          await messageQueueStub.sendToOpenGroupV2(message, roomInfos);
          expect(messageSentPublicHandlerSuccessStub.callCount).to.equal(1);
          expect(messageSentPublicHandlerSuccessStub.lastCall.args[0].identifier).to.equal(message.identifier);
          expect(messageSentPublicHandlerSuccessStub.lastCall.args[1].serverId).to.equal(5125);
          expect(messageSentPublicHandlerSuccessStub.lastCall.args[1].serverTimestamp).to.equal(5126);
        });
        it("should emit a fail event if something went wrong", async () => {
          sendToOpenGroupV2Stub.resolves({ serverId: -1, serverTimestamp: -1 });
          const message = import_test_utils.TestUtils.generateOpenGroupVisibleMessage();
          const roomInfos = import_test_utils.TestUtils.generateOpenGroupV2RoomInfos();
          await messageQueueStub.sendToOpenGroupV2(message, roomInfos);
          expect(messageSentHandlerFailedStub.callCount).to.equal(1);
          expect(messageSentHandlerFailedStub.lastCall.args[0].identifier).to.equal(message.identifier);
        });
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvc2VuZGluZy9NZXNzYWdlUXVldWVfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gdHNsaW50OmRpc2FibGU6IG5vLWltcGxpY2l0LWRlcGVuZGVuY2llcyBtYXgtZnVuYy1ib2R5LWxlbmd0aCBuby11bnVzZWQtZXhwcmVzc2lvblxuXG5pbXBvcnQgY2hhaSBmcm9tICdjaGFpJztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IGRlc2NyaWJlIH0gZnJvbSAnbW9jaGEnO1xuaW1wb3J0IHsgcmFuZG9tQnl0ZXMgfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0ICogYXMgRGF0YSBmcm9tICcuLi8uLi8uLi8uLi8uLi90cy9kYXRhL2RhdGEnO1xuXG5pbXBvcnQgeyBHcm91cFV0aWxzLCBQcm9taXNlVXRpbHMsIFVzZXJVdGlscyB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdXRpbHMnO1xuaW1wb3J0IHsgVGVzdFV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC90ZXN0LXV0aWxzJztcbmltcG9ydCB7IE1lc3NhZ2VRdWV1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vc2VuZGluZy9NZXNzYWdlUXVldWUnO1xuaW1wb3J0IHsgQ29udGVudE1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL21lc3NhZ2VzL291dGdvaW5nJztcbmltcG9ydCB7IFB1YktleSwgUmF3TWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdHlwZXMnO1xuaW1wb3J0IHsgTWVzc2FnZVNlbmRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vc2VuZGluZyc7XG5pbXBvcnQgeyBQZW5kaW5nTWVzc2FnZUNhY2hlU3R1YiB9IGZyb20gJy4uLy4uLy4uL3Rlc3QtdXRpbHMvc3R1YnMnO1xuaW1wb3J0IHsgQ2xvc2VkR3JvdXBNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9tZXNzYWdlcy9vdXRnb2luZy9jb250cm9sTWVzc2FnZS9ncm91cC9DbG9zZWRHcm91cE1lc3NhZ2UnO1xuXG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgeyBNZXNzYWdlU2VudEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL3NlbmRpbmcvTWVzc2FnZVNlbnRIYW5kbGVyJztcblxuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQgYXMgYW55KTtcbmNoYWkuc2hvdWxkKCk7XG5cbmNvbnN0IHsgZXhwZWN0IH0gPSBjaGFpO1xuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1mdW5jLWJvZHktbGVuZ3RoXG5kZXNjcmliZSgnTWVzc2FnZVF1ZXVlJywgKCkgPT4ge1xuICAvLyBJbml0aWFsaXplIG5ldyBzdHViYmVkIGNhY2hlXG4gIGNvbnN0IHNhbmRib3ggPSBzaW5vbi5jcmVhdGVTYW5kYm94KCk7XG4gIGNvbnN0IG91ckRldmljZSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgY29uc3Qgb3VyTnVtYmVyID0gb3VyRGV2aWNlLmtleTtcblxuICAvLyBJbml0aWFsaXplIG5ldyBzdHViYmVkIHF1ZXVlXG4gIGxldCBwZW5kaW5nTWVzc2FnZUNhY2hlOiBQZW5kaW5nTWVzc2FnZUNhY2hlU3R1YjtcbiAgbGV0IG1lc3NhZ2VTZW50SGFuZGxlckZhaWxlZFN0dWI6IHNpbm9uLlNpbm9uU3R1YjtcbiAgbGV0IG1lc3NhZ2VTZW50SGFuZGxlclN1Y2Nlc3NTdHViOiBzaW5vbi5TaW5vblN0dWI7XG4gIGxldCBtZXNzYWdlU2VudFB1YmxpY0hhbmRsZXJTdWNjZXNzU3R1Yjogc2lub24uU2lub25TdHViO1xuICBsZXQgbWVzc2FnZVF1ZXVlU3R1YjogTWVzc2FnZVF1ZXVlO1xuXG4gIC8vIE1lc3NhZ2UgU2VuZGVyIFN0dWJzXG4gIGxldCBzZW5kU3R1Yjogc2lub24uU2lub25TdHViPFtcbiAgICBSYXdNZXNzYWdlLFxuICAgIChudW1iZXIgfCB1bmRlZmluZWQpPyxcbiAgICAobnVtYmVyIHwgdW5kZWZpbmVkKT8sXG4gICAgKGJvb2xlYW4gfCB1bmRlZmluZWQpP1xuICBdPjtcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAvLyBVdGlscyBTdHVic1xuICAgIHNhbmRib3guc3R1YihVc2VyVXRpbHMsICdnZXRPdXJQdWJLZXlTdHJGcm9tQ2FjaGUnKS5yZXR1cm5zKG91ck51bWJlcik7XG5cbiAgICAvLyBNZXNzYWdlIFNlbmRlciBTdHVic1xuICAgIHNlbmRTdHViID0gc2FuZGJveC5zdHViKE1lc3NhZ2VTZW5kZXIsICdzZW5kJyk7XG4gICAgbWVzc2FnZVNlbnRIYW5kbGVyRmFpbGVkU3R1YiA9IHNhbmRib3hcbiAgICAgIC5zdHViKE1lc3NhZ2VTZW50SGFuZGxlciBhcyBhbnksICdoYW5kbGVNZXNzYWdlU2VudEZhaWx1cmUnKVxuICAgICAgLnJlc29sdmVzKCk7XG4gICAgbWVzc2FnZVNlbnRIYW5kbGVyU3VjY2Vzc1N0dWIgPSBzYW5kYm94XG4gICAgICAuc3R1YihNZXNzYWdlU2VudEhhbmRsZXIgYXMgYW55LCAnaGFuZGxlTWVzc2FnZVNlbnRTdWNjZXNzJylcbiAgICAgIC5yZXNvbHZlcygpO1xuICAgIG1lc3NhZ2VTZW50UHVibGljSGFuZGxlclN1Y2Nlc3NTdHViID0gc2FuZGJveFxuICAgICAgLnN0dWIoTWVzc2FnZVNlbnRIYW5kbGVyIGFzIGFueSwgJ2hhbmRsZVB1YmxpY01lc3NhZ2VTZW50U3VjY2VzcycpXG4gICAgICAucmVzb2x2ZXMoKTtcblxuICAgIC8vIEluaXQgUXVldWVcbiAgICBwZW5kaW5nTWVzc2FnZUNhY2hlID0gbmV3IFBlbmRpbmdNZXNzYWdlQ2FjaGVTdHViKCk7XG4gICAgbWVzc2FnZVF1ZXVlU3R1YiA9IG5ldyBNZXNzYWdlUXVldWUocGVuZGluZ01lc3NhZ2VDYWNoZSk7XG4gICAgVGVzdFV0aWxzLnN0dWJXaW5kb3dMb2coKTtcbiAgfSk7XG5cbiAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICBUZXN0VXRpbHMucmVzdG9yZVN0dWJzKCk7XG4gICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdwcm9jZXNzUGVuZGluZycsICgpID0+IHtcbiAgICBpdCgnd2lsbCBzZW5kIG1lc3NhZ2VzJywgZG9uZSA9PiB7XG4gICAgICBjb25zdCBkZXZpY2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG5cbiAgICAgIGNvbnN0IHdhaXRGb3JNZXNzYWdlU2VudEV2ZW50ID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgIGRvbmUoKTtcbiAgICAgIH0pO1xuXG4gICAgICB2b2lkIHBlbmRpbmdNZXNzYWdlQ2FjaGVcbiAgICAgICAgLmFkZChkZXZpY2UsIFRlc3RVdGlscy5nZW5lcmF0ZVZpc2libGVNZXNzYWdlKCksIHdhaXRGb3JNZXNzYWdlU2VudEV2ZW50IGFzIGFueSlcbiAgICAgICAgLnRoZW4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBtZXNzYWdlUXVldWVTdHViLnByb2Nlc3NQZW5kaW5nKGRldmljZSk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICBleHBlY3Qod2FpdEZvck1lc3NhZ2VTZW50RXZlbnQpLnRvLmJlLmZ1bGZpbGxlZDtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJlbW92ZSBtZXNzYWdlIGZyb20gY2FjaGUnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudHMgPSBbJ3NlbmRTdWNjZXNzJywgJ3NlbmRGYWlsJ107XG4gICAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cykge1xuICAgICAgICBpZiAoZXZlbnQgPT09ICdzZW5kU3VjY2VzcycpIHtcbiAgICAgICAgICBzZW5kU3R1Yi5yZXNvbHZlcygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbmRTdHViLnRocm93cyhuZXcgRXJyb3IoJ2ZhaWwnKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZXZpY2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG4gICAgICAgIGF3YWl0IHBlbmRpbmdNZXNzYWdlQ2FjaGUuYWRkKGRldmljZSwgVGVzdFV0aWxzLmdlbmVyYXRlVmlzaWJsZU1lc3NhZ2UoKSk7XG5cbiAgICAgICAgY29uc3QgaW5pdGlhbE1lc3NhZ2VzID0gYXdhaXQgcGVuZGluZ01lc3NhZ2VDYWNoZS5nZXRGb3JEZXZpY2UoZGV2aWNlKTtcbiAgICAgICAgZXhwZWN0KGluaXRpYWxNZXNzYWdlcykudG8uaGF2ZS5sZW5ndGgoMSk7XG4gICAgICAgIGF3YWl0IG1lc3NhZ2VRdWV1ZVN0dWIucHJvY2Vzc1BlbmRpbmcoZGV2aWNlKTtcblxuICAgICAgICBjb25zdCBwcm9taXNlID0gUHJvbWlzZVV0aWxzLndhaXRVbnRpbChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZXMgPSBhd2FpdCBwZW5kaW5nTWVzc2FnZUNhY2hlLmdldEZvckRldmljZShkZXZpY2UpO1xuICAgICAgICAgIHJldHVybiBtZXNzYWdlcy5sZW5ndGggPT09IDA7XG4gICAgICAgIH0sIDEwMCk7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnNob3VsZC5iZS5mdWxmaWxsZWQ7XG4gICAgICB9XG4gICAgfSkudGltZW91dCgxNTAwMCk7XG5cbiAgICBkZXNjcmliZSgnZXZlbnRzJywgKCkgPT4ge1xuICAgICAgaXQoJ3Nob3VsZCBzZW5kIGEgc3VjY2VzcyBldmVudCBpZiBtZXNzYWdlIHdhcyBzZW50JywgZG9uZSA9PiB7XG4gICAgICAgIHNhbmRib3guc3R1YihEYXRhLCAnZ2V0TWVzc2FnZUJ5SWQnKS5yZXNvbHZlcygpO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gVGVzdFV0aWxzLmdlbmVyYXRlVmlzaWJsZU1lc3NhZ2UoKTtcblxuICAgICAgICBzZW5kU3R1Yi5yZXNvbHZlcyh7IGVmZmVjdGl2ZVRpbWVzdGFtcDogRGF0ZS5ub3coKSwgd3JhcHBlZEVudmVsb3BlOiByYW5kb21CeXRlcygxMCkgfSk7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgICAgc2FuZGJveC5zdHViKE1lc3NhZ2VTZW5kZXIsICdnZXRNaW5SZXRyeVRpbWVvdXQnKS5yZXR1cm5zKDEwKTtcbiAgICAgICAgY29uc3Qgd2FpdEZvck1lc3NhZ2VTZW50RXZlbnQgPSBhc3luYyAoKSA9PlxuICAgICAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZXhwZWN0KG1lc3NhZ2VTZW50SGFuZGxlclN1Y2Nlc3NTdHViLmNhbGxDb3VudCkudG8uYmUuZXF1YWwoMSk7XG4gICAgICAgICAgICAgIGV4cGVjdChtZXNzYWdlU2VudEhhbmRsZXJTdWNjZXNzU3R1Yi5sYXN0Q2FsbC5hcmdzWzBdLmlkZW50aWZpZXIpLnRvLmJlLmVxdWFsKFxuICAgICAgICAgICAgICAgIG1lc3NhZ2UuaWRlbnRpZmllclxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGRvbmUoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgdm9pZCBwZW5kaW5nTWVzc2FnZUNhY2hlXG4gICAgICAgICAgLmFkZChkZXZpY2UsIG1lc3NhZ2UsIHdhaXRGb3JNZXNzYWdlU2VudEV2ZW50KVxuICAgICAgICAgIC50aGVuKCgpID0+IG1lc3NhZ2VRdWV1ZVN0dWIucHJvY2Vzc1BlbmRpbmcoZGV2aWNlKSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBzZW5kIGEgZmFpbCBldmVudCBpZiBzb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBzZW5kaW5nJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBzZW5kU3R1Yi50aHJvd3MobmV3IEVycm9yKCdmYWlsdXJlJykpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IFRlc3RVdGlscy5nZW5lcmF0ZVZpc2libGVNZXNzYWdlKCk7XG4gICAgICAgIHZvaWQgcGVuZGluZ01lc3NhZ2VDYWNoZVxuICAgICAgICAgIC5hZGQoZGV2aWNlLCBtZXNzYWdlKVxuICAgICAgICAgIC50aGVuKCgpID0+IG1lc3NhZ2VRdWV1ZVN0dWIucHJvY2Vzc1BlbmRpbmcoZGV2aWNlKSk7XG4gICAgICAgIC8vIFRoZSBjYiBpcyBvbmx5IGludm9rZSBpcyBhbGwgcmV0aWVzIGZhaWxzLiBIZXJlIHdlIHBvbGwgdW50aWwgdGhlIG1lc3NhZ2VTZW50SGFuZGxlckZhaWxlZCB3YXMgaW52b2tlZCBhcyB0aGlzIGlzIHdoYXQgd2Ugd2FudCB0byBkb1xuXG4gICAgICAgIHJldHVybiBQcm9taXNlVXRpbHMucG9sbChkb25lID0+IHtcbiAgICAgICAgICBpZiAobWVzc2FnZVNlbnRIYW5kbGVyRmFpbGVkU3R1Yi5jYWxsQ291bnQgPT09IDEpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGV4cGVjdChtZXNzYWdlU2VudEhhbmRsZXJGYWlsZWRTdHViLmNhbGxDb3VudCkudG8uYmUuZXF1YWwoMSk7XG4gICAgICAgICAgICAgIGV4cGVjdChtZXNzYWdlU2VudEhhbmRsZXJGYWlsZWRTdHViLmxhc3RDYWxsLmFyZ3NbMF0uaWRlbnRpZmllcikudG8uYmUuZXF1YWwoXG4gICAgICAgICAgICAgICAgbWVzc2FnZS5pZGVudGlmaWVyXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGV4cGVjdChtZXNzYWdlU2VudEhhbmRsZXJGYWlsZWRTdHViLmxhc3RDYWxsLmFyZ3NbMV0ubWVzc2FnZSkudG8uZXF1YWwoJ2ZhaWx1cmUnKTtcbiAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBkb25lKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3NlbmRUb1B1YktleScsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHNlbmQgdGhlIG1lc3NhZ2UgdG8gdGhlIGRldmljZScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGRldmljZSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgIGNvbnN0IHN0dWIgPSBzYW5kYm94LnN0dWIobWVzc2FnZVF1ZXVlU3R1YiBhcyBhbnksICdwcm9jZXNzJykucmVzb2x2ZXMoKTtcblxuICAgICAgY29uc3QgbWVzc2FnZSA9IFRlc3RVdGlscy5nZW5lcmF0ZVZpc2libGVNZXNzYWdlKCk7XG4gICAgICBhd2FpdCBtZXNzYWdlUXVldWVTdHViLnNlbmRUb1B1YktleShkZXZpY2UsIG1lc3NhZ2UpO1xuXG4gICAgICBjb25zdCBhcmdzID0gc3R1Yi5sYXN0Q2FsbC5hcmdzIGFzIFtBcnJheTxQdWJLZXk+LCBDb250ZW50TWVzc2FnZV07XG4gICAgICBleHBlY3QoYXJnc1swXSkudG8uYmUuZXF1YWwoZGV2aWNlKTtcbiAgICAgIGV4cGVjdChhcmdzWzFdKS50by5lcXVhbChtZXNzYWdlKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3NlbmRUb0dyb3VwJywgKCkgPT4ge1xuICAgIGl0KCdzaG91bGQgdGhyb3cgYW4gZXJyb3IgaWYgaW52YWxpZCBub24tZ3JvdXAgbWVzc2FnZSB3YXMgcGFzc2VkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY2hhdE1lc3NhZ2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVWaXNpYmxlTWVzc2FnZSgpO1xuICAgICAgcmV0dXJuIGV4cGVjdChtZXNzYWdlUXVldWVTdHViLnNlbmRUb0dyb3VwKGNoYXRNZXNzYWdlIGFzIGFueSkpLnRvLmJlLnJlamVjdGVkV2l0aChcbiAgICAgICAgJ0ludmFsaWQgZ3JvdXAgbWVzc2FnZSBwYXNzZWQgaW4gc2VuZFRvR3JvdXAuJ1xuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGRlc2NyaWJlKCdjbG9zZWQgZ3JvdXBzJywgKCkgPT4ge1xuICAgICAgaXQoJ2NhbiBzZW5kIHRvIGNsb3NlZCBncm91cCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgbWVtYmVycyA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXlzKDQpLm1hcChwID0+IG5ldyBQdWJLZXkocC5rZXkpKTtcbiAgICAgICAgc2FuZGJveC5zdHViKEdyb3VwVXRpbHMsICdnZXRHcm91cE1lbWJlcnMnKS5yZXR1cm5zKG1lbWJlcnMpO1xuXG4gICAgICAgIGNvbnN0IHNlbmQgPSBzYW5kYm94LnN0dWIobWVzc2FnZVF1ZXVlU3R1YiwgJ3NlbmRUb1B1YktleScpLnJlc29sdmVzKCk7XG5cbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IFRlc3RVdGlscy5nZW5lcmF0ZUNsb3NlZEdyb3VwTWVzc2FnZSgpO1xuICAgICAgICBhd2FpdCBtZXNzYWdlUXVldWVTdHViLnNlbmRUb0dyb3VwKG1lc3NhZ2UpO1xuICAgICAgICBleHBlY3Qoc2VuZC5jYWxsQ291bnQpLnRvLmVxdWFsKDEpO1xuXG4gICAgICAgIGNvbnN0IGFyZyA9IHNlbmQuZ2V0Q2FsbCgwKS5hcmdzO1xuICAgICAgICBleHBlY3QoYXJnWzFdIGluc3RhbmNlb2YgQ2xvc2VkR3JvdXBNZXNzYWdlKS50by5lcXVhbChcbiAgICAgICAgICB0cnVlLFxuICAgICAgICAgICdtZXNzYWdlIHNlbnQgdG8gZ3JvdXAgbWVtYmVyIHdhcyBub3QgYSBDbG9zZWRHcm91cE1lc3NhZ2UnXG4gICAgICAgICk7XG4gICAgICB9KTtcblxuICAgICAgZGVzY3JpYmUoJ29wZW4gZ3JvdXBzdjInLCAoKSA9PiB7XG4gICAgICAgIGxldCBzZW5kVG9PcGVuR3JvdXBWMlN0dWI6IHNpbm9uLlNpbm9uU3R1YjtcbiAgICAgICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2VuZFRvT3Blbkdyb3VwVjJTdHViID0gc2FuZGJveFxuICAgICAgICAgICAgLnN0dWIoTWVzc2FnZVNlbmRlciwgJ3NlbmRUb09wZW5Hcm91cFYyJylcbiAgICAgICAgICAgIC5yZXNvbHZlcyhUZXN0VXRpbHMuZ2VuZXJhdGVPcGVuR3JvdXBNZXNzYWdlVjIoKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCdjYW4gc2VuZCB0byBvcGVuIGdyb3VwJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVPcGVuR3JvdXBWaXNpYmxlTWVzc2FnZSgpO1xuICAgICAgICAgIGNvbnN0IHJvb21JbmZvcyA9IFRlc3RVdGlscy5nZW5lcmF0ZU9wZW5Hcm91cFYyUm9vbUluZm9zKCk7XG5cbiAgICAgICAgICBhd2FpdCBtZXNzYWdlUXVldWVTdHViLnNlbmRUb09wZW5Hcm91cFYyKG1lc3NhZ2UsIHJvb21JbmZvcyk7XG4gICAgICAgICAgZXhwZWN0KHNlbmRUb09wZW5Hcm91cFYyU3R1Yi5jYWxsQ291bnQpLnRvLmVxdWFsKDEpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpdCgnc2hvdWxkIGVtaXQgYSBzdWNjZXNzIGV2ZW50IHdoZW4gc2VuZCB3YXMgc3VjY2Vzc2Z1bCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBzZW5kVG9PcGVuR3JvdXBWMlN0dWIucmVzb2x2ZXMoe1xuICAgICAgICAgICAgc2VydmVySWQ6IDUxMjUsXG4gICAgICAgICAgICBzZW50VGltZXN0YW1wOiA1MTI2LFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IFRlc3RVdGlscy5nZW5lcmF0ZU9wZW5Hcm91cFZpc2libGVNZXNzYWdlKCk7XG4gICAgICAgICAgY29uc3Qgcm9vbUluZm9zID0gVGVzdFV0aWxzLmdlbmVyYXRlT3Blbkdyb3VwVjJSb29tSW5mb3MoKTtcbiAgICAgICAgICBhd2FpdCBtZXNzYWdlUXVldWVTdHViLnNlbmRUb09wZW5Hcm91cFYyKG1lc3NhZ2UsIHJvb21JbmZvcyk7XG4gICAgICAgICAgZXhwZWN0KG1lc3NhZ2VTZW50UHVibGljSGFuZGxlclN1Y2Nlc3NTdHViLmNhbGxDb3VudCkudG8uZXF1YWwoMSk7XG4gICAgICAgICAgZXhwZWN0KG1lc3NhZ2VTZW50UHVibGljSGFuZGxlclN1Y2Nlc3NTdHViLmxhc3RDYWxsLmFyZ3NbMF0uaWRlbnRpZmllcikudG8uZXF1YWwoXG4gICAgICAgICAgICBtZXNzYWdlLmlkZW50aWZpZXJcbiAgICAgICAgICApO1xuICAgICAgICAgIGV4cGVjdChtZXNzYWdlU2VudFB1YmxpY0hhbmRsZXJTdWNjZXNzU3R1Yi5sYXN0Q2FsbC5hcmdzWzFdLnNlcnZlcklkKS50by5lcXVhbCg1MTI1KTtcbiAgICAgICAgICBleHBlY3QobWVzc2FnZVNlbnRQdWJsaWNIYW5kbGVyU3VjY2Vzc1N0dWIubGFzdENhbGwuYXJnc1sxXS5zZXJ2ZXJUaW1lc3RhbXApLnRvLmVxdWFsKFxuICAgICAgICAgICAgNTEyNlxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCdzaG91bGQgZW1pdCBhIGZhaWwgZXZlbnQgaWYgc29tZXRoaW5nIHdlbnQgd3JvbmcnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgc2VuZFRvT3Blbkdyb3VwVjJTdHViLnJlc29sdmVzKHsgc2VydmVySWQ6IC0xLCBzZXJ2ZXJUaW1lc3RhbXA6IC0xIH0pO1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVPcGVuR3JvdXBWaXNpYmxlTWVzc2FnZSgpO1xuICAgICAgICAgIGNvbnN0IHJvb21JbmZvcyA9IFRlc3RVdGlscy5nZW5lcmF0ZU9wZW5Hcm91cFYyUm9vbUluZm9zKCk7XG5cbiAgICAgICAgICBhd2FpdCBtZXNzYWdlUXVldWVTdHViLnNlbmRUb09wZW5Hcm91cFYyKG1lc3NhZ2UsIHJvb21JbmZvcyk7XG4gICAgICAgICAgZXhwZWN0KG1lc3NhZ2VTZW50SGFuZGxlckZhaWxlZFN0dWIuY2FsbENvdW50KS50by5lcXVhbCgxKTtcbiAgICAgICAgICBleHBlY3QobWVzc2FnZVNlbnRIYW5kbGVyRmFpbGVkU3R1Yi5sYXN0Q2FsbC5hcmdzWzBdLmlkZW50aWZpZXIpLnRvLmVxdWFsKFxuICAgICAgICAgICAgbWVzc2FnZS5pZGVudGlmaWVyXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxrQkFBaUI7QUFDakIsWUFBdUI7QUFDdkIsbUJBQXlCO0FBQ3pCLG9CQUE0QjtBQUM1QixXQUFzQjtBQUV0QixtQkFBb0Q7QUFDcEQsd0JBQTBCO0FBQzFCLDBCQUE2QjtBQUU3QixtQkFBbUM7QUFDbkMscUJBQThCO0FBQzlCLG1CQUF3QztBQUN4QyxnQ0FBbUM7QUFFbkMsOEJBQTJCO0FBQzNCLGdDQUFtQztBQUVuQyxvQkFBSyxJQUFJLCtCQUFxQjtBQUM5QixvQkFBSyxPQUFPO0FBRVosTUFBTSxFQUFFLFdBQVc7QUFHbkIsMkJBQVMsZ0JBQWdCLE1BQU07QUFFN0IsUUFBTSxVQUFVLE1BQU0sY0FBYztBQUNwQyxRQUFNLFlBQVksNEJBQVUsbUJBQW1CO0FBQy9DLFFBQU0sWUFBWSxVQUFVO0FBRzVCLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBR0osTUFBSTtBQU9KLGFBQVcsTUFBTTtBQUVmLFlBQVEsS0FBSyx3QkFBVywwQkFBMEIsRUFBRSxRQUFRLFNBQVM7QUFHckUsZUFBVyxR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
