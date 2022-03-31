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
var import_chai = __toESM(require("chai"));
var import_ConfigurationMessage = require("../../../../session/messages/outgoing/controlMessage/ConfigurationMessage");
var import_utils = require("../../../../session/utils");
var import_test_utils = require("../../../test-utils");
var sinon = __toESM(require("sinon"));
var cache = __toESM(require("../../../../receiver/cache"));
var data = __toESM(require("../../../../../ts/data/data"));
var import_chai_as_promised = __toESM(require("chai-as-promised"));
var import_configMessage = require("../../../../receiver/configMessage");
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { expect } = import_chai.default;
describe("ConfigurationMessage_receiving", () => {
  const sandbox = sinon.createSandbox();
  let createOrUpdateStub;
  let getItemByIdStub;
  let sender;
  let envelope;
  let config;
  beforeEach(() => {
    sandbox.stub(cache, "removeFromCache").resolves();
    sender = import_test_utils.TestUtils.generateFakePubKey().key;
    config = new import_ConfigurationMessage.ConfigurationMessage({
      activeOpenGroups: [],
      activeClosedGroups: [],
      timestamp: Date.now(),
      identifier: "identifier",
      displayName: "displayName",
      contacts: []
    });
  });
  afterEach(() => {
    import_test_utils.TestUtils.restoreStubs();
    sandbox.restore();
  });
  it("should not be processed if we do not have a pubkey", async () => {
    sandbox.stub(import_utils.UserUtils, "getOurPubKeyStrFromCache").resolves(void 0);
    envelope = import_test_utils.TestUtils.generateEnvelopePlus(sender);
    const proto = config.contentProto();
    createOrUpdateStub = sandbox.stub(data, "createOrUpdateItem").resolves();
    getItemByIdStub = sandbox.stub(data, "getItemById").resolves();
    await (0, import_configMessage.handleConfigurationMessage)(envelope, proto.configurationMessage);
    expect(createOrUpdateStub.callCount).to.equal(0);
    expect(getItemByIdStub.callCount).to.equal(0);
  });
  describe("with ourNumber set", () => {
    const ourNumber = import_test_utils.TestUtils.generateFakePubKey().key;
    beforeEach(() => {
      sandbox.stub(import_utils.UserUtils, "getOurPubKeyStrFromCache").resolves(ourNumber);
    });
    it("should not be processed if the message is not coming from our number", async () => {
      const proto = config.contentProto();
      envelope = import_test_utils.TestUtils.generateEnvelopePlus(sender);
      createOrUpdateStub = sandbox.stub(data, "createOrUpdateItem").resolves();
      getItemByIdStub = sandbox.stub(data, "getItemById").resolves();
      await (0, import_configMessage.handleConfigurationMessage)(envelope, proto.configurationMessage);
      expect(createOrUpdateStub.callCount).to.equal(0);
      expect(getItemByIdStub.callCount).to.equal(0);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvcmVjZWl2aW5nL0NvbmZpZ3VyYXRpb25NZXNzYWdlX3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHRzbGludDpkaXNhYmxlOiBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcblxuaW1wb3J0IHsgU2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Byb3RvYnVmJztcbmltcG9ydCBjaGFpIGZyb20gJ2NoYWknO1xuXG5pbXBvcnQgeyBDb25maWd1cmF0aW9uTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vbWVzc2FnZXMvb3V0Z29pbmcvY29udHJvbE1lc3NhZ2UvQ29uZmlndXJhdGlvbk1lc3NhZ2UnO1xuaW1wb3J0IHsgVXNlclV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi91dGlscyc7XG5pbXBvcnQgeyBUZXN0VXRpbHMgfSBmcm9tICcuLi8uLi8uLi90ZXN0LXV0aWxzJztcblxuaW1wb3J0IFNpbm9uLCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCAqIGFzIGNhY2hlIGZyb20gJy4uLy4uLy4uLy4uL3JlY2VpdmVyL2NhY2hlJztcbmltcG9ydCAqIGFzIGRhdGEgZnJvbSAnLi4vLi4vLi4vLi4vLi4vdHMvZGF0YS9kYXRhJztcbmltcG9ydCB7IEVudmVsb3BlUGx1cyB9IGZyb20gJy4uLy4uLy4uLy4uL3JlY2VpdmVyL3R5cGVzJztcblxuaW1wb3J0IGNoYWlBc1Byb21pc2VkIGZyb20gJ2NoYWktYXMtcHJvbWlzZWQnO1xuaW1wb3J0IHsgaGFuZGxlQ29uZmlndXJhdGlvbk1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9yZWNlaXZlci9jb25maWdNZXNzYWdlJztcbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkIGFzIGFueSk7XG5jaGFpLnNob3VsZCgpO1xuXG5jb25zdCB7IGV4cGVjdCB9ID0gY2hhaTtcblxuZGVzY3JpYmUoJ0NvbmZpZ3VyYXRpb25NZXNzYWdlX3JlY2VpdmluZycsICgpID0+IHtcbiAgY29uc3Qgc2FuZGJveCA9IHNpbm9uLmNyZWF0ZVNhbmRib3goKTtcbiAgbGV0IGNyZWF0ZU9yVXBkYXRlU3R1YjogU2lub24uU2lub25TdHViPGFueT47XG4gIGxldCBnZXRJdGVtQnlJZFN0dWI6IFNpbm9uLlNpbm9uU3R1Yjxhbnk+O1xuICBsZXQgc2VuZGVyOiBzdHJpbmc7XG5cbiAgbGV0IGVudmVsb3BlOiBFbnZlbG9wZVBsdXM7XG4gIGxldCBjb25maWc6IENvbmZpZ3VyYXRpb25NZXNzYWdlO1xuXG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIHNhbmRib3guc3R1YihjYWNoZSwgJ3JlbW92ZUZyb21DYWNoZScpLnJlc29sdmVzKCk7XG4gICAgc2VuZGVyID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpLmtleTtcbiAgICBjb25maWcgPSBuZXcgQ29uZmlndXJhdGlvbk1lc3NhZ2Uoe1xuICAgICAgYWN0aXZlT3Blbkdyb3VwczogW10sXG4gICAgICBhY3RpdmVDbG9zZWRHcm91cHM6IFtdLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgaWRlbnRpZmllcjogJ2lkZW50aWZpZXInLFxuICAgICAgZGlzcGxheU5hbWU6ICdkaXNwbGF5TmFtZScsXG4gICAgICBjb250YWN0czogW10sXG4gICAgfSk7XG4gIH0pO1xuXG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgVGVzdFV0aWxzLnJlc3RvcmVTdHVicygpO1xuICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICB9KTtcblxuICBpdCgnc2hvdWxkIG5vdCBiZSBwcm9jZXNzZWQgaWYgd2UgZG8gbm90IGhhdmUgYSBwdWJrZXknLCBhc3luYyAoKSA9PiB7XG4gICAgc2FuZGJveC5zdHViKFVzZXJVdGlscywgJ2dldE91clB1YktleVN0ckZyb21DYWNoZScpLnJlc29sdmVzKHVuZGVmaW5lZCk7XG4gICAgZW52ZWxvcGUgPSBUZXN0VXRpbHMuZ2VuZXJhdGVFbnZlbG9wZVBsdXMoc2VuZGVyKTtcblxuICAgIGNvbnN0IHByb3RvID0gY29uZmlnLmNvbnRlbnRQcm90bygpO1xuICAgIGNyZWF0ZU9yVXBkYXRlU3R1YiA9IHNhbmRib3guc3R1YihkYXRhLCAnY3JlYXRlT3JVcGRhdGVJdGVtJykucmVzb2x2ZXMoKTtcbiAgICBnZXRJdGVtQnlJZFN0dWIgPSBzYW5kYm94LnN0dWIoZGF0YSwgJ2dldEl0ZW1CeUlkJykucmVzb2x2ZXMoKTtcbiAgICBhd2FpdCBoYW5kbGVDb25maWd1cmF0aW9uTWVzc2FnZShcbiAgICAgIGVudmVsb3BlLFxuICAgICAgcHJvdG8uY29uZmlndXJhdGlvbk1lc3NhZ2UgYXMgU2lnbmFsU2VydmljZS5Db25maWd1cmF0aW9uTWVzc2FnZVxuICAgICk7XG4gICAgZXhwZWN0KGNyZWF0ZU9yVXBkYXRlU3R1Yi5jYWxsQ291bnQpLnRvLmVxdWFsKDApO1xuICAgIGV4cGVjdChnZXRJdGVtQnlJZFN0dWIuY2FsbENvdW50KS50by5lcXVhbCgwKTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3dpdGggb3VyTnVtYmVyIHNldCcsICgpID0+IHtcbiAgICBjb25zdCBvdXJOdW1iZXIgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuXG4gICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICBzYW5kYm94LnN0dWIoVXNlclV0aWxzLCAnZ2V0T3VyUHViS2V5U3RyRnJvbUNhY2hlJykucmVzb2x2ZXMob3VyTnVtYmVyKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgbm90IGJlIHByb2Nlc3NlZCBpZiB0aGUgbWVzc2FnZSBpcyBub3QgY29taW5nIGZyb20gb3VyIG51bWJlcicsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHByb3RvID0gY29uZmlnLmNvbnRlbnRQcm90bygpO1xuICAgICAgLy8gc2VuZGVyICE9PSBvdXJOdW1iZXJcbiAgICAgIGVudmVsb3BlID0gVGVzdFV0aWxzLmdlbmVyYXRlRW52ZWxvcGVQbHVzKHNlbmRlcik7XG5cbiAgICAgIGNyZWF0ZU9yVXBkYXRlU3R1YiA9IHNhbmRib3guc3R1YihkYXRhLCAnY3JlYXRlT3JVcGRhdGVJdGVtJykucmVzb2x2ZXMoKTtcbiAgICAgIGdldEl0ZW1CeUlkU3R1YiA9IHNhbmRib3guc3R1YihkYXRhLCAnZ2V0SXRlbUJ5SWQnKS5yZXNvbHZlcygpO1xuICAgICAgYXdhaXQgaGFuZGxlQ29uZmlndXJhdGlvbk1lc3NhZ2UoXG4gICAgICAgIGVudmVsb3BlLFxuICAgICAgICBwcm90by5jb25maWd1cmF0aW9uTWVzc2FnZSBhcyBTaWduYWxTZXJ2aWNlLkNvbmZpZ3VyYXRpb25NZXNzYWdlXG4gICAgICApO1xuICAgICAgZXhwZWN0KGNyZWF0ZU9yVXBkYXRlU3R1Yi5jYWxsQ291bnQpLnRvLmVxdWFsKDApO1xuICAgICAgZXhwZWN0KGdldEl0ZW1CeUlkU3R1Yi5jYWxsQ291bnQpLnRvLmVxdWFsKDApO1xuICAgIH0pO1xuXG4gICAgLy8gaXQoJ3Nob3VsZCBiZSBwcm9jZXNzZWQgaWYgdGhlIG1lc3NhZ2UgaXMgY29taW5nIGZyb20gb3VyIG51bWJlcicsIGFzeW5jICgpID0+IHtcbiAgICAvLyAgICAgY29uc3QgcHJvdG8gPSBjb25maWcuY29udGVudFByb3RvKCk7XG4gICAgLy8gICAgIGVudmVsb3BlID0gVGVzdFV0aWxzLmdlbmVyYXRlRW52ZWxvcGVQbHVzKG91ck51bWJlcik7XG5cbiAgICAvLyAgICAgY3JlYXRlT3JVcGRhdGVTdHViID0gc2FuZGJveC5zdHViKGRhdGEsICdjcmVhdGVPclVwZGF0ZUl0ZW0nKS5yZXNvbHZlcygpO1xuICAgIC8vICAgICBnZXRJdGVtQnlJZFN0dWIgPSBzYW5kYm94LnN0dWIoZGF0YSwgJ2dldEl0ZW1CeUlkJykucmVzb2x2ZXMoKTtcbiAgICAvLyAgICAgYXdhaXQgaGFuZGxlQ29uZmlndXJhdGlvbk1lc3NhZ2UoZW52ZWxvcGUsIHByb3RvLmNvbmZpZ3VyYXRpb25NZXNzYWdlIGFzIFNpZ25hbFNlcnZpY2UuQ29uZmlndXJhdGlvbk1lc3NhZ2UpO1xuICAgIC8vICAgICBleHBlY3QoZ2V0SXRlbUJ5SWRTdHViLmNhbGxDb3VudCkudG8uZXF1YWwoMSk7XG4gICAgLy8gfSk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7QUFHQSxrQkFBaUI7QUFFakIsa0NBQXFDO0FBQ3JDLG1CQUEwQjtBQUMxQix3QkFBMEI7QUFFMUIsWUFBOEI7QUFDOUIsWUFBdUI7QUFDdkIsV0FBc0I7QUFHdEIsOEJBQTJCO0FBQzNCLDJCQUEyQztBQUMzQyxvQkFBSyxJQUFJLCtCQUFxQjtBQUM5QixvQkFBSyxPQUFPO0FBRVosTUFBTSxFQUFFLFdBQVc7QUFFbkIsU0FBUyxrQ0FBa0MsTUFBTTtBQUMvQyxRQUFNLFVBQVUsTUFBTSxjQUFjO0FBQ3BDLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUVKLE1BQUk7QUFDSixNQUFJO0FBRUosYUFBVyxNQUFNO0FBQ2YsWUFBUSxLQUFLLE9BQU8saUJBQWlCLEVBQUUsU0FBUztBQUNoRCxhQUFTLDRCQUFVLG1CQUFtQixFQUFFO0FBQ3hDLGFBQVMsSUFBSSxpREFBcUI7QUFBQSxNQUNoQyxrQkFBa0IsQ0FBQztBQUFBLE1BQ25CLG9CQUFvQixDQUFDO0FBQUEsTUFDckIsV0FBVyxLQUFLLElBQUk7QUFBQSxNQUNwQixZQUFZO0FBQUEsTUFDWixhQUFhO0FBQUEsTUFDYixVQUFVLENBQUM7QUFBQSxJQUNiLENBQUM7QUFBQSxFQUNILENBQUM7QUFFRCxZQUFVLE1BQU07QUFDZCxnQ0FBVSxhQUFhO0FBQ3ZCLFlBQVEsUUFBUTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxLQUFHLHNEQUFzRCxZQUFZO0FBQ25FLFlBQVEsS0FBSyx3QkFBVywwQkFBMEIsRUFBRSxTQUFTLE1BQVM7QUFDdEUsZUFBVyw0QkFBVSxxQkFBcUIsTUFBTTtBQUVoRCxVQUFNLFFBQVEsT0FBTyxhQUFhO0FBQ2xDLHlCQUFxQixRQUFRLEtBQUssTUFBTSxvQkFBb0IsRUFBRSxTQUFTO0FBQ3ZFLHNCQUFrQixRQUFRLEtBQUssTUFBTSxhQUFhLEVBQUUsU0FBUztBQUM3RCxVQUFNLHFEQUNKLFVBQ0EsTUFBTSxvQkFDUjtBQUNBLFdBQU8sbUJBQW1CLFNBQVMsRUFBRSxHQUFHLE1BQU0sQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixTQUFTLEVBQUUsR0FBRyxNQUFNLENBQUM7QUFBQSxFQUM5QyxDQUFDO0FBRUQsV0FBUyxzQkFBc0IsTUFBTTtBQUNuQyxVQUFNLFlBQVksNEJBQVUsbUJBQW1CLEVBQUU7QUFFakQsZUFBVyxNQUFNO0FBQ2YsY0FBUSxLQUFLLHdCQUFXLDBCQUEwQixFQUFFLFNBQVMsU0FBUztBQUFBLElBQ3hFLENBQUM7QUFFRCxPQUFHLHdFQUF3RSxZQUFZO0FBQ3JGLFlBQU0sUUFBUSxPQUFPLGFBQWE7QUFFbEMsaUJBQVcsNEJBQVUscUJBQXFCLE1BQU07QUFFaEQsMkJBQXFCLFFBQVEsS0FBSyxNQUFNLG9CQUFvQixFQUFFLFNBQVM7QUFDdkUsd0JBQWtCLFFBQVEsS0FBSyxNQUFNLGFBQWEsRUFBRSxTQUFTO0FBQzdELFlBQU0scURBQ0osVUFDQSxNQUFNLG9CQUNSO0FBQ0EsYUFBTyxtQkFBbUIsU0FBUyxFQUFFLEdBQUcsTUFBTSxDQUFDO0FBQy9DLGFBQU8sZ0JBQWdCLFNBQVMsRUFBRSxHQUFHLE1BQU0sQ0FBQztBQUFBLElBQzlDLENBQUM7QUFBQSxFQVdILENBQUM7QUFDSCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
