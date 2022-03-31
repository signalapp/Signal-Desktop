var import_chai = require("chai");
var import_protobuf = require("../../../../protobuf");
var import_test_utils = require("../../../test-utils");
var import_utils = require("../../../../session/utils");
var import_types = require("../../../../session/types");
var import_session = require("../../../../session");
var import_ClosedGroupVisibleMessage = require("../../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage");
var import_VisibleMessage = require("../../../../session/messages/outgoing/visibleMessage/VisibleMessage");
describe("ClosedGroupVisibleMessage", () => {
  let groupId;
  beforeEach(() => {
    groupId = import_test_utils.TestUtils.generateFakePubKey();
  });
  it("can create empty message with timestamp, groupId and chatMessage", () => {
    const chatMessage = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      body: "body"
    });
    const message = new import_ClosedGroupVisibleMessage.ClosedGroupVisibleMessage({
      groupId,
      chatMessage
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.dataMessage).to.have.property("group").to.have.deep.property("id", new Uint8Array(import_utils.StringUtils.encode(import_types.PubKey.PREFIX_GROUP_TEXTSECURE + groupId.key, "utf8")));
    (0, import_chai.expect)(decoded.dataMessage).to.have.property("group").to.have.deep.property("type", import_protobuf.SignalService.GroupContext.Type.DELIVER);
    (0, import_chai.expect)(decoded.dataMessage).to.have.deep.property("body", "body");
    (0, import_chai.expect)(message).to.have.property("timestamp").to.be.equal(chatMessage.timestamp);
  });
  it("correct ttl", () => {
    const chatMessage = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now()
    });
    const message = new import_ClosedGroupVisibleMessage.ClosedGroupVisibleMessage({
      groupId,
      chatMessage
    });
    (0, import_chai.expect)(message.ttl()).to.equal(import_session.Constants.TTL_DEFAULT.TTL_MAX);
  });
  it("has an identifier", () => {
    const chatMessage = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now()
    });
    const message = new import_ClosedGroupVisibleMessage.ClosedGroupVisibleMessage({
      groupId,
      chatMessage
    });
    (0, import_chai.expect)(message.identifier).to.not.equal(null, "identifier cannot be null");
    (0, import_chai.expect)(message.identifier).to.not.equal(void 0, "identifier cannot be undefined");
  });
  it("should use the identifier passed into it over the one set in chatMessage", () => {
    const chatMessage = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      body: "body",
      identifier: "chatMessage"
    });
    const message = new import_ClosedGroupVisibleMessage.ClosedGroupVisibleMessage({
      groupId,
      chatMessage,
      identifier: "closedGroupMessage"
    });
    (0, import_chai.expect)(message.identifier).to.be.equal("closedGroupMessage");
  });
  it("should use the identifier of the chatMessage if one is not specified on the closed group message", () => {
    const chatMessage = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      body: "body",
      identifier: "chatMessage"
    });
    const message = new import_ClosedGroupVisibleMessage.ClosedGroupVisibleMessage({
      groupId,
      chatMessage
    });
    (0, import_chai.expect)(message.identifier).to.be.equal("chatMessage");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvbWVzc2FnZXMvQ2xvc2VkR3JvdXBDaGF0TWVzc2FnZV90ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcblxuaW1wb3J0IHsgU2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Byb3RvYnVmJztcbmltcG9ydCB7IFRlc3RVdGlscyB9IGZyb20gJy4uLy4uLy4uL3Rlc3QtdXRpbHMnO1xuaW1wb3J0IHsgU3RyaW5nVXRpbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL3V0aWxzJztcbmltcG9ydCB7IFB1YktleSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdHlwZXMnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbic7XG5pbXBvcnQgeyBDbG9zZWRHcm91cFZpc2libGVNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9tZXNzYWdlcy9vdXRnb2luZy92aXNpYmxlTWVzc2FnZS9DbG9zZWRHcm91cFZpc2libGVNZXNzYWdlJztcbmltcG9ydCB7IFZpc2libGVNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9tZXNzYWdlcy9vdXRnb2luZy92aXNpYmxlTWVzc2FnZS9WaXNpYmxlTWVzc2FnZSc7XG5cbmRlc2NyaWJlKCdDbG9zZWRHcm91cFZpc2libGVNZXNzYWdlJywgKCkgPT4ge1xuICBsZXQgZ3JvdXBJZDogUHViS2V5O1xuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBncm91cElkID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICB9KTtcbiAgaXQoJ2NhbiBjcmVhdGUgZW1wdHkgbWVzc2FnZSB3aXRoIHRpbWVzdGFtcCwgZ3JvdXBJZCBhbmQgY2hhdE1lc3NhZ2UnLCAoKSA9PiB7XG4gICAgY29uc3QgY2hhdE1lc3NhZ2UgPSBuZXcgVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgYm9keTogJ2JvZHknLFxuICAgIH0pO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgQ2xvc2VkR3JvdXBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICBncm91cElkLFxuICAgICAgY2hhdE1lc3NhZ2UsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlKVxuICAgICAgLnRvLmhhdmUucHJvcGVydHkoJ2dyb3VwJylcbiAgICAgIC50by5oYXZlLmRlZXAucHJvcGVydHkoXG4gICAgICAgICdpZCcsXG4gICAgICAgIG5ldyBVaW50OEFycmF5KFN0cmluZ1V0aWxzLmVuY29kZShQdWJLZXkuUFJFRklYX0dST1VQX1RFWFRTRUNVUkUgKyBncm91cElkLmtleSwgJ3V0ZjgnKSlcbiAgICAgICk7XG4gICAgZXhwZWN0KGRlY29kZWQuZGF0YU1lc3NhZ2UpXG4gICAgICAudG8uaGF2ZS5wcm9wZXJ0eSgnZ3JvdXAnKVxuICAgICAgLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgndHlwZScsIFNpZ25hbFNlcnZpY2UuR3JvdXBDb250ZXh0LlR5cGUuREVMSVZFUik7XG5cbiAgICBleHBlY3QoZGVjb2RlZC5kYXRhTWVzc2FnZSkudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdib2R5JywgJ2JvZHknKTtcblxuICAgIC8vIHdlIHVzZSB0aGUgdGltZXN0YW1wIG9mIHRoZSBjaGF0TWVzc2FnZSBhcyBwYXJlbnQgdGltZXN0YW1wXG4gICAgZXhwZWN0KG1lc3NhZ2UpXG4gICAgICAudG8uaGF2ZS5wcm9wZXJ0eSgndGltZXN0YW1wJylcbiAgICAgIC50by5iZS5lcXVhbChjaGF0TWVzc2FnZS50aW1lc3RhbXApO1xuICB9KTtcblxuICBpdCgnY29ycmVjdCB0dGwnLCAoKSA9PiB7XG4gICAgY29uc3QgY2hhdE1lc3NhZ2UgPSBuZXcgVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgIH0pO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgQ2xvc2VkR3JvdXBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICBncm91cElkLFxuICAgICAgY2hhdE1lc3NhZ2UsXG4gICAgfSk7XG4gICAgZXhwZWN0KG1lc3NhZ2UudHRsKCkpLnRvLmVxdWFsKENvbnN0YW50cy5UVExfREVGQVVMVC5UVExfTUFYKTtcbiAgfSk7XG5cbiAgaXQoJ2hhcyBhbiBpZGVudGlmaWVyJywgKCkgPT4ge1xuICAgIGNvbnN0IGNoYXRNZXNzYWdlID0gbmV3IFZpc2libGVNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IENsb3NlZEdyb3VwVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgZ3JvdXBJZCxcbiAgICAgIGNoYXRNZXNzYWdlLFxuICAgIH0pO1xuICAgIGV4cGVjdChtZXNzYWdlLmlkZW50aWZpZXIpLnRvLm5vdC5lcXVhbChudWxsLCAnaWRlbnRpZmllciBjYW5ub3QgYmUgbnVsbCcpO1xuICAgIGV4cGVjdChtZXNzYWdlLmlkZW50aWZpZXIpLnRvLm5vdC5lcXVhbCh1bmRlZmluZWQsICdpZGVudGlmaWVyIGNhbm5vdCBiZSB1bmRlZmluZWQnKTtcbiAgfSk7XG5cbiAgaXQoJ3Nob3VsZCB1c2UgdGhlIGlkZW50aWZpZXIgcGFzc2VkIGludG8gaXQgb3ZlciB0aGUgb25lIHNldCBpbiBjaGF0TWVzc2FnZScsICgpID0+IHtcbiAgICBjb25zdCBjaGF0TWVzc2FnZSA9IG5ldyBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBib2R5OiAnYm9keScsXG4gICAgICBpZGVudGlmaWVyOiAnY2hhdE1lc3NhZ2UnLFxuICAgIH0pO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgQ2xvc2VkR3JvdXBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICBncm91cElkLFxuICAgICAgY2hhdE1lc3NhZ2UsXG4gICAgICBpZGVudGlmaWVyOiAnY2xvc2VkR3JvdXBNZXNzYWdlJyxcbiAgICB9KTtcbiAgICBleHBlY3QobWVzc2FnZS5pZGVudGlmaWVyKS50by5iZS5lcXVhbCgnY2xvc2VkR3JvdXBNZXNzYWdlJyk7XG4gIH0pO1xuXG4gIGl0KCdzaG91bGQgdXNlIHRoZSBpZGVudGlmaWVyIG9mIHRoZSBjaGF0TWVzc2FnZSBpZiBvbmUgaXMgbm90IHNwZWNpZmllZCBvbiB0aGUgY2xvc2VkIGdyb3VwIG1lc3NhZ2UnLCAoKSA9PiB7XG4gICAgY29uc3QgY2hhdE1lc3NhZ2UgPSBuZXcgVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgYm9keTogJ2JvZHknLFxuICAgICAgaWRlbnRpZmllcjogJ2NoYXRNZXNzYWdlJyxcbiAgICB9KTtcbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IENsb3NlZEdyb3VwVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgZ3JvdXBJZCxcbiAgICAgIGNoYXRNZXNzYWdlLFxuICAgIH0pO1xuICAgIGV4cGVjdChtZXNzYWdlLmlkZW50aWZpZXIpLnRvLmJlLmVxdWFsKCdjaGF0TWVzc2FnZScpO1xuICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUEsa0JBQXVCO0FBRXZCLHNCQUE4QjtBQUM5Qix3QkFBMEI7QUFDMUIsbUJBQTRCO0FBQzVCLG1CQUF1QjtBQUN2QixxQkFBMEI7QUFDMUIsdUNBQTBDO0FBQzFDLDRCQUErQjtBQUUvQixTQUFTLDZCQUE2QixNQUFNO0FBQzFDLE1BQUk7QUFDSixhQUFXLE1BQU07QUFDZixjQUFVLDRCQUFVLG1CQUFtQjtBQUFBLEVBQ3pDLENBQUM7QUFD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
