var import_chai = require("chai");
var import_mocha = require("mocha");
var import_protobuf = require("../../../../protobuf");
var import_session = require("../../../../session");
var import_GroupInvitationMessage = require("../../../../session/messages/outgoing/visibleMessage/GroupInvitationMessage");
describe("GroupInvitationMessage", () => {
  let message;
  const timestamp = Date.now();
  const url = "http://localhost";
  const name = "test";
  (0, import_mocha.beforeEach)(() => {
    message = new import_GroupInvitationMessage.GroupInvitationMessage({
      timestamp,
      url,
      name
    });
  });
  it("dataMessage.groupInvitation has url, and serverName set", () => {
    var _a, _b;
    const plainText = message.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)((_a = decoded.dataMessage) == null ? void 0 : _a.openGroupInvitation).to.have.property("url", url);
    (0, import_chai.expect)((_b = decoded.dataMessage) == null ? void 0 : _b.openGroupInvitation).to.have.property("name", name);
  });
  it("correct ttl", () => {
    (0, import_chai.expect)(message.ttl()).to.equal(import_session.Constants.TTL_DEFAULT.TTL_MAX);
  });
  it("has an identifier", () => {
    (0, import_chai.expect)(message.identifier).to.not.equal(null, "identifier cannot be null");
    (0, import_chai.expect)(message.identifier).to.not.equal(void 0, "identifier cannot be undefined");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvbWVzc2FnZXMvR3JvdXBJbnZpdGF0aW9uTWVzc2FnZV90ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcbmltcG9ydCB7IGJlZm9yZUVhY2ggfSBmcm9tICdtb2NoYSc7XG5cbmltcG9ydCB7IFNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wcm90b2J1Zic7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uJztcbmltcG9ydCB7IEdyb3VwSW52aXRhdGlvbk1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL21lc3NhZ2VzL291dGdvaW5nL3Zpc2libGVNZXNzYWdlL0dyb3VwSW52aXRhdGlvbk1lc3NhZ2UnO1xuXG5kZXNjcmliZSgnR3JvdXBJbnZpdGF0aW9uTWVzc2FnZScsICgpID0+IHtcbiAgbGV0IG1lc3NhZ2U6IEdyb3VwSW52aXRhdGlvbk1lc3NhZ2U7XG4gIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gIGNvbnN0IHVybCA9ICdodHRwOi8vbG9jYWxob3N0JztcbiAgY29uc3QgbmFtZSA9ICd0ZXN0JztcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBtZXNzYWdlID0gbmV3IEdyb3VwSW52aXRhdGlvbk1lc3NhZ2Uoe1xuICAgICAgdGltZXN0YW1wLFxuICAgICAgdXJsLFxuICAgICAgbmFtZSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgaXQoJ2RhdGFNZXNzYWdlLmdyb3VwSW52aXRhdGlvbiBoYXMgdXJsLCBhbmQgc2VydmVyTmFtZSBzZXQnLCAoKSA9PiB7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gbWVzc2FnZS5wbGFpblRleHRCdWZmZXIoKTtcbiAgICBjb25zdCBkZWNvZGVkID0gU2lnbmFsU2VydmljZS5Db250ZW50LmRlY29kZShwbGFpblRleHQpO1xuXG4gICAgZXhwZWN0KGRlY29kZWQuZGF0YU1lc3NhZ2U/Lm9wZW5Hcm91cEludml0YXRpb24pLnRvLmhhdmUucHJvcGVydHkoJ3VybCcsIHVybCk7XG4gICAgZXhwZWN0KGRlY29kZWQuZGF0YU1lc3NhZ2U/Lm9wZW5Hcm91cEludml0YXRpb24pLnRvLmhhdmUucHJvcGVydHkoJ25hbWUnLCBuYW1lKTtcbiAgfSk7XG5cbiAgaXQoJ2NvcnJlY3QgdHRsJywgKCkgPT4ge1xuICAgIGV4cGVjdChtZXNzYWdlLnR0bCgpKS50by5lcXVhbChDb25zdGFudHMuVFRMX0RFRkFVTFQuVFRMX01BWCk7XG4gIH0pO1xuXG4gIGl0KCdoYXMgYW4gaWRlbnRpZmllcicsICgpID0+IHtcbiAgICBleHBlY3QobWVzc2FnZS5pZGVudGlmaWVyKS50by5ub3QuZXF1YWwobnVsbCwgJ2lkZW50aWZpZXIgY2Fubm90IGJlIG51bGwnKTtcbiAgICBleHBlY3QobWVzc2FnZS5pZGVudGlmaWVyKS50by5ub3QuZXF1YWwodW5kZWZpbmVkLCAnaWRlbnRpZmllciBjYW5ub3QgYmUgdW5kZWZpbmVkJyk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFBQSxrQkFBdUI7QUFDdkIsbUJBQTJCO0FBRTNCLHNCQUE4QjtBQUM5QixxQkFBMEI7QUFDMUIsb0NBQXVDO0FBRXZDLFNBQVMsMEJBQTBCLE1BQU07QUFDdkMsTUFBSTtBQUNKLFFBQU0sWUFBWSxLQUFLLElBQUk7QUFDM0IsUUFBTSxNQUFNO0FBQ1osUUFBTSxPQUFPO0FBRWIsK0JBQVcsTUFBTTtBQUNmLGNBQVUsSUFBSSxxREFBdUI7QUFBQSxNQUNuQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsS0FBRywyREFBMkQsTUFBTTtBQXJCdEU7QUFzQkksVUFBTSxZQUFZLFFBQVEsZ0JBQWdCO0FBQzFDLFVBQU0sVUFBVSw4QkFBYyxRQUFRLE9BQU8sU0FBUztBQUV0RCw0QkFBTyxjQUFRLGdCQUFSLG1CQUFxQixtQkFBbUIsRUFBRSxHQUFHLEtBQUssU0FBUyxPQUFPLEdBQUc7QUFDNUUsNEJBQU8sY0FBUSxnQkFBUixtQkFBcUIsbUJBQW1CLEVBQUUsR0FBRyxLQUFLLFNBQVMsUUFBUSxJQUFJO0FBQUEsRUFDaEYsQ0FBQztBQUVELEtBQUcsZUFBZSxNQUFNO0FBQ3RCLDRCQUFPLFFBQVEsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLHlCQUFVLFlBQVksT0FBTztBQUFBLEVBQzlELENBQUM7QUFFRCxLQUFHLHFCQUFxQixNQUFNO0FBQzVCLDRCQUFPLFFBQVEsVUFBVSxFQUFFLEdBQUcsSUFBSSxNQUFNLE1BQU0sMkJBQTJCO0FBQ3pFLDRCQUFPLFFBQVEsVUFBVSxFQUFFLEdBQUcsSUFBSSxNQUFNLFFBQVcsZ0NBQWdDO0FBQUEsRUFDckYsQ0FBQztBQUNILENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
