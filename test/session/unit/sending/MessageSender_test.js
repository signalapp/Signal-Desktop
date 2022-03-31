var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var import_chai = require("chai");
var crypto = __toESM(require("crypto"));
var sinon = __toESM(require("sinon"));
var import_sending = require("../../../../session/sending");
var import_test_utils = require("../../../test-utils");
var import_crypto = require("../../../../session/crypto");
var import_protobuf = require("../../../../protobuf");
var import_utils = require("../../../../session/utils");
var import_opengroupV2 = require("../../../../session/apis/open_group_api/opengroupV2");
var Data = __toESM(require("../../../../../ts/data/data"));
var import_snode_api = require("../../../../session/apis/snode_api");
var import_lodash = __toESM(require("lodash"));
describe("MessageSender", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
    import_test_utils.TestUtils.restoreStubs();
  });
  beforeEach(() => {
    import_test_utils.TestUtils.stubWindowLog();
  });
  describe("send", () => {
    const ourNumber = "0123456789abcdef";
    let sessionMessageAPISendStub;
    let encryptStub;
    beforeEach(() => {
      sessionMessageAPISendStub = sandbox.stub(import_sending.MessageSender, "TEST_sendMessageToSnode").resolves();
      sandbox.stub(Data, "getMessageById").resolves();
      encryptStub = sandbox.stub(import_crypto.MessageEncrypter, "encrypt").resolves({
        envelopeType: import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE,
        cipherText: crypto.randomBytes(10)
      });
      sandbox.stub(import_utils.UserUtils, "getOurPubKeyStrFromCache").returns(ourNumber);
    });
    describe("retry", () => {
      let rawMessage;
      beforeEach(async () => {
        rawMessage = await import_utils.MessageUtils.toRawMessage(import_test_utils.TestUtils.generateFakePubKey(), import_test_utils.TestUtils.generateVisibleMessage());
      });
      it("should not retry if an error occurred during encryption", async () => {
        encryptStub.throws(new Error("Failed to encrypt."));
        const promise = import_sending.MessageSender.send(rawMessage, 3, 10);
        await (0, import_chai.expect)(promise).is.rejectedWith("Failed to encrypt.");
        (0, import_chai.expect)(sessionMessageAPISendStub.callCount).to.equal(0);
      });
      it("should only call lokiMessageAPI once if no errors occured", async () => {
        await import_sending.MessageSender.send(rawMessage, 3, 10);
        (0, import_chai.expect)(sessionMessageAPISendStub.callCount).to.equal(1);
      });
      it("should only retry the specified amount of times before throwing", async () => {
        sessionMessageAPISendStub.throws(new Error("API error"));
        const attempts = 2;
        const promise = import_sending.MessageSender.send(rawMessage, attempts, 10);
        await (0, import_chai.expect)(promise).is.rejectedWith("API error");
        (0, import_chai.expect)(sessionMessageAPISendStub.callCount).to.equal(attempts);
      });
      it("should not throw error if successful send occurs within the retry limit", async () => {
        sessionMessageAPISendStub.onFirstCall().throws(new Error("API error"));
        await import_sending.MessageSender.send(rawMessage, 3, 10);
        (0, import_chai.expect)(sessionMessageAPISendStub.callCount).to.equal(2);
      });
    });
    describe("logic", () => {
      let messageEncyrptReturnEnvelopeType = import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE;
      beforeEach(() => {
        encryptStub.callsFake(async (_device, plainTextBuffer, _type) => ({
          envelopeType: messageEncyrptReturnEnvelopeType,
          cipherText: plainTextBuffer
        }));
      });
      it("should pass the correct values to lokiMessageAPI", async () => {
        const device = import_test_utils.TestUtils.generateFakePubKey();
        const visibleMessage = import_test_utils.TestUtils.generateVisibleMessage();
        const rawMessage = await import_utils.MessageUtils.toRawMessage(device, visibleMessage);
        await import_sending.MessageSender.send(rawMessage, 3, 10);
        const args = sessionMessageAPISendStub.getCall(0).args;
        (0, import_chai.expect)(args[0]).to.equal(device.key);
        (0, import_chai.expect)(args[2]).to.equal(visibleMessage.ttl());
      });
      it("should correctly build the envelope and override the timestamp", async () => {
        var _a, _b, _c;
        messageEncyrptReturnEnvelopeType = import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE;
        const device = import_test_utils.TestUtils.generateFakePubKey();
        const visibleMessage = import_test_utils.TestUtils.generateVisibleMessage();
        const rawMessage = await import_utils.MessageUtils.toRawMessage(device, visibleMessage);
        const offset = 2e5;
        sandbox.stub(import_snode_api.SNodeAPI, "getLatestTimestampOffset").returns(offset);
        await import_sending.MessageSender.send(rawMessage, 3, 10);
        const data = sessionMessageAPISendStub.getCall(0).args[1];
        const webSocketMessage = import_protobuf.SignalService.WebSocketMessage.decode(data);
        (0, import_chai.expect)((_a = webSocketMessage.request) == null ? void 0 : _a.body).to.not.equal(void 0, "Request body should not be undefined");
        (0, import_chai.expect)((_b = webSocketMessage.request) == null ? void 0 : _b.body).to.not.equal(null, "Request body should not be null");
        const envelope = import_protobuf.SignalService.Envelope.decode((_c = webSocketMessage.request) == null ? void 0 : _c.body);
        (0, import_chai.expect)(envelope.type).to.equal(import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE);
        (0, import_chai.expect)(envelope.source).to.equal("");
        const expectedTimestamp = Date.now() - offset;
        const decodedTimestampFromSending = import_lodash.default.toNumber(envelope.timestamp);
        (0, import_chai.expect)(decodedTimestampFromSending).to.be.above(expectedTimestamp - 10);
        (0, import_chai.expect)(decodedTimestampFromSending).to.be.below(expectedTimestamp + 10);
        const visibleMessageExpected = import_test_utils.TestUtils.generateVisibleMessage({
          timestamp: decodedTimestampFromSending
        });
        const rawMessageExpected = await import_utils.MessageUtils.toRawMessage(device, visibleMessageExpected);
        (0, import_chai.expect)(envelope.content).to.deep.equal(rawMessageExpected.plainTextBuffer);
      });
      describe("SESSION_MESSAGE", () => {
        it("should set the envelope source to be empty", async () => {
          var _a, _b, _c;
          messageEncyrptReturnEnvelopeType = import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE;
          const device = import_test_utils.TestUtils.generateFakePubKey();
          const visibleMessage = import_test_utils.TestUtils.generateVisibleMessage();
          const rawMessage = await import_utils.MessageUtils.toRawMessage(device, visibleMessage);
          await import_sending.MessageSender.send(rawMessage, 3, 10);
          const data = sessionMessageAPISendStub.getCall(0).args[1];
          const webSocketMessage = import_protobuf.SignalService.WebSocketMessage.decode(data);
          (0, import_chai.expect)((_a = webSocketMessage.request) == null ? void 0 : _a.body).to.not.equal(void 0, "Request body should not be undefined");
          (0, import_chai.expect)((_b = webSocketMessage.request) == null ? void 0 : _b.body).to.not.equal(null, "Request body should not be null");
          const envelope = import_protobuf.SignalService.Envelope.decode((_c = webSocketMessage.request) == null ? void 0 : _c.body);
          (0, import_chai.expect)(envelope.type).to.equal(import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE);
          (0, import_chai.expect)(envelope.source).to.equal("", "envelope source should be empty in SESSION_MESSAGE");
        });
      });
    });
  });
  describe("sendToOpenGroupV2", () => {
    const sandbox2 = sinon.createSandbox();
    let postMessageRetryableStub;
    beforeEach(() => {
      sandbox.stub(import_utils.UserUtils, "getOurPubKeyStrFromCache").resolves(import_test_utils.TestUtils.generateFakePubKey().key);
      postMessageRetryableStub = sandbox.stub(import_opengroupV2.ApiV2, "postMessageRetryable").resolves(import_test_utils.TestUtils.generateOpenGroupMessageV2());
    });
    afterEach(() => {
      sandbox2.restore();
    });
    it("should call postMessageRetryableStub", async () => {
      const message = import_test_utils.TestUtils.generateOpenGroupVisibleMessage();
      const roomInfos = import_test_utils.TestUtils.generateOpenGroupV2RoomInfos();
      await import_sending.MessageSender.sendToOpenGroupV2(message, roomInfos);
      (0, import_chai.expect)(postMessageRetryableStub.callCount).to.eq(1);
    });
    it("should retry postMessageRetryableStub ", async () => {
      const message = import_test_utils.TestUtils.generateOpenGroupVisibleMessage();
      const roomInfos = import_test_utils.TestUtils.generateOpenGroupV2RoomInfos();
      postMessageRetryableStub.throws("whate");
      sandbox2.stub(import_opengroupV2.ApiV2, "getMinTimeout").returns(2);
      postMessageRetryableStub.onThirdCall().resolves();
      await import_sending.MessageSender.sendToOpenGroupV2(message, roomInfos);
      (0, import_chai.expect)(postMessageRetryableStub.callCount).to.eq(3);
    });
    it("should not retry more than 3 postMessageRetryableStub ", async () => {
      const message = import_test_utils.TestUtils.generateOpenGroupVisibleMessage();
      const roomInfos = import_test_utils.TestUtils.generateOpenGroupV2RoomInfos();
      sandbox2.stub(import_opengroupV2.ApiV2, "getMinTimeout").returns(2);
      postMessageRetryableStub.throws("fake error");
      postMessageRetryableStub.onCall(4).resolves();
      try {
        await import_sending.MessageSender.sendToOpenGroupV2(message, roomInfos);
        throw new Error("Error expected");
      } catch (e) {
        (0, import_chai.expect)(e.name).to.eq("fake error");
      }
      (0, import_chai.expect)(postMessageRetryableStub.calledThrice);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvc2VuZGluZy9NZXNzYWdlU2VuZGVyX3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ2NoYWknO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBNZXNzYWdlU2VuZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9zZW5kaW5nJztcbmltcG9ydCB7IFRlc3RVdGlscyB9IGZyb20gJy4uLy4uLy4uL3Rlc3QtdXRpbHMnO1xuaW1wb3J0IHsgTWVzc2FnZUVuY3J5cHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vY3J5cHRvJztcbmltcG9ydCB7IFNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wcm90b2J1Zic7XG5pbXBvcnQgeyBFbmNyeXB0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdHlwZXMvRW5jcnlwdGlvblR5cGUnO1xuaW1wb3J0IHsgUHViS2V5LCBSYXdNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi90eXBlcyc7XG5pbXBvcnQgeyBNZXNzYWdlVXRpbHMsIFVzZXJVdGlscyB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdXRpbHMnO1xuaW1wb3J0IHsgQXBpVjIgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL2FwaXMvb3Blbl9ncm91cF9hcGkvb3Blbmdyb3VwVjInO1xuaW1wb3J0ICogYXMgRGF0YSBmcm9tICcuLi8uLi8uLi8uLi8uLi90cy9kYXRhL2RhdGEnO1xuaW1wb3J0IHsgU05vZGVBUEkgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL2FwaXMvc25vZGVfYXBpJztcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5cbmRlc2NyaWJlKCdNZXNzYWdlU2VuZGVyJywgKCkgPT4ge1xuICBjb25zdCBzYW5kYm94ID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuXG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgVGVzdFV0aWxzLnJlc3RvcmVTdHVicygpO1xuICB9KTtcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBUZXN0VXRpbHMuc3R1YldpbmRvd0xvZygpO1xuICB9KTtcblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1mdW5jLWJvZHktbGVuZ3RoXG4gIGRlc2NyaWJlKCdzZW5kJywgKCkgPT4ge1xuICAgIGNvbnN0IG91ck51bWJlciA9ICcwMTIzNDU2Nzg5YWJjZGVmJztcbiAgICBsZXQgc2Vzc2lvbk1lc3NhZ2VBUElTZW5kU3R1Yjogc2lub24uU2lub25TdHViPGFueT47XG4gICAgbGV0IGVuY3J5cHRTdHViOiBzaW5vbi5TaW5vblN0dWI8W1B1YktleSwgVWludDhBcnJheSwgRW5jcnlwdGlvblR5cGVdPjtcblxuICAgIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgICAgc2Vzc2lvbk1lc3NhZ2VBUElTZW5kU3R1YiA9IHNhbmRib3guc3R1YihNZXNzYWdlU2VuZGVyLCAnVEVTVF9zZW5kTWVzc2FnZVRvU25vZGUnKS5yZXNvbHZlcygpO1xuXG4gICAgICBzYW5kYm94LnN0dWIoRGF0YSwgJ2dldE1lc3NhZ2VCeUlkJykucmVzb2x2ZXMoKTtcblxuICAgICAgZW5jcnlwdFN0dWIgPSBzYW5kYm94LnN0dWIoTWVzc2FnZUVuY3J5cHRlciwgJ2VuY3J5cHQnKS5yZXNvbHZlcyh7XG4gICAgICAgIGVudmVsb3BlVHlwZTogU2lnbmFsU2VydmljZS5FbnZlbG9wZS5UeXBlLlNFU1NJT05fTUVTU0FHRSxcbiAgICAgICAgY2lwaGVyVGV4dDogY3J5cHRvLnJhbmRvbUJ5dGVzKDEwKSxcbiAgICAgIH0pO1xuXG4gICAgICBzYW5kYm94LnN0dWIoVXNlclV0aWxzLCAnZ2V0T3VyUHViS2V5U3RyRnJvbUNhY2hlJykucmV0dXJucyhvdXJOdW1iZXIpO1xuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ3JldHJ5JywgKCkgPT4ge1xuICAgICAgbGV0IHJhd01lc3NhZ2U6IFJhd01lc3NhZ2U7XG5cbiAgICAgIGJlZm9yZUVhY2goYXN5bmMgKCkgPT4ge1xuICAgICAgICByYXdNZXNzYWdlID0gYXdhaXQgTWVzc2FnZVV0aWxzLnRvUmF3TWVzc2FnZShcbiAgICAgICAgICBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCksXG4gICAgICAgICAgVGVzdFV0aWxzLmdlbmVyYXRlVmlzaWJsZU1lc3NhZ2UoKVxuICAgICAgICApO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgbm90IHJldHJ5IGlmIGFuIGVycm9yIG9jY3VycmVkIGR1cmluZyBlbmNyeXB0aW9uJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBlbmNyeXB0U3R1Yi50aHJvd3MobmV3IEVycm9yKCdGYWlsZWQgdG8gZW5jcnlwdC4nKSk7XG4gICAgICAgIGNvbnN0IHByb21pc2UgPSBNZXNzYWdlU2VuZGVyLnNlbmQocmF3TWVzc2FnZSwgMywgMTApO1xuICAgICAgICBhd2FpdCBleHBlY3QocHJvbWlzZSkuaXMucmVqZWN0ZWRXaXRoKCdGYWlsZWQgdG8gZW5jcnlwdC4nKTtcbiAgICAgICAgZXhwZWN0KHNlc3Npb25NZXNzYWdlQVBJU2VuZFN0dWIuY2FsbENvdW50KS50by5lcXVhbCgwKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG9ubHkgY2FsbCBsb2tpTWVzc2FnZUFQSSBvbmNlIGlmIG5vIGVycm9ycyBvY2N1cmVkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBNZXNzYWdlU2VuZGVyLnNlbmQocmF3TWVzc2FnZSwgMywgMTApO1xuICAgICAgICBleHBlY3Qoc2Vzc2lvbk1lc3NhZ2VBUElTZW5kU3R1Yi5jYWxsQ291bnQpLnRvLmVxdWFsKDEpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgb25seSByZXRyeSB0aGUgc3BlY2lmaWVkIGFtb3VudCBvZiB0aW1lcyBiZWZvcmUgdGhyb3dpbmcnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIGNvbnN0IGNsb2NrID0gc2lub24udXNlRmFrZVRpbWVycygpO1xuXG4gICAgICAgIHNlc3Npb25NZXNzYWdlQVBJU2VuZFN0dWIudGhyb3dzKG5ldyBFcnJvcignQVBJIGVycm9yJykpO1xuICAgICAgICBjb25zdCBhdHRlbXB0cyA9IDI7XG4gICAgICAgIGNvbnN0IHByb21pc2UgPSBNZXNzYWdlU2VuZGVyLnNlbmQocmF3TWVzc2FnZSwgYXR0ZW1wdHMsIDEwKTtcbiAgICAgICAgYXdhaXQgZXhwZWN0KHByb21pc2UpLmlzLnJlamVjdGVkV2l0aCgnQVBJIGVycm9yJyk7XG4gICAgICAgIC8vIGNsb2NrLnJlc3RvcmUoKTtcbiAgICAgICAgZXhwZWN0KHNlc3Npb25NZXNzYWdlQVBJU2VuZFN0dWIuY2FsbENvdW50KS50by5lcXVhbChhdHRlbXB0cyk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBub3QgdGhyb3cgZXJyb3IgaWYgc3VjY2Vzc2Z1bCBzZW5kIG9jY3VycyB3aXRoaW4gdGhlIHJldHJ5IGxpbWl0JywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBzZXNzaW9uTWVzc2FnZUFQSVNlbmRTdHViLm9uRmlyc3RDYWxsKCkudGhyb3dzKG5ldyBFcnJvcignQVBJIGVycm9yJykpO1xuICAgICAgICBhd2FpdCBNZXNzYWdlU2VuZGVyLnNlbmQocmF3TWVzc2FnZSwgMywgMTApO1xuICAgICAgICBleHBlY3Qoc2Vzc2lvbk1lc3NhZ2VBUElTZW5kU3R1Yi5jYWxsQ291bnQpLnRvLmVxdWFsKDIpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnbG9naWMnLCAoKSA9PiB7XG4gICAgICBsZXQgbWVzc2FnZUVuY3lycHRSZXR1cm5FbnZlbG9wZVR5cGUgPSBTaWduYWxTZXJ2aWNlLkVudmVsb3BlLlR5cGUuU0VTU0lPTl9NRVNTQUdFO1xuXG4gICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgZW5jcnlwdFN0dWIuY2FsbHNGYWtlKGFzeW5jIChfZGV2aWNlLCBwbGFpblRleHRCdWZmZXIsIF90eXBlKSA9PiAoe1xuICAgICAgICAgIGVudmVsb3BlVHlwZTogbWVzc2FnZUVuY3lycHRSZXR1cm5FbnZlbG9wZVR5cGUsXG4gICAgICAgICAgY2lwaGVyVGV4dDogcGxhaW5UZXh0QnVmZmVyLFxuICAgICAgICB9KSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBwYXNzIHRoZSBjb3JyZWN0IHZhbHVlcyB0byBsb2tpTWVzc2FnZUFQSScsIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgICBjb25zdCB2aXNpYmxlTWVzc2FnZSA9IFRlc3RVdGlscy5nZW5lcmF0ZVZpc2libGVNZXNzYWdlKCk7XG5cbiAgICAgICAgY29uc3QgcmF3TWVzc2FnZSA9IGF3YWl0IE1lc3NhZ2VVdGlscy50b1Jhd01lc3NhZ2UoZGV2aWNlLCB2aXNpYmxlTWVzc2FnZSk7XG5cbiAgICAgICAgYXdhaXQgTWVzc2FnZVNlbmRlci5zZW5kKHJhd01lc3NhZ2UsIDMsIDEwKTtcblxuICAgICAgICBjb25zdCBhcmdzID0gc2Vzc2lvbk1lc3NhZ2VBUElTZW5kU3R1Yi5nZXRDYWxsKDApLmFyZ3M7XG4gICAgICAgIGV4cGVjdChhcmdzWzBdKS50by5lcXVhbChkZXZpY2Uua2V5KTtcbiAgICAgICAgLy8gZXhwZWN0KGFyZ3NbM10pLnRvLmVxdWFsKHZpc2libGVNZXNzYWdlLnRpbWVzdGFtcCk7IHRoZSB0aW1lc3RhbXAgaXMgb3ZlcndyaXR0ZW4gb24gc2VuZGluZyBieSB0aGUgbmV0d29yayBjbG9jayBvZmZzZXRcbiAgICAgICAgZXhwZWN0KGFyZ3NbMl0pLnRvLmVxdWFsKHZpc2libGVNZXNzYWdlLnR0bCgpKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGNvcnJlY3RseSBidWlsZCB0aGUgZW52ZWxvcGUgYW5kIG92ZXJyaWRlIHRoZSB0aW1lc3RhbXAnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIG1lc3NhZ2VFbmN5cnB0UmV0dXJuRW52ZWxvcGVUeXBlID0gU2lnbmFsU2VydmljZS5FbnZlbG9wZS5UeXBlLlNFU1NJT05fTUVTU0FHRTtcblxuICAgICAgICAvLyBUaGlzIHRlc3QgYXNzdW1lcyB0aGUgZW5jcnlwdGlvbiBzdHViIHJldHVybnMgdGhlIHBsYWluVGV4dCBwYXNzZWQgaW50byBpdC5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuXG4gICAgICAgIGNvbnN0IHZpc2libGVNZXNzYWdlID0gVGVzdFV0aWxzLmdlbmVyYXRlVmlzaWJsZU1lc3NhZ2UoKTtcbiAgICAgICAgY29uc3QgcmF3TWVzc2FnZSA9IGF3YWl0IE1lc3NhZ2VVdGlscy50b1Jhd01lc3NhZ2UoZGV2aWNlLCB2aXNpYmxlTWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IDIwMDAwMDtcbiAgICAgICAgc2FuZGJveC5zdHViKFNOb2RlQVBJLCAnZ2V0TGF0ZXN0VGltZXN0YW1wT2Zmc2V0JykucmV0dXJucyhvZmZzZXQpO1xuICAgICAgICBhd2FpdCBNZXNzYWdlU2VuZGVyLnNlbmQocmF3TWVzc2FnZSwgMywgMTApO1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBzZXNzaW9uTWVzc2FnZUFQSVNlbmRTdHViLmdldENhbGwoMCkuYXJnc1sxXTtcbiAgICAgICAgY29uc3Qgd2ViU29ja2V0TWVzc2FnZSA9IFNpZ25hbFNlcnZpY2UuV2ViU29ja2V0TWVzc2FnZS5kZWNvZGUoZGF0YSk7XG4gICAgICAgIGV4cGVjdCh3ZWJTb2NrZXRNZXNzYWdlLnJlcXVlc3Q/LmJvZHkpLnRvLm5vdC5lcXVhbChcbiAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgJ1JlcXVlc3QgYm9keSBzaG91bGQgbm90IGJlIHVuZGVmaW5lZCdcbiAgICAgICAgKTtcbiAgICAgICAgZXhwZWN0KHdlYlNvY2tldE1lc3NhZ2UucmVxdWVzdD8uYm9keSkudG8ubm90LmVxdWFsKFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgJ1JlcXVlc3QgYm9keSBzaG91bGQgbm90IGJlIG51bGwnXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZW52ZWxvcGUgPSBTaWduYWxTZXJ2aWNlLkVudmVsb3BlLmRlY29kZShcbiAgICAgICAgICB3ZWJTb2NrZXRNZXNzYWdlLnJlcXVlc3Q/LmJvZHkgYXMgVWludDhBcnJheVxuICAgICAgICApO1xuICAgICAgICBleHBlY3QoZW52ZWxvcGUudHlwZSkudG8uZXF1YWwoU2lnbmFsU2VydmljZS5FbnZlbG9wZS5UeXBlLlNFU1NJT05fTUVTU0FHRSk7XG4gICAgICAgIGV4cGVjdChlbnZlbG9wZS5zb3VyY2UpLnRvLmVxdWFsKCcnKTtcblxuICAgICAgICAvLyB0aGUgdGltZXN0YW1wIGlzIG92ZXJyaWRkZW4gb24gc2VuZGluZyB3aXRoIHRoZSBuZXR3b3JrIG9mZnNldFxuICAgICAgICBjb25zdCBleHBlY3RlZFRpbWVzdGFtcCA9IERhdGUubm93KCkgLSBvZmZzZXQ7XG4gICAgICAgIGNvbnN0IGRlY29kZWRUaW1lc3RhbXBGcm9tU2VuZGluZyA9IF8udG9OdW1iZXIoZW52ZWxvcGUudGltZXN0YW1wKTtcbiAgICAgICAgZXhwZWN0KGRlY29kZWRUaW1lc3RhbXBGcm9tU2VuZGluZykudG8uYmUuYWJvdmUoZXhwZWN0ZWRUaW1lc3RhbXAgLSAxMCk7XG4gICAgICAgIGV4cGVjdChkZWNvZGVkVGltZXN0YW1wRnJvbVNlbmRpbmcpLnRvLmJlLmJlbG93KGV4cGVjdGVkVGltZXN0YW1wICsgMTApO1xuXG4gICAgICAgIC8vIHRoZW4gbWFrZSBzdXJlIHRoZSBwbGFpbnRleHRCdWZmZXIgd2FzIG92ZXJyaWRlbiB0b29cbiAgICAgICAgY29uc3QgdmlzaWJsZU1lc3NhZ2VFeHBlY3RlZCA9IFRlc3RVdGlscy5nZW5lcmF0ZVZpc2libGVNZXNzYWdlKHtcbiAgICAgICAgICB0aW1lc3RhbXA6IGRlY29kZWRUaW1lc3RhbXBGcm9tU2VuZGluZyxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHJhd01lc3NhZ2VFeHBlY3RlZCA9IGF3YWl0IE1lc3NhZ2VVdGlscy50b1Jhd01lc3NhZ2UoZGV2aWNlLCB2aXNpYmxlTWVzc2FnZUV4cGVjdGVkKTtcblxuICAgICAgICBleHBlY3QoZW52ZWxvcGUuY29udGVudCkudG8uZGVlcC5lcXVhbChyYXdNZXNzYWdlRXhwZWN0ZWQucGxhaW5UZXh0QnVmZmVyKTtcbiAgICAgIH0pO1xuXG4gICAgICBkZXNjcmliZSgnU0VTU0lPTl9NRVNTQUdFJywgKCkgPT4ge1xuICAgICAgICBpdCgnc2hvdWxkIHNldCB0aGUgZW52ZWxvcGUgc291cmNlIHRvIGJlIGVtcHR5JywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIG1lc3NhZ2VFbmN5cnB0UmV0dXJuRW52ZWxvcGVUeXBlID0gU2lnbmFsU2VydmljZS5FbnZlbG9wZS5UeXBlLlNFU1NJT05fTUVTU0FHRTtcblxuICAgICAgICAgIC8vIFRoaXMgdGVzdCBhc3N1bWVzIHRoZSBlbmNyeXB0aW9uIHN0dWIgcmV0dXJucyB0aGUgcGxhaW5UZXh0IHBhc3NlZCBpbnRvIGl0LlxuICAgICAgICAgIGNvbnN0IGRldmljZSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcblxuICAgICAgICAgIGNvbnN0IHZpc2libGVNZXNzYWdlID0gVGVzdFV0aWxzLmdlbmVyYXRlVmlzaWJsZU1lc3NhZ2UoKTtcbiAgICAgICAgICBjb25zdCByYXdNZXNzYWdlID0gYXdhaXQgTWVzc2FnZVV0aWxzLnRvUmF3TWVzc2FnZShkZXZpY2UsIHZpc2libGVNZXNzYWdlKTtcbiAgICAgICAgICBhd2FpdCBNZXNzYWdlU2VuZGVyLnNlbmQocmF3TWVzc2FnZSwgMywgMTApO1xuXG4gICAgICAgICAgY29uc3QgZGF0YSA9IHNlc3Npb25NZXNzYWdlQVBJU2VuZFN0dWIuZ2V0Q2FsbCgwKS5hcmdzWzFdO1xuICAgICAgICAgIGNvbnN0IHdlYlNvY2tldE1lc3NhZ2UgPSBTaWduYWxTZXJ2aWNlLldlYlNvY2tldE1lc3NhZ2UuZGVjb2RlKGRhdGEpO1xuICAgICAgICAgIGV4cGVjdCh3ZWJTb2NrZXRNZXNzYWdlLnJlcXVlc3Q/LmJvZHkpLnRvLm5vdC5lcXVhbChcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICdSZXF1ZXN0IGJvZHkgc2hvdWxkIG5vdCBiZSB1bmRlZmluZWQnXG4gICAgICAgICAgKTtcbiAgICAgICAgICBleHBlY3Qod2ViU29ja2V0TWVzc2FnZS5yZXF1ZXN0Py5ib2R5KS50by5ub3QuZXF1YWwoXG4gICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgJ1JlcXVlc3QgYm9keSBzaG91bGQgbm90IGJlIG51bGwnXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGNvbnN0IGVudmVsb3BlID0gU2lnbmFsU2VydmljZS5FbnZlbG9wZS5kZWNvZGUoXG4gICAgICAgICAgICB3ZWJTb2NrZXRNZXNzYWdlLnJlcXVlc3Q/LmJvZHkgYXMgVWludDhBcnJheVxuICAgICAgICAgICk7XG4gICAgICAgICAgZXhwZWN0KGVudmVsb3BlLnR5cGUpLnRvLmVxdWFsKFNpZ25hbFNlcnZpY2UuRW52ZWxvcGUuVHlwZS5TRVNTSU9OX01FU1NBR0UpO1xuICAgICAgICAgIGV4cGVjdChlbnZlbG9wZS5zb3VyY2UpLnRvLmVxdWFsKFxuICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAnZW52ZWxvcGUgc291cmNlIHNob3VsZCBiZSBlbXB0eSBpbiBTRVNTSU9OX01FU1NBR0UnXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3NlbmRUb09wZW5Hcm91cFYyJywgKCkgPT4ge1xuICAgIGNvbnN0IHNhbmRib3gyID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuICAgIGxldCBwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWI6IHNpbm9uLlNpbm9uU3R1YjtcbiAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgIHNhbmRib3hcbiAgICAgICAgLnN0dWIoVXNlclV0aWxzLCAnZ2V0T3VyUHViS2V5U3RyRnJvbUNhY2hlJylcbiAgICAgICAgLnJlc29sdmVzKFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKS5rZXkpO1xuXG4gICAgICBwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWIgPSBzYW5kYm94XG4gICAgICAgIC5zdHViKEFwaVYyLCAncG9zdE1lc3NhZ2VSZXRyeWFibGUnKVxuICAgICAgICAucmVzb2x2ZXMoVGVzdFV0aWxzLmdlbmVyYXRlT3Blbkdyb3VwTWVzc2FnZVYyKCkpO1xuICAgIH0pO1xuXG4gICAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICAgIHNhbmRib3gyLnJlc3RvcmUoKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgY2FsbCBwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWInLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gVGVzdFV0aWxzLmdlbmVyYXRlT3Blbkdyb3VwVmlzaWJsZU1lc3NhZ2UoKTtcbiAgICAgIGNvbnN0IHJvb21JbmZvcyA9IFRlc3RVdGlscy5nZW5lcmF0ZU9wZW5Hcm91cFYyUm9vbUluZm9zKCk7XG5cbiAgICAgIGF3YWl0IE1lc3NhZ2VTZW5kZXIuc2VuZFRvT3Blbkdyb3VwVjIobWVzc2FnZSwgcm9vbUluZm9zKTtcbiAgICAgIGV4cGVjdChwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWIuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0cnkgcG9zdE1lc3NhZ2VSZXRyeWFibGVTdHViICcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVPcGVuR3JvdXBWaXNpYmxlTWVzc2FnZSgpO1xuICAgICAgY29uc3Qgcm9vbUluZm9zID0gVGVzdFV0aWxzLmdlbmVyYXRlT3Blbkdyb3VwVjJSb29tSW5mb3MoKTtcblxuICAgICAgcG9zdE1lc3NhZ2VSZXRyeWFibGVTdHViLnRocm93cygnd2hhdGUnKTtcbiAgICAgIHNhbmRib3gyLnN0dWIoQXBpVjIsICdnZXRNaW5UaW1lb3V0JykucmV0dXJucygyKTtcblxuICAgICAgcG9zdE1lc3NhZ2VSZXRyeWFibGVTdHViLm9uVGhpcmRDYWxsKCkucmVzb2x2ZXMoKTtcbiAgICAgIGF3YWl0IE1lc3NhZ2VTZW5kZXIuc2VuZFRvT3Blbkdyb3VwVjIobWVzc2FnZSwgcm9vbUluZm9zKTtcbiAgICAgIGV4cGVjdChwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWIuY2FsbENvdW50KS50by5lcSgzKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgbm90IHJldHJ5IG1vcmUgdGhhbiAzIHBvc3RNZXNzYWdlUmV0cnlhYmxlU3R1YiAnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gVGVzdFV0aWxzLmdlbmVyYXRlT3Blbkdyb3VwVmlzaWJsZU1lc3NhZ2UoKTtcbiAgICAgIGNvbnN0IHJvb21JbmZvcyA9IFRlc3RVdGlscy5nZW5lcmF0ZU9wZW5Hcm91cFYyUm9vbUluZm9zKCk7XG4gICAgICBzYW5kYm94Mi5zdHViKEFwaVYyLCAnZ2V0TWluVGltZW91dCcpLnJldHVybnMoMik7XG4gICAgICBwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWIudGhyb3dzKCdmYWtlIGVycm9yJyk7XG4gICAgICBwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWIub25DYWxsKDQpLnJlc29sdmVzKCk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBNZXNzYWdlU2VuZGVyLnNlbmRUb09wZW5Hcm91cFYyKG1lc3NhZ2UsIHJvb21JbmZvcyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRXJyb3IgZXhwZWN0ZWQnKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZXhwZWN0KGUubmFtZSkudG8uZXEoJ2Zha2UgZXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGV4cGVjdChwb3N0TWVzc2FnZVJldHJ5YWJsZVN0dWIuY2FsbGVkVGhyaWNlKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGtCQUF1QjtBQUN2QixhQUF3QjtBQUN4QixZQUF1QjtBQUN2QixxQkFBOEI7QUFDOUIsd0JBQTBCO0FBQzFCLG9CQUFpQztBQUNqQyxzQkFBOEI7QUFHOUIsbUJBQXdDO0FBQ3hDLHlCQUFzQjtBQUN0QixXQUFzQjtBQUN0Qix1QkFBeUI7QUFDekIsb0JBQWM7QUFFZCxTQUFTLGlCQUFpQixNQUFNO0FBQzlCLFFBQU0sVUFBVSxNQUFNLGNBQWM7QUFFcEMsWUFBVSxNQUFNO0FBQ2QsWUFBUSxRQUFRO0FBQ2hCLGdDQUFVLGFBQWE7QUFBQSxFQUN6QixDQUFDO0FBRUQsYUFBVyxNQUFNO0FBQ2YsZ0NBQVUsY0FBYztBQUFBLEVBQzFCLENBQUM7QUFHRCxXQUFTLFFBQVEsTUFBTTtBQUNyQixVQUFNLFlBQVk7QUFDbEIsUUFBSTtBQUNKLFFBQUk7QUFFSixlQUFXLE1BQU07QUFDZixrQ0FBNEIsUUFBUSxLQUFLLDhCQUFlLHlCQUF5QixFQUFFLFNBQVM7QUFFNUYsY0FBUSxLQUFLLE1BQU0sZ0JBQWdCLEVBQUUsU0FBUztBQUU5QyxvQkFBYyxRQUFRLEtBQUssZ0NBQWtCLFNBQVMsRUFBRSxTQUFTO0FBQUEsUUFDL0QsY0FBYyw4QkFBYyxTQUFTLEtBQUs7QUFBQSxRQUMxQyxZQUFZLE9BQU8sWUFBWSxFQUFFO0FBQUEsTUFDbkMsQ0FBQztBQUVELGNBQVEsS0FBSyx3QkFBVywwQkFBMEIsRUFBRSxRQUFRLFNBQVM7QUFBQSxJQUN2RSxDQUFDO0FBRUQsYUFBUyxTQUFTLE1BQU07QUFDdEIsVUFBSTtBQUVKLGlCQUFXLFlBQVk7QUFDckIscUJBQWEs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
