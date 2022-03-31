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
var sinon = __toESM(require("sinon"));
var import_mocha = require("mocha");
var import_test_utils = require("../../../test-utils");
var import_snode_api = require("../../../../session/apis/snode_api");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
var OnionPaths = __toESM(require("../../../../session/onions/onionPath"));
var import_utils = require("../../../test-utils/utils");
var import_seed_node_api = require("../../../../session/apis/seed_node_api");
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { expect } = import_chai.default;
const guard1ed = "e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534e";
const guard2ed = "e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f91615349";
const guard3ed = "e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534a";
const fakeSnodePool = [
  ...(0, import_utils.generateFakeSnodes)(12),
  (0, import_utils.generateFakeSnodeWithEdKey)(guard1ed),
  (0, import_utils.generateFakeSnodeWithEdKey)(guard2ed),
  (0, import_utils.generateFakeSnodeWithEdKey)(guard3ed),
  ...(0, import_utils.generateFakeSnodes)(3)
];
const fakeSnodePoolFromSeedNode = fakeSnodePool.map((m) => {
  return {
    public_ip: m.ip,
    storage_port: m.port,
    pubkey_x25519: m.pubkey_x25519,
    pubkey_ed25519: m.pubkey_ed25519
  };
});
(0, import_mocha.describe)("SeedNodeAPI", () => {
  const sandbox = sinon.createSandbox();
  (0, import_mocha.describe)("getSnodeListFromSeednode", () => {
    beforeEach(() => {
      OnionPaths.clearTestOnionPath();
      import_test_utils.TestUtils.stubWindowLog();
      import_snode_api.Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      import_snode_api.SnodePool.TEST_resetState();
    });
    afterEach(() => {
      import_test_utils.TestUtils.restoreStubs();
      sandbox.restore();
    });
    it("if the cached snode pool has less than 12 snodes, trigger a fetch from the seed nodes with retries", async () => {
      const TEST_fetchSnodePoolFromSeedNodeRetryable = sandbox.stub(import_seed_node_api.SeedNodeAPI, "TEST_fetchSnodePoolFromSeedNodeRetryable").onFirstCall().throws().onSecondCall().resolves(fakeSnodePoolFromSeedNode);
      sandbox.stub(import_seed_node_api.SeedNodeAPI, "getMinTimeout").returns(20);
      const fetched = await import_seed_node_api.SeedNodeAPI.fetchSnodePoolFromSeedNodeWithRetries([
        { url: "seednode1" }
      ]);
      const sortedFetch = fetched.sort((a, b) => a.pubkey_ed25519 > b.pubkey_ed25519 ? -1 : 1);
      const sortedFakeSnodePool = fakeSnodePool.sort((a, b) => a.pubkey_ed25519 > b.pubkey_ed25519 ? -1 : 1);
      expect(sortedFetch).to.deep.equal(sortedFakeSnodePool);
      expect(TEST_fetchSnodePoolFromSeedNodeRetryable.callCount, "TEST_fetchSnodePoolFromSeedNodeRetryable called twice as the first one failed").to.be.eq(2);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvb25pb24vU2VlZE5vZGVBUElfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gdHNsaW50OmRpc2FibGU6IG5vLWltcGxpY2l0LWRlcGVuZGVuY2llcyBtYXgtZnVuYy1ib2R5LWxlbmd0aCBuby11bnVzZWQtZXhwcmVzc2lvblxuXG5pbXBvcnQgY2hhaSBmcm9tICdjaGFpJztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgeyBkZXNjcmliZSB9IGZyb20gJ21vY2hhJztcblxuaW1wb3J0IHsgVGVzdFV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vdGVzdC11dGlscyc7XG5pbXBvcnQgeyBPbmlvbnMsIFNub2RlUG9vbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9zbm9kZV9hcGknO1xuaW1wb3J0ICogYXMgRGF0YSBmcm9tICcuLi8uLi8uLi8uLi9kYXRhL2RhdGEnO1xuXG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgKiBhcyBPbmlvblBhdGhzIGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vb25pb25zL29uaW9uUGF0aCc7XG5pbXBvcnQgeyBnZW5lcmF0ZUZha2VTbm9kZXMsIGdlbmVyYXRlRmFrZVNub2RlV2l0aEVkS2V5IH0gZnJvbSAnLi4vLi4vLi4vdGVzdC11dGlscy91dGlscyc7XG5pbXBvcnQgeyBTZWVkTm9kZUFQSSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9zZWVkX25vZGVfYXBpJztcbmltcG9ydCB7IFNub2RlRnJvbVNlZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL2FwaXMvc2VlZF9ub2RlX2FwaS9TZWVkTm9kZUFQSSc7XG5jaGFpLnVzZShjaGFpQXNQcm9taXNlZCBhcyBhbnkpO1xuY2hhaS5zaG91bGQoKTtcblxuY29uc3QgeyBleHBlY3QgfSA9IGNoYWk7XG5cbmNvbnN0IGd1YXJkMWVkID0gJ2UzZWM2ZmNjNzllNjRjMmFmNmE0OGE5ODY1ZDRiZjRiNzM5ZWM3NzA4ZDc1ZjM1YWNjM2Q0NzhmOTE2MTUzNGUnO1xuY29uc3QgZ3VhcmQyZWQgPSAnZTNlYzZmY2M3OWU2NGMyYWY2YTQ4YTk4NjVkNGJmNGI3MzllYzc3MDhkNzVmMzVhY2MzZDQ3OGY5MTYxNTM0OSc7XG5jb25zdCBndWFyZDNlZCA9ICdlM2VjNmZjYzc5ZTY0YzJhZjZhNDhhOTg2NWQ0YmY0YjczOWVjNzcwOGQ3NWYzNWFjYzNkNDc4ZjkxNjE1MzRhJztcblxuY29uc3QgZmFrZVNub2RlUG9vbDogQXJyYXk8RGF0YS5Tbm9kZT4gPSBbXG4gIC4uLmdlbmVyYXRlRmFrZVNub2RlcygxMiksXG4gIGdlbmVyYXRlRmFrZVNub2RlV2l0aEVkS2V5KGd1YXJkMWVkKSxcbiAgZ2VuZXJhdGVGYWtlU25vZGVXaXRoRWRLZXkoZ3VhcmQyZWQpLFxuICBnZW5lcmF0ZUZha2VTbm9kZVdpdGhFZEtleShndWFyZDNlZCksXG4gIC4uLmdlbmVyYXRlRmFrZVNub2RlcygzKSxcbl07XG5cbmNvbnN0IGZha2VTbm9kZVBvb2xGcm9tU2VlZE5vZGU6IEFycmF5PFNub2RlRnJvbVNlZWQ+ID0gZmFrZVNub2RlUG9vbC5tYXAobSA9PiB7XG4gIHJldHVybiB7XG4gICAgcHVibGljX2lwOiBtLmlwLFxuICAgIHN0b3JhZ2VfcG9ydDogbS5wb3J0LFxuICAgIHB1YmtleV94MjU1MTk6IG0ucHVia2V5X3gyNTUxOSxcbiAgICBwdWJrZXlfZWQyNTUxOTogbS5wdWJrZXlfZWQyNTUxOSxcbiAgfTtcbn0pO1xuLy8gdHNsaW50OmRpc2FibGU6IHZhcmlhYmxlLW5hbWVcblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBtYXgtZnVuYy1ib2R5LWxlbmd0aFxuZGVzY3JpYmUoJ1NlZWROb2RlQVBJJywgKCkgPT4ge1xuICAvLyBJbml0aWFsaXplIG5ldyBzdHViYmVkIGNhY2hlXG4gIGNvbnN0IHNhbmRib3ggPSBzaW5vbi5jcmVhdGVTYW5kYm94KCk7XG5cbiAgZGVzY3JpYmUoJ2dldFNub2RlTGlzdEZyb21TZWVkbm9kZScsICgpID0+IHtcbiAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgIC8vIFV0aWxzIFN0dWJzXG4gICAgICBPbmlvblBhdGhzLmNsZWFyVGVzdE9uaW9uUGF0aCgpO1xuXG4gICAgICBUZXN0VXRpbHMuc3R1YldpbmRvd0xvZygpO1xuXG4gICAgICBPbmlvbnMucmVzZXRTbm9kZUZhaWx1cmVDb3VudCgpO1xuICAgICAgT25pb25QYXRocy5yZXNldFBhdGhGYWlsdXJlQ291bnQoKTtcbiAgICAgIFNub2RlUG9vbC5URVNUX3Jlc2V0U3RhdGUoKTtcbiAgICB9KTtcblxuICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICBUZXN0VXRpbHMucmVzdG9yZVN0dWJzKCk7XG4gICAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICB9KTtcblxuICAgIGl0KCdpZiB0aGUgY2FjaGVkIHNub2RlIHBvb2wgaGFzIGxlc3MgdGhhbiAxMiBzbm9kZXMsIHRyaWdnZXIgYSBmZXRjaCBmcm9tIHRoZSBzZWVkIG5vZGVzIHdpdGggcmV0cmllcycsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IFRFU1RfZmV0Y2hTbm9kZVBvb2xGcm9tU2VlZE5vZGVSZXRyeWFibGUgPSBzYW5kYm94XG4gICAgICAgIC5zdHViKFNlZWROb2RlQVBJLCAnVEVTVF9mZXRjaFNub2RlUG9vbEZyb21TZWVkTm9kZVJldHJ5YWJsZScpXG4gICAgICAgIC5vbkZpcnN0Q2FsbCgpXG4gICAgICAgIC50aHJvd3MoKVxuICAgICAgICAub25TZWNvbmRDYWxsKClcbiAgICAgICAgLnJlc29sdmVzKGZha2VTbm9kZVBvb2xGcm9tU2VlZE5vZGUpO1xuXG4gICAgICBzYW5kYm94LnN0dWIoU2VlZE5vZGVBUEksICdnZXRNaW5UaW1lb3V0JykucmV0dXJucygyMCk7XG5cbiAgICAgIC8vIHJ1biB0aGUgY29tbWFuZFxuICAgICAgY29uc3QgZmV0Y2hlZCA9IGF3YWl0IFNlZWROb2RlQVBJLmZldGNoU25vZGVQb29sRnJvbVNlZWROb2RlV2l0aFJldHJpZXMoW1xuICAgICAgICB7IHVybDogJ3NlZWRub2RlMScgfSxcbiAgICAgIF0pO1xuXG4gICAgICBjb25zdCBzb3J0ZWRGZXRjaCA9IGZldGNoZWQuc29ydCgoYSwgYikgPT4gKGEucHVia2V5X2VkMjU1MTkgPiBiLnB1YmtleV9lZDI1NTE5ID8gLTEgOiAxKSk7XG4gICAgICBjb25zdCBzb3J0ZWRGYWtlU25vZGVQb29sID0gZmFrZVNub2RlUG9vbC5zb3J0KChhLCBiKSA9PlxuICAgICAgICBhLnB1YmtleV9lZDI1NTE5ID4gYi5wdWJrZXlfZWQyNTUxOSA/IC0xIDogMVxuICAgICAgKTtcbiAgICAgIGV4cGVjdChzb3J0ZWRGZXRjaCkudG8uZGVlcC5lcXVhbChzb3J0ZWRGYWtlU25vZGVQb29sKTtcblxuICAgICAgZXhwZWN0KFxuICAgICAgICBURVNUX2ZldGNoU25vZGVQb29sRnJvbVNlZWROb2RlUmV0cnlhYmxlLmNhbGxDb3VudCxcbiAgICAgICAgJ1RFU1RfZmV0Y2hTbm9kZVBvb2xGcm9tU2VlZE5vZGVSZXRyeWFibGUgY2FsbGVkIHR3aWNlIGFzIHRoZSBmaXJzdCBvbmUgZmFpbGVkJ1xuICAgICAgKS50by5iZS5lcSgyKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7OztBQUVBLGtCQUFpQjtBQUNqQixZQUF1QjtBQUV2QixtQkFBeUI7QUFFekIsd0JBQTBCO0FBQzFCLHVCQUFrQztBQUdsQyw4QkFBMkI7QUFDM0IsaUJBQTRCO0FBQzVCLG1CQUErRDtBQUMvRCwyQkFBNEI7QUFFNUIsb0JBQUssSUFBSSwrQkFBcUI7QUFDOUIsb0JBQUssT0FBTztBQUVaLE1BQU0sRUFBRSxXQUFXO0FBRW5CLE1BQU0sV0FBVztBQUNqQixNQUFNLFdBQVc7QUFDakIsTUFBTSxXQUFXO0FBRWpCLE1BQU0sZ0JBQW1DO0FBQUEsRUFDdkMsR0FBRyxxQ0FBbUIsRUFBRTtBQUFBLEVBQ3hCLDZDQUEyQixRQUFRO0FBQUEsRUFDbkMsNkNBQTJCLFFBQVE7QUFBQSxFQUNuQyw2Q0FBMkIsUUFBUTtBQUFBLEVBQ25DLEdBQUcscUNBQW1CLENBQUM7QUFDekI7QUFFQSxNQUFNLDRCQUFrRCxjQUFjLElBQUksT0FBSztBQUM3RSxTQUFPO0FBQUEsSUFDTCxXQUFXLEVBQUU7QUFBQSxJQUNiLGNBQWMsRUFBRTtBQUFBLElBQ2hCLGVBQWUsRUFBRTtBQUFBLElBQ2pCLGdCQUFnQixFQUFFO0FBQUEsRUFDcEI7QUFDRixDQUFDO0FBSUQsMkJBQVMsZUFBZSxNQUFNO0FBRTVCLFFBQU0sVUFBVSxNQUFNLGNBQWM7QUFFcEMsNkJBQVMsNEJBQTRCLE1BQU07QUFDekMsZUFBVyxNQUFNO0FBRWYsaUJBQVcsbUJBQW1CO0FBRTlCLGtDQUFVLGNBQWM7QUFFeEIsOEJBQU8sdUJBQXVCO0FBQzlCLGlCQUFXLHNCQUFzQjtBQUNqQyxpQ0FBVSxnQkFBZ0I7QUFBQSxJQUM1QixDQUFDO0FBRUQsY0FBVSxNQUFNO0FBQ2Qsa0NBQVUsYUFBYTtBQUN2QixjQUFRLFFBQVE7QUFBQSxJQUNsQixDQUFDO0FBRUQsT0FBRyxzR0FBc0csWUFBWTtBQUNuSCxZQUFNLDJDQUEyQyxRQUM5QyxLQUFLLGtDQUFhLDBDQUEwQyxFQUM1RCxZQUFZLEVBQ1osT0FBTyxFQUNQLGFBQWEsRUFDYixTQUFTLHlCQUF5QjtBQUVyQyxjQUFRLEtBQUssa0NBQWEsZUFBZSxFQUFFLFFBQVEsRUFBRTtBQUdyRCxZQUFNLFVBQVUsTUFBTSxpQ0FBWSxzQ0FBc0M7QUFBQSxRQUN0RSxFQUFFLEtBQUssWUFBWTtBQUFBLE1BQ3JCLENBQUM7QUFFRCxZQUFNLGNBQWMsUUFBUSxLQUFLLENBQUMsR0FBRyxNQUFPLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEtBQUssQ0FBRTtBQUN6RixZQUFNLHNCQUFzQixjQUFjLEtBQUssQ0FBQyxHQUFHLE1BQ2pELEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEtBQUssQ0FDN0M7QUFDQSxhQUFPLFdBQVcsRUFBRSxHQUFHLEtBQUssTUFBTSxtQkFBbUI7QUFFckQsYUFDRSx5Q0FBeUMsV0FDekMsK0VBQ0YsRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDZCxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBQ0gsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
