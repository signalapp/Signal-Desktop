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
var import_protobuf = require("../../../../protobuf");
var import_long = __toESM(require("long"));
var import_lodash = require("lodash");
var import_session = require("../../../../session");
var import_TypingMessage = require("../../../../session/messages/outgoing/controlMessage/TypingMessage");
describe("TypingMessage", () => {
  it("has Action.STARTED if isTyping = true", () => {
    const message = new import_TypingMessage.TypingMessage({
      timestamp: Date.now(),
      isTyping: true
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.typingMessage).to.have.property("action", import_protobuf.SignalService.TypingMessage.Action.STARTED);
  });
  it("has Action.STOPPED if isTyping = false", () => {
    const message = new import_TypingMessage.TypingMessage({
      timestamp: Date.now(),
      isTyping: false
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.typingMessage).to.have.property("action", import_protobuf.SignalService.TypingMessage.Action.STOPPED);
  });
  it("has typingTimestamp set if value passed", () => {
    var _a;
    const message = new import_TypingMessage.TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
      typingTimestamp: 111111111
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    const decodedtimestamp = (0, import_lodash.toNumber)((_a = decoded.typingMessage) == null ? void 0 : _a.timestamp);
    (0, import_chai.expect)(decodedtimestamp).to.be.equal(111111111);
  });
  it("has typingTimestamp set with Date.now() if value not passed", () => {
    var _a;
    const message = new import_TypingMessage.TypingMessage({
      timestamp: Date.now(),
      isTyping: true
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    let timestamp = (_a = decoded.typingMessage) == null ? void 0 : _a.timestamp;
    if (timestamp instanceof import_long.default) {
      timestamp = timestamp.toNumber();
    }
    (0, import_chai.expect)(timestamp).to.be.approximately(Date.now(), 10);
  });
  it("correct ttl", () => {
    const message = new import_TypingMessage.TypingMessage({
      timestamp: Date.now(),
      isTyping: true
    });
    (0, import_chai.expect)(message.ttl()).to.equal(import_session.Constants.TTL_DEFAULT.TYPING_MESSAGE);
  });
  it("has an identifier", () => {
    const message = new import_TypingMessage.TypingMessage({
      timestamp: Date.now(),
      isTyping: true
    });
    (0, import_chai.expect)(message.identifier).to.not.equal(null, "identifier cannot be null");
    (0, import_chai.expect)(message.identifier).to.not.equal(void 0, "identifier cannot be undefined");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvbWVzc2FnZXMvVHlwaW5nTWVzc2FnZV90ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcblxuaW1wb3J0IHsgU2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Byb3RvYnVmJztcbmltcG9ydCBMb25nIGZyb20gJ2xvbmcnO1xuaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbic7XG5pbXBvcnQgeyBUeXBpbmdNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9tZXNzYWdlcy9vdXRnb2luZy9jb250cm9sTWVzc2FnZS9UeXBpbmdNZXNzYWdlJztcblxuZGVzY3JpYmUoJ1R5cGluZ01lc3NhZ2UnLCAoKSA9PiB7XG4gIGl0KCdoYXMgQWN0aW9uLlNUQVJURUQgaWYgaXNUeXBpbmcgPSB0cnVlJywgKCkgPT4ge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgVHlwaW5nTWVzc2FnZSh7XG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBpc1R5cGluZzogdHJ1ZSxcbiAgICB9KTtcbiAgICBjb25zdCBwbGFpblRleHQgPSBtZXNzYWdlLnBsYWluVGV4dEJ1ZmZlcigpO1xuICAgIGNvbnN0IGRlY29kZWQgPSBTaWduYWxTZXJ2aWNlLkNvbnRlbnQuZGVjb2RlKHBsYWluVGV4dCk7XG4gICAgZXhwZWN0KGRlY29kZWQudHlwaW5nTWVzc2FnZSkudG8uaGF2ZS5wcm9wZXJ0eShcbiAgICAgICdhY3Rpb24nLFxuICAgICAgU2lnbmFsU2VydmljZS5UeXBpbmdNZXNzYWdlLkFjdGlvbi5TVEFSVEVEXG4gICAgKTtcbiAgfSk7XG5cbiAgaXQoJ2hhcyBBY3Rpb24uU1RPUFBFRCBpZiBpc1R5cGluZyA9IGZhbHNlJywgKCkgPT4ge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgVHlwaW5nTWVzc2FnZSh7XG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBpc1R5cGluZzogZmFsc2UsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGV4cGVjdChkZWNvZGVkLnR5cGluZ01lc3NhZ2UpLnRvLmhhdmUucHJvcGVydHkoXG4gICAgICAnYWN0aW9uJyxcbiAgICAgIFNpZ25hbFNlcnZpY2UuVHlwaW5nTWVzc2FnZS5BY3Rpb24uU1RPUFBFRFxuICAgICk7XG4gIH0pO1xuXG4gIGl0KCdoYXMgdHlwaW5nVGltZXN0YW1wIHNldCBpZiB2YWx1ZSBwYXNzZWQnLCAoKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IG5ldyBUeXBpbmdNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIGlzVHlwaW5nOiB0cnVlLFxuICAgICAgdHlwaW5nVGltZXN0YW1wOiAxMTExMTExMTEsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGNvbnN0IGRlY29kZWR0aW1lc3RhbXAgPSB0b051bWJlcihkZWNvZGVkLnR5cGluZ01lc3NhZ2U/LnRpbWVzdGFtcCk7XG4gICAgZXhwZWN0KGRlY29kZWR0aW1lc3RhbXApLnRvLmJlLmVxdWFsKDExMTExMTExMSk7XG4gIH0pO1xuXG4gIGl0KCdoYXMgdHlwaW5nVGltZXN0YW1wIHNldCB3aXRoIERhdGUubm93KCkgaWYgdmFsdWUgbm90IHBhc3NlZCcsICgpID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IFR5cGluZ01lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgaXNUeXBpbmc6IHRydWUsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGxldCB0aW1lc3RhbXAgPSBkZWNvZGVkLnR5cGluZ01lc3NhZ2U/LnRpbWVzdGFtcDtcbiAgICBpZiAodGltZXN0YW1wIGluc3RhbmNlb2YgTG9uZykge1xuICAgICAgdGltZXN0YW1wID0gdGltZXN0YW1wLnRvTnVtYmVyKCk7XG4gICAgfVxuICAgIGV4cGVjdCh0aW1lc3RhbXApLnRvLmJlLmFwcHJveGltYXRlbHkoRGF0ZS5ub3coKSwgMTApO1xuICB9KTtcblxuICBpdCgnY29ycmVjdCB0dGwnLCAoKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IG5ldyBUeXBpbmdNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIGlzVHlwaW5nOiB0cnVlLFxuICAgIH0pO1xuICAgIGV4cGVjdChtZXNzYWdlLnR0bCgpKS50by5lcXVhbChDb25zdGFudHMuVFRMX0RFRkFVTFQuVFlQSU5HX01FU1NBR0UpO1xuICB9KTtcblxuICBpdCgnaGFzIGFuIGlkZW50aWZpZXInLCAoKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IG5ldyBUeXBpbmdNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIGlzVHlwaW5nOiB0cnVlLFxuICAgIH0pO1xuICAgIGV4cGVjdChtZXNzYWdlLmlkZW50aWZpZXIpLnRvLm5vdC5lcXVhbChudWxsLCAnaWRlbnRpZmllciBjYW5ub3QgYmUgbnVsbCcpO1xuICAgIGV4cGVjdChtZXNzYWdlLmlkZW50aWZpZXIpLnRvLm5vdC5lcXVhbCh1bmRlZmluZWQsICdpZGVudGlmaWVyIGNhbm5vdCBiZSB1bmRlZmluZWQnKTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGtCQUF1QjtBQUV2QixzQkFBOEI7QUFDOUIsa0JBQWlCO0FBQ2pCLG9CQUF5QjtBQUN6QixxQkFBMEI7QUFDMUIsMkJBQThCO0FBRTlCLFNBQVMsaUJBQWlCLE1BQU07QUFDOUIsS0FBRyx5Q0FBeUMsTUFBTTtBQUNoRCxVQUFNLFVBQVUsSUFBSSxtQ0FBYztBQUFBLE1BQ2hDLFdBQVcsS0FBSyxJQUFJO0FBQUEsTUFDcEIsVUFBVTtBQUFBLElBQ1osQ0FBQztBQUNELFVBQU0sWUFBWSxRQUFRLGdCQUFnQjtBQUMxQyxVQUFNLFVBQVUsOEJBQWMsUUFBUSxPQUFPLFNBQVM7QUFDdEQsNEJBQU8sUUFBUSxhQUFhLEVBQUUsR0FBRyxLQUFLLFNBQ3BDLFVBQ0EsOEJBQWMsY0FBYyxPQUFPLE9BQ3JDO0FBQUEsRUFDRixDQUFDO0FBRUQsS0FBRywwQ0FBMEMsTUFBTTtBQUNqRCxVQUFNLFVBQVUsSUFBSSxtQ0FBYztBQUFBLE1BQ2hDLFdBQVcsS0FBSyxJQUFJO0FBQUEsTUFDcEIsVUFBVTtBQUFBLElBQ1osQ0FBQztBQUNELFVBQU0sWUFBWSxRQUFRLGdCQUFnQjtBQUMxQyxVQUFNLFVBQVUsOEJBQWMsUUFBUSxPQUFPLFNBQVM7QUFDdEQsNEJBQU8sUUFBUSxhQUFhLEVBQUUsR0FBRyxLQUFLLFNBQ3BDLFVBQ0EsOEJBQWMsY0FBYyxPQUFPLE9BQ3JDO0FBQUEsRUFDRixDQUFDO0FBRUQsS0FBRywyQ0FBMkMsTUFBTTtBQW5DdEQ7QUFvQ0ksVUFBTSxVQUFVLElBQUksbUNBQWM7QUFBQSxNQUNoQyxXQUFXLEtBQUssSUFBSTtBQUFBLE1BQ3BCLFVBQVU7QUFBQSxNQUNWLGlCQUFpQjtBQUFBLElBQ25CLENBQUM7QUFDRCxVQUFNLFlBQVksUUFBUSxnQkFBZ0I7QUFDMUMsVUFBTSxVQUFVLDhCQUFjLFFBQVEsT0FBTyxTQUFTO0FBQ3RELFVBQU0sbUJBQW1CLDRCQUFTLGNBQVEsa0JBQVIsbUJBQXVCLFNBQVM7QUFDbEUsNEJBQU8sZ0JBQWdCLEVBQUUsR0FBRyxHQUFHLE1BQU0sU0FBUztBQUFBLEVBQ2hELENBQUM7QUFFRCxLQUFHLCtEQUErRCxNQUFNO0FBL0MxRTtBQWdESSxVQUFNLFVBQVUsSUFBSSxtQ0FBYztBQUFBLE1BQ2hDLFdBQVcsS0FBSyxJQUFJO0FBQUEsTUFDcEIsVUFBVTtBQUFBLElBQ1osQ0FBQztBQUNELFVBQU0sWUFBWSxRQUFRLGdCQUFnQjtBQUMxQyxVQUFNLFVBQVUsOEJBQWMsUUFBUSxPQUFPLFNBQVM7QUFDdEQsUUFBSSxZQUFZLGNBQVEsa0JBQVIsbUJBQXVCO0FBQ3ZDLFFBQUkscUJBQXFCLHFCQUFNO0FBQzdCLGtCQUFZLFVBQVUsU0FBUztBQUFBLElBQ2pDO0FBQ0EsNEJBQU8sU0FBUyxFQUFFLEdBQUcsR0FBRyxjQUFjLEtBQUssSUFBSSxHQUFHLEVBQUU7QUFBQSxFQUN0RCxDQUFDO0FBRUQsS0FBRyxlQUFlLE1BQU07QUFDdEIsVUFBTSxVQUFVLElBQUksbUNBQWM7QUFBQSxNQUNoQyxXQUFXLEtBQUssSUFBSTtBQUFBLE1BQ3BCLFVBQVU7QUFBQSxJQUNaLENBQUM7QUFDRCw0QkFBTyxRQUFRLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSx5QkFBVSxZQUFZLGNBQWM7QUFBQSxFQUNyRSxDQUFDO0FBRUQsS0FBRyxxQkFBcUIsTUFBTTtBQUM1QixVQUFNLFVBQVUsSUFBSSxtQ0FBYztBQUFBLE1BQ2hDLFdBQVcsS0FBSyxJQUFJO0FBQUEsTUFDcEIsVUFBVTtBQUFBLElBQ1osQ0FBQztBQUNELDRCQUFPLFFBQVEsVUFBVSxFQUFFLEdBQUcsSUFBSSxNQUFNLE1BQU0sMkJBQTJCO0FBQ3pFLDRCQUFPLFFBQVEsVUFBVSxFQUFFLEdBQUcsSUFBSSxNQUFNLFFBQVcsZ0NBQWdDO0FBQUEsRUFDckYsQ0FBQztBQUNILENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
