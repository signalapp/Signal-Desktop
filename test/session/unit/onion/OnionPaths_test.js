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
var import_lodash = __toESM(require("lodash"));
var import_mocha = require("mocha");
var import_test_utils = require("../../../test-utils");
var SNodeAPI = __toESM(require("../../../../session/apis/snode_api"));
var Data = __toESM(require("../../../../../ts/data/data"));
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
  ...(0, import_utils.generateFakeSnodes)(9)
];
const fakeGuardNodesEd25519 = [guard1ed, guard2ed, guard3ed];
const fakeGuardNodes = fakeSnodePool.filter((m) => fakeGuardNodesEd25519.includes(m.pubkey_ed25519));
const fakeGuardNodesFromDB = fakeGuardNodesEd25519.map((ed25519PubKey) => {
  return {
    ed25519PubKey
  };
});
(0, import_mocha.describe)("OnionPaths", () => {
  const sandbox = sinon.createSandbox();
  let oldOnionPaths;
  (0, import_mocha.describe)("dropSnodeFromPath", () => {
    beforeEach(async () => {
      OnionPaths.clearTestOnionPath();
      sandbox.stub(OnionPaths, "selectGuardNodes").resolves(fakeGuardNodes);
      sandbox.stub(SNodeAPI.SNodeAPI, "TEST_getSnodePoolFromSnode").resolves(fakeGuardNodes);
      sandbox.stub(Data, "getSnodePoolFromDb").resolves(fakeSnodePool);
      import_test_utils.TestUtils.stubData("getGuardNodes").resolves(fakeGuardNodesFromDB);
      import_test_utils.TestUtils.stubData("createOrUpdateItem").resolves();
      import_test_utils.TestUtils.stubWindow("getSeedNodeList", () => ["seednode1"]);
      import_test_utils.TestUtils.stubWindowLog();
      sandbox.stub(import_seed_node_api.SeedNodeAPI, "fetchSnodePoolFromSeedNodeWithRetries").resolves(fakeSnodePool);
      SNodeAPI.Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      await OnionPaths.getOnionPath({});
      oldOnionPaths = OnionPaths.TEST_getTestOnionPath();
      if (oldOnionPaths.length !== 3) {
        throw new Error(`onion path length not enough ${oldOnionPaths.length}`);
      }
    });
    afterEach(() => {
      import_test_utils.TestUtils.restoreStubs();
      sandbox.restore();
    });
    (0, import_mocha.describe)("with valid snode pool", () => {
      it("rebuilds after removing last snode on path", async () => {
        await OnionPaths.dropSnodeFromPath(oldOnionPaths[2][2].pubkey_ed25519);
        const newOnionPath = OnionPaths.TEST_getTestOnionPath();
        expect(newOnionPath).to.be.not.deep.equal(oldOnionPaths);
        expect(newOnionPath[0]).to.be.deep.equal(oldOnionPaths[0]);
        expect(newOnionPath[1]).to.be.deep.equal(oldOnionPaths[1]);
        expect(newOnionPath[2][0]).to.be.deep.equal(oldOnionPaths[2][0]);
        expect(newOnionPath[2][1]).to.be.deep.equal(oldOnionPaths[2][1]);
        expect(newOnionPath[2][2]).to.be.not.deep.equal(oldOnionPaths[2][2]);
      });
      it("rebuilds after removing middle snode on path", async () => {
        await OnionPaths.dropSnodeFromPath(oldOnionPaths[2][1].pubkey_ed25519);
        const newOnionPath = OnionPaths.TEST_getTestOnionPath();
        const allEd25519Keys = import_lodash.default.flattenDeep(oldOnionPaths).map((m) => m.pubkey_ed25519);
        expect(newOnionPath).to.be.not.deep.equal(oldOnionPaths);
        expect(newOnionPath[0]).to.be.deep.equal(oldOnionPaths[0]);
        expect(newOnionPath[1]).to.be.deep.equal(oldOnionPaths[1]);
        expect(newOnionPath[2][0]).to.be.deep.equal(oldOnionPaths[2][0]);
        expect(newOnionPath[2][1]).to.be.deep.equal(oldOnionPaths[2][2]);
        expect(allEd25519Keys).to.not.include(newOnionPath[2][2].pubkey_ed25519);
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvb25pb24vT25pb25QYXRoc190ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyB0c2xpbnQ6ZGlzYWJsZTogbm8taW1wbGljaXQtZGVwZW5kZW5jaWVzIG1heC1mdW5jLWJvZHktbGVuZ3RoIG5vLXVudXNlZC1leHByZXNzaW9uXG5cbmltcG9ydCBjaGFpIGZyb20gJ2NoYWknO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IGRlc2NyaWJlIH0gZnJvbSAnbW9jaGEnO1xuXG5pbXBvcnQgeyBUZXN0VXRpbHMgfSBmcm9tICcuLi8uLi8uLi90ZXN0LXV0aWxzJztcbmltcG9ydCAqIGFzIFNOb2RlQVBJIGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9zbm9kZV9hcGknO1xuaW1wb3J0ICogYXMgRGF0YSBmcm9tICcuLi8uLi8uLi8uLi8uLi90cy9kYXRhL2RhdGEnO1xuXG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgKiBhcyBPbmlvblBhdGhzIGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vb25pb25zL29uaW9uUGF0aCc7XG5pbXBvcnQgeyBTbm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2RhdGEvZGF0YSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUZha2VTbm9kZXMsIGdlbmVyYXRlRmFrZVNub2RlV2l0aEVkS2V5IH0gZnJvbSAnLi4vLi4vLi4vdGVzdC11dGlscy91dGlscyc7XG5pbXBvcnQgeyBTZWVkTm9kZUFQSSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9zZWVkX25vZGVfYXBpJztcbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkIGFzIGFueSk7XG5jaGFpLnNob3VsZCgpO1xuXG5jb25zdCB7IGV4cGVjdCB9ID0gY2hhaTtcblxuY29uc3QgZ3VhcmQxZWQgPSAnZTNlYzZmY2M3OWU2NGMyYWY2YTQ4YTk4NjVkNGJmNGI3MzllYzc3MDhkNzVmMzVhY2MzZDQ3OGY5MTYxNTM0ZSc7XG5jb25zdCBndWFyZDJlZCA9ICdlM2VjNmZjYzc5ZTY0YzJhZjZhNDhhOTg2NWQ0YmY0YjczOWVjNzcwOGQ3NWYzNWFjYzNkNDc4ZjkxNjE1MzQ5JztcbmNvbnN0IGd1YXJkM2VkID0gJ2UzZWM2ZmNjNzllNjRjMmFmNmE0OGE5ODY1ZDRiZjRiNzM5ZWM3NzA4ZDc1ZjM1YWNjM2Q0NzhmOTE2MTUzNGEnO1xuXG5jb25zdCBmYWtlU25vZGVQb29sOiBBcnJheTxTbm9kZT4gPSBbXG4gIC4uLmdlbmVyYXRlRmFrZVNub2RlcygxMiksXG4gIGdlbmVyYXRlRmFrZVNub2RlV2l0aEVkS2V5KGd1YXJkMWVkKSxcbiAgZ2VuZXJhdGVGYWtlU25vZGVXaXRoRWRLZXkoZ3VhcmQyZWQpLFxuICBnZW5lcmF0ZUZha2VTbm9kZVdpdGhFZEtleShndWFyZDNlZCksXG4gIC4uLmdlbmVyYXRlRmFrZVNub2Rlcyg5KSxcbl07XG5cbmNvbnN0IGZha2VHdWFyZE5vZGVzRWQyNTUxOSA9IFtndWFyZDFlZCwgZ3VhcmQyZWQsIGd1YXJkM2VkXTtcbmNvbnN0IGZha2VHdWFyZE5vZGVzID0gZmFrZVNub2RlUG9vbC5maWx0ZXIobSA9PiBmYWtlR3VhcmROb2Rlc0VkMjU1MTkuaW5jbHVkZXMobS5wdWJrZXlfZWQyNTUxOSkpO1xuY29uc3QgZmFrZUd1YXJkTm9kZXNGcm9tREI6IEFycmF5PERhdGEuR3VhcmROb2RlPiA9IGZha2VHdWFyZE5vZGVzRWQyNTUxOS5tYXAoZWQyNTUxOVB1YktleSA9PiB7XG4gIHJldHVybiB7XG4gICAgZWQyNTUxOVB1YktleSxcbiAgfTtcbn0pO1xuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1mdW5jLWJvZHktbGVuZ3RoXG5kZXNjcmliZSgnT25pb25QYXRocycsICgpID0+IHtcbiAgLy8gSW5pdGlhbGl6ZSBuZXcgc3R1YmJlZCBjYWNoZVxuICBjb25zdCBzYW5kYm94ID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuICBsZXQgb2xkT25pb25QYXRoczogQXJyYXk8QXJyYXk8U25vZGU+PjtcblxuICBkZXNjcmliZSgnZHJvcFNub2RlRnJvbVBhdGgnLCAoKSA9PiB7XG4gICAgYmVmb3JlRWFjaChhc3luYyAoKSA9PiB7XG4gICAgICAvLyBVdGlscyBTdHVic1xuICAgICAgT25pb25QYXRocy5jbGVhclRlc3RPbmlvblBhdGgoKTtcblxuICAgICAgc2FuZGJveC5zdHViKE9uaW9uUGF0aHMsICdzZWxlY3RHdWFyZE5vZGVzJykucmVzb2x2ZXMoZmFrZUd1YXJkTm9kZXMpO1xuICAgICAgc2FuZGJveC5zdHViKFNOb2RlQVBJLlNOb2RlQVBJLCAnVEVTVF9nZXRTbm9kZVBvb2xGcm9tU25vZGUnKS5yZXNvbHZlcyhmYWtlR3VhcmROb2Rlcyk7XG4gICAgICBzYW5kYm94LnN0dWIoRGF0YSwgJ2dldFNub2RlUG9vbEZyb21EYicpLnJlc29sdmVzKGZha2VTbm9kZVBvb2wpO1xuXG4gICAgICBUZXN0VXRpbHMuc3R1YkRhdGEoJ2dldEd1YXJkTm9kZXMnKS5yZXNvbHZlcyhmYWtlR3VhcmROb2Rlc0Zyb21EQik7XG4gICAgICBUZXN0VXRpbHMuc3R1YkRhdGEoJ2NyZWF0ZU9yVXBkYXRlSXRlbScpLnJlc29sdmVzKCk7XG4gICAgICBUZXN0VXRpbHMuc3R1YldpbmRvdygnZ2V0U2VlZE5vZGVMaXN0JywgKCkgPT4gWydzZWVkbm9kZTEnXSk7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZTogbm8tdm9pZC1leHByZXNzaW9uIG5vLWNvbnNvbGVcblxuICAgICAgVGVzdFV0aWxzLnN0dWJXaW5kb3dMb2coKTtcblxuICAgICAgc2FuZGJveC5zdHViKFNlZWROb2RlQVBJLCAnZmV0Y2hTbm9kZVBvb2xGcm9tU2VlZE5vZGVXaXRoUmV0cmllcycpLnJlc29sdmVzKGZha2VTbm9kZVBvb2wpO1xuICAgICAgU05vZGVBUEkuT25pb25zLnJlc2V0U25vZGVGYWlsdXJlQ291bnQoKTtcbiAgICAgIE9uaW9uUGF0aHMucmVzZXRQYXRoRmFpbHVyZUNvdW50KCk7XG4gICAgICAvLyBnZXQgYSBjb3B5IG9mIHdoYXQgb2xkIG9uZXMgbG9vayBsaWtlXG4gICAgICBhd2FpdCBPbmlvblBhdGhzLmdldE9uaW9uUGF0aCh7fSk7XG5cbiAgICAgIG9sZE9uaW9uUGF0aHMgPSBPbmlvblBhdGhzLlRFU1RfZ2V0VGVzdE9uaW9uUGF0aCgpO1xuICAgICAgaWYgKG9sZE9uaW9uUGF0aHMubGVuZ3RoICE9PSAzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgb25pb24gcGF0aCBsZW5ndGggbm90IGVub3VnaCAke29sZE9uaW9uUGF0aHMubGVuZ3RofWApO1xuICAgICAgfVxuICAgICAgLy8gdGhpcyBqdXN0IHRyaWdnZXJzIGEgYnVpbGQgb2YgdGhlIG9uaW9uUGF0aHNcbiAgICB9KTtcblxuICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICBUZXN0VXRpbHMucmVzdG9yZVN0dWJzKCk7XG4gICAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICB9KTtcbiAgICBkZXNjcmliZSgnd2l0aCB2YWxpZCBzbm9kZSBwb29sJywgKCkgPT4ge1xuICAgICAgaXQoJ3JlYnVpbGRzIGFmdGVyIHJlbW92aW5nIGxhc3Qgc25vZGUgb24gcGF0aCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgT25pb25QYXRocy5kcm9wU25vZGVGcm9tUGF0aChvbGRPbmlvblBhdGhzWzJdWzJdLnB1YmtleV9lZDI1NTE5KTtcbiAgICAgICAgY29uc3QgbmV3T25pb25QYXRoID0gT25pb25QYXRocy5URVNUX2dldFRlc3RPbmlvblBhdGgoKTtcblxuICAgICAgICAvLyBvbmx5IHRoZSBsYXN0IHNub2RlIHNob3VsZCBoYXZlIGJlZW4gdXBkYXRlZFxuICAgICAgICBleHBlY3QobmV3T25pb25QYXRoKS50by5iZS5ub3QuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFswXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzBdKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFsxXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzFdKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFsyXVswXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzJdWzBdKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFsyXVsxXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzJdWzFdKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFsyXVsyXSkudG8uYmUubm90LmRlZXAuZXF1YWwob2xkT25pb25QYXRoc1syXVsyXSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3JlYnVpbGRzIGFmdGVyIHJlbW92aW5nIG1pZGRsZSBzbm9kZSBvbiBwYXRoJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBPbmlvblBhdGhzLmRyb3BTbm9kZUZyb21QYXRoKG9sZE9uaW9uUGF0aHNbMl1bMV0ucHVia2V5X2VkMjU1MTkpO1xuICAgICAgICBjb25zdCBuZXdPbmlvblBhdGggPSBPbmlvblBhdGhzLlRFU1RfZ2V0VGVzdE9uaW9uUGF0aCgpO1xuXG4gICAgICAgIGNvbnN0IGFsbEVkMjU1MTlLZXlzID0gXy5mbGF0dGVuRGVlcChvbGRPbmlvblBhdGhzKS5tYXAobSA9PiBtLnB1YmtleV9lZDI1NTE5KTtcblxuICAgICAgICAvLyBvbmx5IHRoZSBsYXN0IHNub2RlIHNob3VsZCBoYXZlIGJlZW4gdXBkYXRlZFxuICAgICAgICBleHBlY3QobmV3T25pb25QYXRoKS50by5iZS5ub3QuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFswXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzBdKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFsxXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzFdKTtcbiAgICAgICAgZXhwZWN0KG5ld09uaW9uUGF0aFsyXVswXSkudG8uYmUuZGVlcC5lcXVhbChvbGRPbmlvblBhdGhzWzJdWzBdKTtcbiAgICAgICAgLy8gbGFzdCBpdGVtIG1vdmVkIHRvIHRoZSBwb3NpdGlvbiBvbmUgYXMgd2UgcmVtb3ZlZCBpdGVtIDEgYW5kIGhhcHBlbmVkIG9uZSBhZnRlciBpdFxuICAgICAgICBleHBlY3QobmV3T25pb25QYXRoWzJdWzFdKS50by5iZS5kZWVwLmVxdWFsKG9sZE9uaW9uUGF0aHNbMl1bMl0pO1xuICAgICAgICAvLyB0aGUgbGFzdCBpdGVtIHdlIGhhcHBlbmVkIG11c3Qgbm90IGJlIGFueSBvZiB0aGUgbmV3IHBhdGggbm9kZXMuXG4gICAgICAgIC8vIGFjdHVhbGx5LCB3ZSByZW1vdmUgdGhlIG5vZGVzIGNhdXNpbmcgaXNzdWVzIGZyb20gdGhlIHNub2RlIHBvb2wgc28gd2Ugc2hvdWxkbid0IGZpbmQgdGhpcyBvbmUgbmVpdGhlclxuICAgICAgICBleHBlY3QoYWxsRWQyNTUxOUtleXMpLnRvLm5vdC5pbmNsdWRlKG5ld09uaW9uUGF0aFsyXVsyXS5wdWJrZXlfZWQyNTUxOSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7OztBQUVBLGtCQUFpQjtBQUNqQixZQUF1QjtBQUN2QixvQkFBYztBQUNkLG1CQUF5QjtBQUV6Qix3QkFBMEI7QUFDMUIsZUFBMEI7QUFDMUIsV0FBc0I7QUFFdEIsOEJBQTJCO0FBQzNCLGlCQUE0QjtBQUU1QixtQkFBK0Q7QUFDL0QsMkJBQTRCO0FBQzVCLG9CQUFLLElBQUksK0JBQXFCO0FBQzlCLG9CQUFLLE9BQU87QUFFWixNQUFNLEVBQUUsV0FBVztBQUVuQixNQUFNLFdBQVc7QUFDakIsTUFBTSxXQUFXO0FBQ2pCLE1BQU0sV0FBVztBQUVqQixN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
