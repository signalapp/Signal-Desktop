var import_chai = require("chai");
var import_protobuf = require("../../../../protobuf");
var import_util = require("util");
var import_lodash = require("lodash");
var import_session = require("../../../../session");
var import_VisibleMessage = require("../../../../session/messages/outgoing/visibleMessage/VisibleMessage");
describe("VisibleMessage", () => {
  it("can create empty message with just a timestamp", () => {
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now()
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded).to.have.not.property("dataMessage", null);
    (0, import_chai.expect)(decoded).to.have.not.property("dataMessage", void 0);
  });
  it("can create message with a body", () => {
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      body: "body"
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.dataMessage).to.have.deep.property("body", "body");
  });
  it("can create message with a expire timer", () => {
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      expireTimer: 3600
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.dataMessage).to.have.deep.property("expireTimer", 3600);
  });
  it("can create message with a full loki profile", () => {
    const profileKey = new import_util.TextEncoder().encode("profileKey");
    const lokiProfile = {
      displayName: "displayName",
      avatarPointer: "avatarPointer",
      profileKey
    };
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      lokiProfile
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.dataMessage).to.have.deep.property("profile");
    (0, import_chai.expect)(decoded.dataMessage).to.have.property("profile").to.have.deep.property("displayName", "displayName");
    (0, import_chai.expect)(decoded.dataMessage).to.have.property("profile").to.have.deep.property("profilePicture", "avatarPointer");
    (0, import_chai.expect)(decoded.dataMessage).to.have.deep.property("profileKey", profileKey);
  });
  it("can create message with a quote without attachments", () => {
    var _a, _b, _c, _d;
    let quote;
    quote = { id: 1234, author: "author", text: "text" };
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      quote
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    const decodedID = (0, import_lodash.toNumber)((_b = (_a = decoded.dataMessage) == null ? void 0 : _a.quote) == null ? void 0 : _b.id);
    (0, import_chai.expect)(decodedID).to.be.equal(1234);
    (0, import_chai.expect)((_c = decoded.dataMessage) == null ? void 0 : _c.quote).to.have.deep.property("author", "author");
    (0, import_chai.expect)((_d = decoded.dataMessage) == null ? void 0 : _d.quote).to.have.deep.property("text", "text");
  });
  it("can create message with a preview", () => {
    var _a;
    let preview;
    preview = { url: "url", title: "title" };
    const previews = new Array();
    previews.push(preview);
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      preview: previews
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)((_a = decoded.dataMessage) == null ? void 0 : _a.preview).to.have.lengthOf(1);
    (0, import_chai.expect)(decoded.dataMessage).to.have.nested.property("preview[0].url").to.be.deep.equal("url");
    (0, import_chai.expect)(decoded.dataMessage).to.have.nested.property("preview[0].title").to.be.deep.equal("title");
  });
  it("can create message with an AttachmentPointer", () => {
    var _a, _b, _c;
    let attachment;
    attachment = { url: "url", contentType: "contentType", id: 1234 };
    const attachments = new Array();
    attachments.push(attachment);
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now(),
      attachments
    });
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)((_a = decoded.dataMessage) == null ? void 0 : _a.attachments).to.have.lengthOf(1);
    const firstAttachment = (_c = (_b = decoded == null ? void 0 : decoded.dataMessage) == null ? void 0 : _b.attachments) == null ? void 0 : _c[0];
    const decodedID = (0, import_lodash.toNumber)(firstAttachment == null ? void 0 : firstAttachment.id);
    (0, import_chai.expect)(decodedID).to.be.equal(1234);
    (0, import_chai.expect)(firstAttachment == null ? void 0 : firstAttachment.contentType).to.be.deep.equal("contentType");
    (0, import_chai.expect)(firstAttachment == null ? void 0 : firstAttachment.url).to.be.deep.equal("url");
  });
  it("correct ttl", () => {
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now()
    });
    (0, import_chai.expect)(message.ttl()).to.equal(import_session.Constants.TTL_DEFAULT.TTL_MAX);
  });
  it("has an identifier", () => {
    const message = new import_VisibleMessage.VisibleMessage({
      timestamp: Date.now()
    });
    (0, import_chai.expect)(message.identifier).to.not.equal(null, "identifier cannot be null");
    (0, import_chai.expect)(message.identifier).to.not.equal(void 0, "identifier cannot be undefined");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvbWVzc2FnZXMvQ2hhdE1lc3NhZ2VfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XG5cbmltcG9ydCB7IFNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wcm90b2J1Zic7XG5pbXBvcnQgeyBUZXh0RW5jb2RlciB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbic7XG5pbXBvcnQge1xuICBBdHRhY2htZW50UG9pbnRlcldpdGhVcmwsXG4gIFByZXZpZXdXaXRoQXR0YWNobWVudFVybCxcbiAgUXVvdGUsXG4gIFZpc2libGVNZXNzYWdlLFxufSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL21lc3NhZ2VzL291dGdvaW5nL3Zpc2libGVNZXNzYWdlL1Zpc2libGVNZXNzYWdlJztcblxuZGVzY3JpYmUoJ1Zpc2libGVNZXNzYWdlJywgKCkgPT4ge1xuICBpdCgnY2FuIGNyZWF0ZSBlbXB0eSBtZXNzYWdlIHdpdGgganVzdCBhIHRpbWVzdGFtcCcsICgpID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IFZpc2libGVNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgICBjb25zdCBwbGFpblRleHQgPSBtZXNzYWdlLnBsYWluVGV4dEJ1ZmZlcigpO1xuICAgIGNvbnN0IGRlY29kZWQgPSBTaWduYWxTZXJ2aWNlLkNvbnRlbnQuZGVjb2RlKHBsYWluVGV4dCk7XG4gICAgZXhwZWN0KGRlY29kZWQpLnRvLmhhdmUubm90LnByb3BlcnR5KCdkYXRhTWVzc2FnZScsIG51bGwpO1xuICAgIGV4cGVjdChkZWNvZGVkKS50by5oYXZlLm5vdC5wcm9wZXJ0eSgnZGF0YU1lc3NhZ2UnLCB1bmRlZmluZWQpO1xuICB9KTtcblxuICBpdCgnY2FuIGNyZWF0ZSBtZXNzYWdlIHdpdGggYSBib2R5JywgKCkgPT4ge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgYm9keTogJ2JvZHknLFxuICAgIH0pO1xuICAgIGNvbnN0IHBsYWluVGV4dCA9IG1lc3NhZ2UucGxhaW5UZXh0QnVmZmVyKCk7XG4gICAgY29uc3QgZGVjb2RlZCA9IFNpZ25hbFNlcnZpY2UuQ29udGVudC5kZWNvZGUocGxhaW5UZXh0KTtcbiAgICBleHBlY3QoZGVjb2RlZC5kYXRhTWVzc2FnZSkudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdib2R5JywgJ2JvZHknKTtcbiAgfSk7XG5cbiAgaXQoJ2NhbiBjcmVhdGUgbWVzc2FnZSB3aXRoIGEgZXhwaXJlIHRpbWVyJywgKCkgPT4ge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgZXhwaXJlVGltZXI6IDM2MDAsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ2V4cGlyZVRpbWVyJywgMzYwMCk7XG4gIH0pO1xuXG4gIGl0KCdjYW4gY3JlYXRlIG1lc3NhZ2Ugd2l0aCBhIGZ1bGwgbG9raSBwcm9maWxlJywgKCkgPT4ge1xuICAgIGNvbnN0IHByb2ZpbGVLZXkgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoJ3Byb2ZpbGVLZXknKTtcblxuICAgIGNvbnN0IGxva2lQcm9maWxlID0ge1xuICAgICAgZGlzcGxheU5hbWU6ICdkaXNwbGF5TmFtZScsXG4gICAgICBhdmF0YXJQb2ludGVyOiAnYXZhdGFyUG9pbnRlcicsXG4gICAgICBwcm9maWxlS2V5LFxuICAgIH07XG4gICAgY29uc3QgbWVzc2FnZSA9IG5ldyBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBsb2tpUHJvZmlsZTogbG9raVByb2ZpbGUsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ3Byb2ZpbGUnKTtcblxuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlKVxuICAgICAgLnRvLmhhdmUucHJvcGVydHkoJ3Byb2ZpbGUnKVxuICAgICAgLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnZGlzcGxheU5hbWUnLCAnZGlzcGxheU5hbWUnKTtcbiAgICBleHBlY3QoZGVjb2RlZC5kYXRhTWVzc2FnZSlcbiAgICAgIC50by5oYXZlLnByb3BlcnR5KCdwcm9maWxlJylcbiAgICAgIC50by5oYXZlLmRlZXAucHJvcGVydHkoJ3Byb2ZpbGVQaWN0dXJlJywgJ2F2YXRhclBvaW50ZXInKTtcbiAgICBleHBlY3QoZGVjb2RlZC5kYXRhTWVzc2FnZSkudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdwcm9maWxlS2V5JywgcHJvZmlsZUtleSk7XG4gIH0pO1xuXG4gIGl0KCdjYW4gY3JlYXRlIG1lc3NhZ2Ugd2l0aCBhIHF1b3RlIHdpdGhvdXQgYXR0YWNobWVudHMnLCAoKSA9PiB7XG4gICAgbGV0IHF1b3RlOiBRdW90ZTtcblxuICAgIHF1b3RlID0geyBpZDogMTIzNCwgYXV0aG9yOiAnYXV0aG9yJywgdGV4dDogJ3RleHQnIH07XG4gICAgY29uc3QgbWVzc2FnZSA9IG5ldyBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBxdW90ZSxcbiAgICB9KTtcbiAgICBjb25zdCBwbGFpblRleHQgPSBtZXNzYWdlLnBsYWluVGV4dEJ1ZmZlcigpO1xuICAgIGNvbnN0IGRlY29kZWQgPSBTaWduYWxTZXJ2aWNlLkNvbnRlbnQuZGVjb2RlKHBsYWluVGV4dCk7XG4gICAgY29uc3QgZGVjb2RlZElEID0gdG9OdW1iZXIoZGVjb2RlZC5kYXRhTWVzc2FnZT8ucXVvdGU/LmlkKTtcbiAgICBleHBlY3QoZGVjb2RlZElEKS50by5iZS5lcXVhbCgxMjM0KTtcbiAgICBleHBlY3QoZGVjb2RlZC5kYXRhTWVzc2FnZT8ucXVvdGUpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnYXV0aG9yJywgJ2F1dGhvcicpO1xuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlPy5xdW90ZSkudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCd0ZXh0JywgJ3RleHQnKTtcbiAgfSk7XG5cbiAgaXQoJ2NhbiBjcmVhdGUgbWVzc2FnZSB3aXRoIGEgcHJldmlldycsICgpID0+IHtcbiAgICBsZXQgcHJldmlldzogUHJldmlld1dpdGhBdHRhY2htZW50VXJsO1xuXG4gICAgcHJldmlldyA9IHsgdXJsOiAndXJsJywgdGl0bGU6ICd0aXRsZScgfTtcbiAgICBjb25zdCBwcmV2aWV3cyA9IG5ldyBBcnJheTxQcmV2aWV3V2l0aEF0dGFjaG1lbnRVcmw+KCk7XG4gICAgcHJldmlld3MucHVzaChwcmV2aWV3KTtcblxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgVmlzaWJsZU1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgcHJldmlldzogcHJldmlld3MsXG4gICAgfSk7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlPy5wcmV2aWV3KS50by5oYXZlLmxlbmd0aE9mKDEpO1xuICAgIGV4cGVjdChkZWNvZGVkLmRhdGFNZXNzYWdlKVxuICAgICAgLnRvLmhhdmUubmVzdGVkLnByb3BlcnR5KCdwcmV2aWV3WzBdLnVybCcpXG4gICAgICAudG8uYmUuZGVlcC5lcXVhbCgndXJsJyk7XG4gICAgZXhwZWN0KGRlY29kZWQuZGF0YU1lc3NhZ2UpXG4gICAgICAudG8uaGF2ZS5uZXN0ZWQucHJvcGVydHkoJ3ByZXZpZXdbMF0udGl0bGUnKVxuICAgICAgLnRvLmJlLmRlZXAuZXF1YWwoJ3RpdGxlJyk7XG4gIH0pO1xuXG4gIGl0KCdjYW4gY3JlYXRlIG1lc3NhZ2Ugd2l0aCBhbiBBdHRhY2htZW50UG9pbnRlcicsICgpID0+IHtcbiAgICBsZXQgYXR0YWNobWVudDogQXR0YWNobWVudFBvaW50ZXJXaXRoVXJsO1xuXG4gICAgYXR0YWNobWVudCA9IHsgdXJsOiAndXJsJywgY29udGVudFR5cGU6ICdjb250ZW50VHlwZScsIGlkOiAxMjM0IH07XG4gICAgY29uc3QgYXR0YWNobWVudHMgPSBuZXcgQXJyYXk8QXR0YWNobWVudFBvaW50ZXJXaXRoVXJsPigpO1xuICAgIGF0dGFjaG1lbnRzLnB1c2goYXR0YWNobWVudCk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IFZpc2libGVNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIGF0dGFjaG1lbnRzOiBhdHRhY2htZW50cyxcbiAgICB9KTtcbiAgICBjb25zdCBwbGFpblRleHQgPSBtZXNzYWdlLnBsYWluVGV4dEJ1ZmZlcigpO1xuICAgIGNvbnN0IGRlY29kZWQgPSBTaWduYWxTZXJ2aWNlLkNvbnRlbnQuZGVjb2RlKHBsYWluVGV4dCk7XG4gICAgZXhwZWN0KGRlY29kZWQuZGF0YU1lc3NhZ2U/LmF0dGFjaG1lbnRzKS50by5oYXZlLmxlbmd0aE9mKDEpO1xuICAgIGNvbnN0IGZpcnN0QXR0YWNobWVudCA9IGRlY29kZWQ/LmRhdGFNZXNzYWdlPy5hdHRhY2htZW50cz8uWzBdO1xuICAgIGNvbnN0IGRlY29kZWRJRCA9IHRvTnVtYmVyKGZpcnN0QXR0YWNobWVudD8uaWQpO1xuICAgIGV4cGVjdChkZWNvZGVkSUQpLnRvLmJlLmVxdWFsKDEyMzQpO1xuICAgIGV4cGVjdChmaXJzdEF0dGFjaG1lbnQ/LmNvbnRlbnRUeXBlKS50by5iZS5kZWVwLmVxdWFsKCdjb250ZW50VHlwZScpO1xuICAgIGV4cGVjdChmaXJzdEF0dGFjaG1lbnQ/LnVybCkudG8uYmUuZGVlcC5lcXVhbCgndXJsJyk7XG4gIH0pO1xuXG4gIGl0KCdjb3JyZWN0IHR0bCcsICgpID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IFZpc2libGVNZXNzYWdlKHtcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgICBleHBlY3QobWVzc2FnZS50dGwoKSkudG8uZXF1YWwoQ29uc3RhbnRzLlRUTF9ERUZBVUxULlRUTF9NQVgpO1xuICB9KTtcblxuICBpdCgnaGFzIGFuIGlkZW50aWZpZXInLCAoKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IG5ldyBWaXNpYmxlTWVzc2FnZSh7XG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgfSk7XG4gICAgZXhwZWN0KG1lc3NhZ2UuaWRlbnRpZmllcikudG8ubm90LmVxdWFsKG51bGwsICdpZGVudGlmaWVyIGNhbm5vdCBiZSBudWxsJyk7XG4gICAgZXhwZWN0KG1lc3NhZ2UuaWRlbnRpZmllcikudG8ubm90LmVxdWFsKHVuZGVmaW5lZCwgJ2lkZW50aWZpZXIgY2Fubm90IGJlIHVuZGVmaW5lZCcpO1xuICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUEsa0JBQXVCO0FBRXZCLHNCQUE4QjtBQUM5QixrQkFBNEI7QUFDNUIsb0JBQXlCO0FB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
