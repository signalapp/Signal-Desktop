var import_chai = require("chai");
var import_mocha = require("mocha");
var import_protobuf = require("../../../../protobuf");
var import_lodash = require("lodash");
var import_session = require("../../../../session");
var import_ReadReceiptMessage = require("../../../../session/messages/outgoing/controlMessage/receipt/ReadReceiptMessage");
describe("ReceiptMessage", () => {
  let readMessage;
  let timestamps;
  (0, import_mocha.beforeEach)(() => {
    timestamps = [987654321, 123456789];
    const timestamp = Date.now();
    readMessage = new import_ReadReceiptMessage.ReadReceiptMessage({ timestamp, timestamps });
  });
  it("content of a read receipt is correct", () => {
    var _a;
    const plainText = readMessage.plainTextBuffer();
    const decoded = import_protobuf.SignalService.Content.decode(plainText);
    (0, import_chai.expect)(decoded.receiptMessage).to.have.property("type", 1);
    const decodedTimestamps = (((_a = decoded.receiptMessage) == null ? void 0 : _a.timestamp) ?? []).map(import_lodash.toNumber);
    (0, import_chai.expect)(decodedTimestamps).to.deep.equal(timestamps);
  });
  it("correct ttl", () => {
    (0, import_chai.expect)(readMessage.ttl()).to.equal(import_session.Constants.TTL_DEFAULT.TTL_MAX);
  });
  it("has an identifier", () => {
    (0, import_chai.expect)(readMessage.identifier).to.not.equal(null, "identifier cannot be null");
    (0, import_chai.expect)(readMessage.identifier).to.not.equal(void 0, "identifier cannot be undefined");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvbWVzc2FnZXMvUmVjZWlwdE1lc3NhZ2VfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XG5pbXBvcnQgeyBiZWZvcmVFYWNoIH0gZnJvbSAnbW9jaGEnO1xuXG5pbXBvcnQgeyBTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcHJvdG9idWYnO1xuaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbic7XG5pbXBvcnQgeyBSZWFkUmVjZWlwdE1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL21lc3NhZ2VzL291dGdvaW5nL2NvbnRyb2xNZXNzYWdlL3JlY2VpcHQvUmVhZFJlY2VpcHRNZXNzYWdlJztcblxuZGVzY3JpYmUoJ1JlY2VpcHRNZXNzYWdlJywgKCkgPT4ge1xuICBsZXQgcmVhZE1lc3NhZ2U6IFJlYWRSZWNlaXB0TWVzc2FnZTtcbiAgbGV0IHRpbWVzdGFtcHM6IEFycmF5PG51bWJlcj47XG5cbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgdGltZXN0YW1wcyA9IFs5ODc2NTQzMjEsIDEyMzQ1Njc4OV07XG4gICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICByZWFkTWVzc2FnZSA9IG5ldyBSZWFkUmVjZWlwdE1lc3NhZ2UoeyB0aW1lc3RhbXAsIHRpbWVzdGFtcHMgfSk7XG4gIH0pO1xuXG4gIGl0KCdjb250ZW50IG9mIGEgcmVhZCByZWNlaXB0IGlzIGNvcnJlY3QnLCAoKSA9PiB7XG4gICAgY29uc3QgcGxhaW5UZXh0ID0gcmVhZE1lc3NhZ2UucGxhaW5UZXh0QnVmZmVyKCk7XG4gICAgY29uc3QgZGVjb2RlZCA9IFNpZ25hbFNlcnZpY2UuQ29udGVudC5kZWNvZGUocGxhaW5UZXh0KTtcblxuICAgIGV4cGVjdChkZWNvZGVkLnJlY2VpcHRNZXNzYWdlKS50by5oYXZlLnByb3BlcnR5KCd0eXBlJywgMSk7XG4gICAgY29uc3QgZGVjb2RlZFRpbWVzdGFtcHMgPSAoZGVjb2RlZC5yZWNlaXB0TWVzc2FnZT8udGltZXN0YW1wID8/IFtdKS5tYXAodG9OdW1iZXIpO1xuICAgIGV4cGVjdChkZWNvZGVkVGltZXN0YW1wcykudG8uZGVlcC5lcXVhbCh0aW1lc3RhbXBzKTtcbiAgfSk7XG5cbiAgaXQoJ2NvcnJlY3QgdHRsJywgKCkgPT4ge1xuICAgIGV4cGVjdChyZWFkTWVzc2FnZS50dGwoKSkudG8uZXF1YWwoQ29uc3RhbnRzLlRUTF9ERUZBVUxULlRUTF9NQVgpO1xuICB9KTtcblxuICBpdCgnaGFzIGFuIGlkZW50aWZpZXInLCAoKSA9PiB7XG4gICAgZXhwZWN0KHJlYWRNZXNzYWdlLmlkZW50aWZpZXIpLnRvLm5vdC5lcXVhbChudWxsLCAnaWRlbnRpZmllciBjYW5ub3QgYmUgbnVsbCcpO1xuICAgIGV4cGVjdChyZWFkTWVzc2FnZS5pZGVudGlmaWVyKS50by5ub3QuZXF1YWwodW5kZWZpbmVkLCAnaWRlbnRpZmllciBjYW5ub3QgYmUgdW5kZWZpbmVkJyk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFBQSxrQkFBdUI7QUFDdkIsbUJBQTJCO0FBRTNCLHNCQUE4QjtBQUM5QixvQkFBeUI7QUFDekIscUJBQTBCO0FBQzFCLGdDQUFtQztBQUVuQyxTQUFTLGtCQUFrQixNQUFNO0FBQy9CLE1BQUk7QUFDSixNQUFJO0FBRUosK0JBQVcsTUFBTTtBQUNmLGlCQUFhLENBQUMsV0FBVyxTQUFTO0FBQ2xDLFVBQU0sWUFBWSxLQUFLLElBQUk7QUFDM0Isa0JBQWMsSUFBSSw2Q0FBbUIsRUFBRSxXQUFXLFdBQVcsQ0FBQztBQUFBLEVBQ2hFLENBQUM7QUFFRCxLQUFHLHdDQUF3QyxNQUFNO0FBbEJuRDtBQW1CSSxVQUFNLFlBQVksWUFBWSxnQkFBZ0I7QUFDOUMsVUFBTSxVQUFVLDhCQUFjLFFBQVEsT0FBTyxTQUFTO0FBRXRELDRCQUFPLFFBQVEsY0FBYyxFQUFFLEdBQUcsS0FBSyxTQUFTLFFBQVEsQ0FBQztBQUN6RCxVQUFNLG9CQUFxQixnQkFBUSxtQkFBUixtQkFBd0IsY0FBYSxDQUFDLEdBQUcsSUFBSSxzQkFBUTtBQUNoRiw0QkFBTyxpQkFBaUIsRUFBRSxHQUFHLEtBQUssTUFBTSxVQUFVO0FBQUEsRUFDcEQsQ0FBQztBQUVELEtBQUcsZUFBZSxNQUFNO0FBQ3RCLDRCQUFPLFlBQVksSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLHlCQUFVLFlBQVksT0FBTztBQUFBLEVBQ2xFLENBQUM7QUFFRCxLQUFHLHFCQUFxQixNQUFNO0FBQzVCLDRCQUFPLFlBQVksVUFBVSxFQUFFLEdBQUcsSUFBSSxNQUFNLE1BQU0sMkJBQTJCO0FBQzdFLDRCQUFPLFlBQVksVUFBVSxFQUFFLEdBQUcsSUFBSSxNQUFNLFFBQVcsZ0NBQWdDO0FBQUEsRUFDekYsQ0FBQztBQUNILENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
