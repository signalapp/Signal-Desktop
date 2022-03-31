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
var import_test_utils = require("../../../test-utils");
var SNodeAPI = __toESM(require("../../../../session/apis/snode_api"));
var import_chai_as_promised = __toESM(require("chai-as-promised"));
var import_onions = require("../../../../session/onions/");
var import_onions2 = require("../../../../session/apis/snode_api/onions");
var import_abort_controller = __toESM(require("abort-controller"));
var Data = __toESM(require("../../../../../ts/data/data"));
var import_onionPath = require("../../../../session/onions/onionPath");
var import_seed_node_api = require("../../../../session/apis/seed_node_api");
var import_utils = require("../../../test-utils/utils");
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { expect } = import_chai.default;
const getFakeResponseOnPath = /* @__PURE__ */ __name((statusCode, body) => {
  return {
    status: statusCode || 0,
    text: async () => body || ""
  };
}, "getFakeResponseOnPath");
const getFakeResponseOnDestination = /* @__PURE__ */ __name((statusCode, body) => {
  return {
    status: 200,
    text: async () => {
      return JSON.stringify({ status: statusCode, body: body || "" });
    }
  };
}, "getFakeResponseOnDestination");
(0, import_mocha.describe)("OnionPathsErrors", () => {
  const sandbox = sinon.createSandbox();
  let updateSwarmSpy;
  let dropSnodeFromSwarmIfNeededSpy;
  let dropSnodeFromSnodePool;
  let dropSnodeFromPathSpy;
  let incrementBadPathCountOrDropSpy;
  let incrementBadSnodeCountOrDropSpy;
  let updateGuardNodesStub;
  let guardPubkeys, otherNodesPubkeys, guardNodesArray, guardSnode1, otherNodesArray, fakeSnodePool, associatedWith, fakeSwarmForAssociatedWith;
  let oldOnionPaths;
  beforeEach(async () => {
    guardPubkeys = import_test_utils.TestUtils.generateFakePubKeys(3).map((n) => n.key);
    otherNodesPubkeys = import_test_utils.TestUtils.generateFakePubKeys(20).map((n) => n.key);
    SNodeAPI.Onions.resetSnodeFailureCount();
    guardNodesArray = guardPubkeys.map(import_utils.generateFakeSnodeWithEdKey);
    guardSnode1 = guardNodesArray[0];
    otherNodesArray = otherNodesPubkeys.map(import_utils.generateFakeSnodeWithEdKey);
    fakeSnodePool = [...guardNodesArray, ...otherNodesArray];
    associatedWith = import_test_utils.TestUtils.generateFakePubKey().key;
    fakeSwarmForAssociatedWith = otherNodesPubkeys.slice(0, 6);
    sandbox.stub(import_onions.OnionPaths, "selectGuardNodes").resolves(guardNodesArray);
    sandbox.stub(SNodeAPI.SNodeAPI, "TEST_getSnodePoolFromSnode").resolves(guardNodesArray);
    import_test_utils.TestUtils.stubData("getGuardNodes").resolves([
      guardPubkeys[0],
      guardPubkeys[1],
      guardPubkeys[2]
    ]);
    import_test_utils.TestUtils.stubWindow("getSeedNodeList", () => ["seednode1"]);
    sandbox.stub(import_seed_node_api.SeedNodeAPI, "fetchSnodePoolFromSeedNodeWithRetries").resolves(fakeSnodePool);
    sandbox.stub(Data, "getSwarmNodesForPubkey").resolves(fakeSwarmForAssociatedWith);
    updateGuardNodesStub = sandbox.stub(Data, "updateGuardNodes").resolves();
    updateSwarmSpy = sandbox.stub(Data, "updateSwarmNodesForPubkey").resolves();
    sandbox.stub(Data, "getItemById").withArgs(Data.SNODE_POOL_ITEM_ID).resolves({ id: Data.SNODE_POOL_ITEM_ID, value: "" });
    sandbox.stub(Data, "createOrUpdateItem").resolves();
    dropSnodeFromSnodePool = sandbox.spy(SNodeAPI.SnodePool, "dropSnodeFromSnodePool");
    dropSnodeFromSwarmIfNeededSpy = sandbox.spy(SNodeAPI.SnodePool, "dropSnodeFromSwarmIfNeeded");
    dropSnodeFromPathSpy = sandbox.spy(import_onions.OnionPaths, "dropSnodeFromPath");
    incrementBadPathCountOrDropSpy = sandbox.spy(import_onions.OnionPaths, "incrementBadPathCountOrDrop");
    incrementBadSnodeCountOrDropSpy = sandbox.spy(SNodeAPI.Onions, "incrementBadSnodeCountOrDrop");
    import_onions.OnionPaths.clearTestOnionPath();
    import_onions.OnionPaths.resetPathFailureCount();
    await import_onions.OnionPaths.getOnionPath({});
    oldOnionPaths = import_onions.OnionPaths.TEST_getTestOnionPath();
    sandbox.stub(SNodeAPI.Onions, "decodeOnionResult").callsFake((_symkey, plaintext) => Promise.resolve({ plaintext, ciphertextBuffer: new Uint8Array() }));
  });
  afterEach(() => {
    import_test_utils.TestUtils.restoreStubs();
    sandbox.restore();
  });
  (0, import_mocha.describe)("processOnionResponse", () => {
    it("throws a non-retryable error when the request is aborted", async () => {
      const abortController = new import_abort_controller.default();
      abortController.abort();
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnPath(),
          symmetricKey: new Uint8Array(),
          guardNode: guardSnode1,
          abortSignal: abortController.signal
        });
        throw new Error("Error expected");
      } catch (e) {
        expect(e.message).to.equal("Request got aborted");
        expect(e.name).to.equal("AbortError");
      }
    });
    it("does not throw if we get 200 on path and destination", async () => {
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnDestination(200),
          symmetricKey: new Uint8Array(),
          guardNode: guardSnode1
        });
        throw new Error("Did not throw");
      } catch (e) {
        expect(e.message).to.equal("Did not throw");
      }
      expect(dropSnodeFromSnodePool.callCount).to.eq(0);
      expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(0);
      expect(dropSnodeFromPathSpy.callCount).to.eq(0);
      expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
      expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(0);
    });
    it("does not throw if we get 200 on path but no status code on destination", async () => {
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnDestination(),
          symmetricKey: new Uint8Array(),
          guardNode: guardSnode1
        });
        throw new Error("Did not throw");
      } catch (e) {
        expect(e.message).to.equal("Did not throw");
      }
      expect(dropSnodeFromSnodePool.callCount).to.eq(0);
      expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(0);
      expect(dropSnodeFromPathSpy.callCount).to.eq(0);
      expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
      expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(0);
    });
    (0, import_mocha.describe)("processOnionResponse - 406", () => {
      it("throws an non retryable error we get a 406 on path", async () => {
        try {
          await (0, import_onions2.processOnionResponse)({
            response: getFakeResponseOnPath(406),
            symmetricKey: new Uint8Array(),
            guardNode: guardSnode1
          });
          throw new Error("Error expected");
        } catch (e) {
          expect(e.message).to.equal("Your clock is out of sync with the network. Check your clock.");
          expect(e.name).to.equal("AbortError");
        }
        expect(dropSnodeFromSnodePool.callCount).to.eq(0);
        expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(0);
        expect(dropSnodeFromPathSpy.callCount).to.eq(0);
        expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
        expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(0);
      });
      it("throws an non retryable error we get a 406 on destination", async () => {
        try {
          await (0, import_onions2.processOnionResponse)({
            response: getFakeResponseOnDestination(406),
            symmetricKey: new Uint8Array(),
            guardNode: guardSnode1
          });
          throw new Error("Error expected");
        } catch (e) {
          expect(e.message).to.equal("Your clock is out of sync with the network. Check your clock.");
          expect(e.name).to.equal("AbortError");
        }
        expect(dropSnodeFromSnodePool.callCount).to.eq(0);
        expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(0);
        expect(dropSnodeFromPathSpy.callCount).to.eq(0);
        expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
        expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(0);
      });
    });
    (0, import_mocha.describe)("processOnionResponse - 421", () => {
      (0, import_mocha.describe)("processOnionResponse - 421 - on path", () => {
        it("throws a non-retryable error if we get a 421 status code without new swarm", async () => {
          const targetNode = otherNodesPubkeys[0];
          try {
            await (0, import_onions2.processOnionResponse)({
              response: getFakeResponseOnPath(421),
              symmetricKey: new Uint8Array(),
              guardNode: guardSnode1,
              lsrpcEd25519Key: targetNode,
              associatedWith
            });
            throw new Error("Error expected");
          } catch (e) {
            expect(e.message).to.equal("421 handled. Retry this request with a new targetNode");
            expect(e.name).to.equal("AbortError");
          }
          expect(updateSwarmSpy.callCount).to.eq(1);
          expect(updateSwarmSpy.args[0][1]).to.deep.eq(fakeSwarmForAssociatedWith.filter((m) => m !== targetNode));
          expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(1);
          expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[0]).to.eq(associatedWith);
          expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[1]).to.eq(targetNode);
          expect(dropSnodeFromSnodePool.callCount).to.eq(0);
          expect(dropSnodeFromPathSpy.callCount).to.eq(0);
          expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
          expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(1);
          expect(incrementBadSnodeCountOrDropSpy.firstCall.args[0]).to.deep.eq({
            snodeEd25519: targetNode,
            associatedWith
          });
        });
      });
      (0, import_mocha.describe)("processOnionResponse - 421 - on destination", () => {
        it("throws a non-retryable error we get a 421 status code with a new swarm", async () => {
          const targetNode = otherNodesPubkeys[0];
          const resultExpected = [
            otherNodesArray[4],
            otherNodesArray[5],
            otherNodesArray[6]
          ];
          try {
            await (0, import_onions2.processOnionResponse)({
              response: getFakeResponseOnDestination(421, JSON.stringify({ snodes: resultExpected })),
              symmetricKey: new Uint8Array(),
              guardNode: guardSnode1,
              lsrpcEd25519Key: targetNode,
              associatedWith
            });
            throw new Error("Error expected");
          } catch (e) {
            expect(e.message).to.equal("421 handled. Retry this request with a new targetNode");
            expect(e.name).to.equal("AbortError");
          }
          expect(updateSwarmSpy.callCount).to.eq(1);
          expect(updateSwarmSpy.args[0][1]).to.deep.eq(resultExpected.map((m) => m.pubkey_ed25519));
          expect(dropSnodeFromSnodePool.callCount).to.eq(0);
          expect(dropSnodeFromPathSpy.callCount).to.eq(0);
          expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
          expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(1);
          expect(incrementBadSnodeCountOrDropSpy.firstCall.args[0]).to.deep.eq({
            snodeEd25519: targetNode,
            associatedWith
          });
        });
        it("throws a non-retryable error we get a 421 status code with invalid json body", async () => {
          const targetNode = otherNodesPubkeys[0];
          try {
            await (0, import_onions2.processOnionResponse)({
              response: getFakeResponseOnDestination(421, "THIS IS SOME INVALID JSON"),
              symmetricKey: new Uint8Array(),
              guardNode: guardSnode1,
              lsrpcEd25519Key: targetNode,
              associatedWith
            });
            throw new Error("Error expected");
          } catch (e) {
            expect(e.message).to.equal("421 handled. Retry this request with a new targetNode");
            expect(e.name).to.equal("AbortError");
          }
          expect(updateSwarmSpy.callCount).to.eq(1);
          expect(updateSwarmSpy.args[0][1]).to.deep.eq(fakeSwarmForAssociatedWith.filter((m) => m !== targetNode));
          expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(1);
          expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[0]).to.eq(associatedWith);
          expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[1]).to.eq(targetNode);
          expect(dropSnodeFromSnodePool.callCount).to.eq(0);
          expect(dropSnodeFromPathSpy.callCount).to.eq(0);
          expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
          expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(1);
          expect(incrementBadSnodeCountOrDropSpy.firstCall.args[0]).to.deep.eq({
            snodeEd25519: targetNode,
            associatedWith
          });
        });
        it("throws a non-retryable on destination 421 without new swarm ", async () => {
          const targetNode = otherNodesPubkeys[0];
          const json = JSON.stringify({ status: 421 });
          try {
            await (0, import_onions2.processOnionResponse)({
              response: getFakeResponseOnDestination(421, json),
              symmetricKey: new Uint8Array(),
              guardNode: guardSnode1,
              lsrpcEd25519Key: targetNode,
              associatedWith
            });
            throw new Error("Error expected");
          } catch (e) {
            expect(e.message).to.equal("421 handled. Retry this request with a new targetNode");
            expect(e.name).to.equal("AbortError");
          }
          expect(updateSwarmSpy.callCount).to.eq(1);
          expect(updateSwarmSpy.args[0][1]).to.deep.eq(fakeSwarmForAssociatedWith.filter((m) => m !== targetNode));
          expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(1);
          expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[0]).to.eq(associatedWith);
          expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[1]).to.eq(targetNode);
          expect(dropSnodeFromSnodePool.callCount).to.eq(0);
          expect(dropSnodeFromPathSpy.callCount).to.eq(0);
          expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
          expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(1);
          expect(incrementBadSnodeCountOrDropSpy.firstCall.args[0]).to.deep.eq({
            snodeEd25519: targetNode,
            associatedWith
          });
        });
      });
    });
  });
  (0, import_mocha.describe)("processOnionResponse - OXEN_SERVER_ERROR", () => {
    it("throws a non-retryable error on oxen server errors on destination", async () => {
      const targetNode = otherNodesPubkeys[0];
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnDestination(400, import_onions2.OXEN_SERVER_ERROR),
          symmetricKey: new Uint8Array(),
          guardNode: guardSnode1,
          lsrpcEd25519Key: targetNode,
          associatedWith
        });
        throw new Error("Error expected");
      } catch (e) {
        expect(e.message).to.equal(import_onions2.OXEN_SERVER_ERROR);
        expect(e.name).to.equal("AbortError");
      }
      expect(updateSwarmSpy.callCount).to.eq(0);
      expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(0);
      expect(dropSnodeFromSnodePool.callCount).to.eq(0);
      expect(dropSnodeFromPathSpy.callCount).to.eq(0);
      expect(incrementBadPathCountOrDropSpy.callCount).to.eq(0);
      expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(0);
    });
  });
  (0, import_mocha.describe)("processOnionResponse - 502 - node not found", () => {
    it("throws a retryable error on 502 on intermediate snode", async () => {
      const targetNode = otherNodesPubkeys[0];
      const failingSnode = oldOnionPaths[0][1];
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnPath(502, `${import_onions2.NEXT_NODE_NOT_FOUND_PREFIX}${failingSnode.pubkey_ed25519}`),
          symmetricKey: new Uint8Array(),
          guardNode: guardSnode1,
          lsrpcEd25519Key: targetNode,
          associatedWith
        });
        throw new Error("Error expected");
      } catch (e) {
        expect(e.message).to.equal("Bad Path handled. Retry this request. Status: 502");
        expect(e.name).to.not.equal("AbortError");
      }
      expect(updateSwarmSpy.callCount).to.eq(0);
      expect(dropSnodeFromSwarmIfNeededSpy.callCount, "dropSnodeFromSwarmIfNeededSpy should have been called").to.eq(1);
      expect(dropSnodeFromSnodePool.callCount, "dropSnodeFromSnodePool should have been called").to.eq(1);
      expect(dropSnodeFromPathSpy.callCount, "dropSnodeFromPath should have been called").to.eq(1);
      expect(incrementBadPathCountOrDropSpy.callCount, "incrementBadPathCountOrDrop should not have been called").to.eq(0);
      expect(incrementBadSnodeCountOrDropSpy.callCount, "incrementBadSnodeCountOrDrop should not have been called").to.eq(0);
    });
    it("throws a retryable error on 502 on last snode", async () => {
      const targetNode = otherNodesPubkeys[0];
      const failingSnode = oldOnionPaths[0][2];
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnPath(502, `${import_onions2.NEXT_NODE_NOT_FOUND_PREFIX}${failingSnode.pubkey_ed25519}`),
          symmetricKey: new Uint8Array(),
          guardNode: guardSnode1,
          lsrpcEd25519Key: targetNode,
          associatedWith
        });
        throw new Error("Error expected");
      } catch (e) {
        expect(e.message).to.equal("Bad Path handled. Retry this request. Status: 502");
        expect(e.name).to.not.equal("AbortError");
      }
      expect(updateSwarmSpy.callCount).to.eq(0);
      expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(1);
      expect(dropSnodeFromSnodePool.callCount, "dropSnodeFromSnodePool should have been called").to.eq(1);
      expect(dropSnodeFromPathSpy.callCount, "dropSnodeFromPath should have been called").to.eq(1);
      expect(incrementBadPathCountOrDropSpy.callCount, "incrementBadPathCountOrDrop should not have been called").to.eq(0);
      expect(incrementBadSnodeCountOrDropSpy.callCount, "incrementBadSnodeCountOrDrop should not have been called").to.eq(0);
    });
    it("drop a snode from pool, swarm and path if it keep failing", async () => {
      const targetNode = otherNodesPubkeys[0];
      const failingSnode = oldOnionPaths[0][1];
      for (let index = 0; index < 3; index++) {
        try {
          await (0, import_onions2.processOnionResponse)({
            response: getFakeResponseOnPath(502, `${import_onions2.NEXT_NODE_NOT_FOUND_PREFIX}${failingSnode.pubkey_ed25519}`),
            symmetricKey: new Uint8Array(),
            guardNode: guardSnode1,
            lsrpcEd25519Key: targetNode,
            associatedWith
          });
          throw new Error("Error expected");
        } catch (e) {
          expect(e.message).to.equal("Bad Path handled. Retry this request. Status: 502");
          expect(e.name).to.not.equal("AbortError");
        }
      }
      expect(updateSwarmSpy.callCount).to.eq(0);
      expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(3);
      expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[0]).to.eq(associatedWith);
      expect(dropSnodeFromSwarmIfNeededSpy.firstCall.args[1]).to.eq(failingSnode.pubkey_ed25519);
      expect(dropSnodeFromSnodePool.callCount, "dropSnodeFromSnodePool should have been called").to.eq(3);
      expect(dropSnodeFromPathSpy.callCount, "dropSnodeFromPath should have been called").to.eq(3);
      expect(incrementBadPathCountOrDropSpy.callCount, "incrementBadPathCountOrDrop should not have been called").to.eq(0);
      expect(incrementBadSnodeCountOrDropSpy.callCount, "incrementBadSnodeCountOrDrop should not have been called").to.eq(0);
    });
  });
  it("drop a path if it keep failing without a specific node in fault", async () => {
    const targetNode = otherNodesPubkeys[0];
    const guardNode = oldOnionPaths[0][0];
    for (let index = 0; index < 3; index++) {
      try {
        await (0, import_onions2.processOnionResponse)({
          response: getFakeResponseOnPath(500),
          symmetricKey: new Uint8Array(),
          guardNode,
          lsrpcEd25519Key: targetNode,
          associatedWith
        });
        throw new Error("Error expected");
      } catch (e) {
        expect(e.message).to.equal("Bad Path handled. Retry this request. Status: 500");
        expect(e.name).to.not.equal("AbortError");
        if (index < 2) {
          expect(import_onionPath.pathFailureCount[guardNode.pubkey_ed25519]).to.eq(index + 1);
        } else {
          expect(import_onionPath.pathFailureCount[guardNode.pubkey_ed25519]).to.eq(0);
        }
      }
    }
    expect(incrementBadPathCountOrDropSpy.callCount).to.eq(3);
    expect(incrementBadSnodeCountOrDropSpy.callCount).to.eq(2 * 3);
    for (let index = 0; index < 6; index++) {
      expect(incrementBadSnodeCountOrDropSpy.args[index][0]).to.deep.eq({
        snodeEd25519: oldOnionPaths[0][index % 2 + 1].pubkey_ed25519
      });
    }
    expect(updateGuardNodesStub.callCount).to.eq(1);
    expect(dropSnodeFromSwarmIfNeededSpy.callCount).to.eq(0);
    expect(guardNode.pubkey_ed25519).to.eq(incrementBadPathCountOrDropSpy.args[0][0]);
    expect(guardNode.pubkey_ed25519).to.eq(incrementBadPathCountOrDropSpy.args[1][0]);
    expect(guardNode.pubkey_ed25519).to.eq(incrementBadPathCountOrDropSpy.args[2][0]);
    expect(dropSnodeFromPathSpy.callCount).to.eq(2);
    expect(dropSnodeFromSnodePool.callCount).to.eq(3);
    expect(dropSnodeFromSnodePool.args[0][0]).to.eq(oldOnionPaths[0][1].pubkey_ed25519);
    expect(dropSnodeFromSnodePool.args[1][0]).to.eq(oldOnionPaths[0][2].pubkey_ed25519);
    expect(dropSnodeFromSnodePool.args[2][0]).to.eq(oldOnionPaths[0][0].pubkey_ed25519);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvb25pb24vT25pb25FcnJvcnNfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gdHNsaW50OmRpc2FibGU6IG5vLWltcGxpY2l0LWRlcGVuZGVuY2llcyBtYXgtZnVuYy1ib2R5LWxlbmd0aCBuby11bnVzZWQtZXhwcmVzc2lvblxuXG5pbXBvcnQgY2hhaSBmcm9tICdjaGFpJztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IGRlc2NyaWJlIH0gZnJvbSAnbW9jaGEnO1xuXG5pbXBvcnQgeyBUZXN0VXRpbHMgfSBmcm9tICcuLi8uLi8uLi90ZXN0LXV0aWxzJztcbmltcG9ydCAqIGFzIFNOb2RlQVBJIGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9zbm9kZV9hcGknO1xuXG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgeyBPbmlvblBhdGhzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9vbmlvbnMvJztcbmltcG9ydCB7XG4gIE5FWFRfTk9ERV9OT1RfRk9VTkRfUFJFRklYLFxuICBPWEVOX1NFUlZFUl9FUlJPUixcbiAgcHJvY2Vzc09uaW9uUmVzcG9uc2UsXG59IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9zbm9kZV9hcGkvb25pb25zJztcbmltcG9ydCBBYm9ydENvbnRyb2xsZXIgZnJvbSAnYWJvcnQtY29udHJvbGxlcic7XG5pbXBvcnQgKiBhcyBEYXRhIGZyb20gJy4uLy4uLy4uLy4uLy4uL3RzL2RhdGEvZGF0YSc7XG5pbXBvcnQgeyBwYXRoRmFpbHVyZUNvdW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9vbmlvbnMvb25pb25QYXRoJztcbmltcG9ydCB7IFNlZWROb2RlQVBJIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi9hcGlzL3NlZWRfbm9kZV9hcGknO1xuaW1wb3J0IHsgZ2VuZXJhdGVGYWtlU25vZGVXaXRoRWRLZXkgfSBmcm9tICcuLi8uLi8uLi90ZXN0LXV0aWxzL3V0aWxzJztcblxuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQgYXMgYW55KTtcbmNoYWkuc2hvdWxkKCk7XG5cbmNvbnN0IHsgZXhwZWN0IH0gPSBjaGFpO1xuXG5jb25zdCBnZXRGYWtlUmVzcG9uc2VPblBhdGggPSAoc3RhdHVzQ29kZT86IG51bWJlciwgYm9keT86IHN0cmluZykgPT4ge1xuICByZXR1cm4ge1xuICAgIHN0YXR1czogc3RhdHVzQ29kZSB8fCAwLFxuICAgIHRleHQ6IGFzeW5jICgpID0+IGJvZHkgfHwgJycsXG4gIH07XG59O1xuXG5jb25zdCBnZXRGYWtlUmVzcG9uc2VPbkRlc3RpbmF0aW9uID0gKHN0YXR1c0NvZGU/OiBudW1iZXIsIGJvZHk/OiBzdHJpbmcpID0+IHtcbiAgcmV0dXJuIHtcbiAgICBzdGF0dXM6IDIwMCB8fCAwLFxuICAgIHRleHQ6IGFzeW5jICgpID0+IHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN0YXR1czogc3RhdHVzQ29kZSwgYm9keTogYm9keSB8fCAnJyB9KTtcbiAgICB9LFxuICB9O1xufTtcblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBtYXgtZnVuYy1ib2R5LWxlbmd0aFxuZGVzY3JpYmUoJ09uaW9uUGF0aHNFcnJvcnMnLCAoKSA9PiB7XG4gIC8vIEluaXRpYWxpemUgbmV3IHN0dWJiZWQgY2FjaGVcbiAgY29uc3Qgc2FuZGJveCA9IHNpbm9uLmNyZWF0ZVNhbmRib3goKTtcbiAgbGV0IHVwZGF0ZVN3YXJtU3B5OiBzaW5vbi5TaW5vblN0dWI7XG4gIGxldCBkcm9wU25vZGVGcm9tU3dhcm1JZk5lZWRlZFNweTogc2lub24uU2lub25TcHk7XG4gIGxldCBkcm9wU25vZGVGcm9tU25vZGVQb29sOiBzaW5vbi5TaW5vblNweTtcbiAgbGV0IGRyb3BTbm9kZUZyb21QYXRoU3B5OiBzaW5vbi5TaW5vblNweTtcbiAgbGV0IGluY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcFNweTogc2lub24uU2lub25TcHk7XG4gIGxldCBpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5OiBzaW5vbi5TaW5vblNweTtcblxuICBsZXQgdXBkYXRlR3VhcmROb2Rlc1N0dWI6IHNpbm9uLlNpbm9uU3R1YjtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBvbmUtdmFyaWFibGUtcGVyLWRlY2xhcmF0aW9uXG4gIGxldCBndWFyZFB1YmtleXM6IEFycmF5PHN0cmluZz4sXG4gICAgb3RoZXJOb2Rlc1B1YmtleXM6IEFycmF5PHN0cmluZz4sXG4gICAgZ3VhcmROb2Rlc0FycmF5OiBBcnJheTxEYXRhLlNub2RlPixcbiAgICBndWFyZFNub2RlMTogRGF0YS5Tbm9kZSxcbiAgICBvdGhlck5vZGVzQXJyYXk6IEFycmF5PERhdGEuU25vZGU+LFxuICAgIGZha2VTbm9kZVBvb2w6IEFycmF5PERhdGEuU25vZGU+LFxuICAgIGFzc29jaWF0ZWRXaXRoOiBzdHJpbmcsXG4gICAgZmFrZVN3YXJtRm9yQXNzb2NpYXRlZFdpdGg6IEFycmF5PHN0cmluZz47XG5cbiAgbGV0IG9sZE9uaW9uUGF0aHM6IEFycmF5PEFycmF5PERhdGEuU25vZGU+PjtcblxuICBiZWZvcmVFYWNoKGFzeW5jICgpID0+IHtcbiAgICBndWFyZFB1YmtleXMgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5cygzKS5tYXAobiA9PiBuLmtleSk7XG4gICAgb3RoZXJOb2Rlc1B1YmtleXMgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5cygyMCkubWFwKG4gPT4gbi5rZXkpO1xuXG4gICAgU05vZGVBUEkuT25pb25zLnJlc2V0U25vZGVGYWlsdXJlQ291bnQoKTtcblxuICAgIGd1YXJkTm9kZXNBcnJheSA9IGd1YXJkUHVia2V5cy5tYXAoZ2VuZXJhdGVGYWtlU25vZGVXaXRoRWRLZXkpO1xuICAgIGd1YXJkU25vZGUxID0gZ3VhcmROb2Rlc0FycmF5WzBdO1xuXG4gICAgb3RoZXJOb2Rlc0FycmF5ID0gb3RoZXJOb2Rlc1B1YmtleXMubWFwKGdlbmVyYXRlRmFrZVNub2RlV2l0aEVkS2V5KTtcblxuICAgIGZha2VTbm9kZVBvb2wgPSBbLi4uZ3VhcmROb2Rlc0FycmF5LCAuLi5vdGhlck5vZGVzQXJyYXldO1xuXG4gICAgYXNzb2NpYXRlZFdpdGggPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5O1xuICAgIGZha2VTd2FybUZvckFzc29jaWF0ZWRXaXRoID0gb3RoZXJOb2Rlc1B1YmtleXMuc2xpY2UoMCwgNik7XG4gICAgLy8gU3R1YnNcbiAgICBzYW5kYm94LnN0dWIoT25pb25QYXRocywgJ3NlbGVjdEd1YXJkTm9kZXMnKS5yZXNvbHZlcyhndWFyZE5vZGVzQXJyYXkpO1xuICAgIHNhbmRib3guc3R1YihTTm9kZUFQSS5TTm9kZUFQSSwgJ1RFU1RfZ2V0U25vZGVQb29sRnJvbVNub2RlJykucmVzb2x2ZXMoZ3VhcmROb2Rlc0FycmF5KTtcbiAgICBUZXN0VXRpbHMuc3R1YkRhdGEoJ2dldEd1YXJkTm9kZXMnKS5yZXNvbHZlcyhbXG4gICAgICBndWFyZFB1YmtleXNbMF0sXG4gICAgICBndWFyZFB1YmtleXNbMV0sXG4gICAgICBndWFyZFB1YmtleXNbMl0sXG4gICAgXSk7XG4gICAgVGVzdFV0aWxzLnN0dWJXaW5kb3coJ2dldFNlZWROb2RlTGlzdCcsICgpID0+IFsnc2VlZG5vZGUxJ10pO1xuICAgIHNhbmRib3guc3R1YihTZWVkTm9kZUFQSSwgJ2ZldGNoU25vZGVQb29sRnJvbVNlZWROb2RlV2l0aFJldHJpZXMnKS5yZXNvbHZlcyhmYWtlU25vZGVQb29sKTtcbiAgICBzYW5kYm94LnN0dWIoRGF0YSwgJ2dldFN3YXJtTm9kZXNGb3JQdWJrZXknKS5yZXNvbHZlcyhmYWtlU3dhcm1Gb3JBc3NvY2lhdGVkV2l0aCk7XG4gICAgdXBkYXRlR3VhcmROb2Rlc1N0dWIgPSBzYW5kYm94LnN0dWIoRGF0YSwgJ3VwZGF0ZUd1YXJkTm9kZXMnKS5yZXNvbHZlcygpO1xuXG4gICAgLy8gdGhvc2UgYXJlIHN0aWxsIGRvaW5nIHdoYXQgdGhleSBkbywgYnV0IHdlIHNweSBvbiB0aGVpciBleGVjdXRhdGlvblxuICAgIHVwZGF0ZVN3YXJtU3B5ID0gc2FuZGJveC5zdHViKERhdGEsICd1cGRhdGVTd2FybU5vZGVzRm9yUHVia2V5JykucmVzb2x2ZXMoKTtcbiAgICBzYW5kYm94XG4gICAgICAuc3R1YihEYXRhLCAnZ2V0SXRlbUJ5SWQnKVxuICAgICAgLndpdGhBcmdzKERhdGEuU05PREVfUE9PTF9JVEVNX0lEKVxuICAgICAgLnJlc29sdmVzKHsgaWQ6IERhdGEuU05PREVfUE9PTF9JVEVNX0lELCB2YWx1ZTogJycgfSk7XG4gICAgc2FuZGJveC5zdHViKERhdGEsICdjcmVhdGVPclVwZGF0ZUl0ZW0nKS5yZXNvbHZlcygpO1xuICAgIGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wgPSBzYW5kYm94LnNweShTTm9kZUFQSS5Tbm9kZVBvb2wsICdkcm9wU25vZGVGcm9tU25vZGVQb29sJyk7XG4gICAgZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkgPSBzYW5kYm94LnNweShTTm9kZUFQSS5Tbm9kZVBvb2wsICdkcm9wU25vZGVGcm9tU3dhcm1JZk5lZWRlZCcpO1xuICAgIGRyb3BTbm9kZUZyb21QYXRoU3B5ID0gc2FuZGJveC5zcHkoT25pb25QYXRocywgJ2Ryb3BTbm9kZUZyb21QYXRoJyk7XG4gICAgaW5jcmVtZW50QmFkUGF0aENvdW50T3JEcm9wU3B5ID0gc2FuZGJveC5zcHkoT25pb25QYXRocywgJ2luY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcCcpO1xuICAgIGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkgPSBzYW5kYm94LnNweShTTm9kZUFQSS5PbmlvbnMsICdpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wJyk7XG5cbiAgICBPbmlvblBhdGhzLmNsZWFyVGVzdE9uaW9uUGF0aCgpO1xuXG4gICAgT25pb25QYXRocy5yZXNldFBhdGhGYWlsdXJlQ291bnQoKTtcblxuICAgIGF3YWl0IE9uaW9uUGF0aHMuZ2V0T25pb25QYXRoKHt9KTtcblxuICAgIG9sZE9uaW9uUGF0aHMgPSBPbmlvblBhdGhzLlRFU1RfZ2V0VGVzdE9uaW9uUGF0aCgpO1xuICAgIHNhbmRib3hcbiAgICAgIC5zdHViKFNOb2RlQVBJLk9uaW9ucywgJ2RlY29kZU9uaW9uUmVzdWx0JylcbiAgICAgIC5jYWxsc0Zha2UoKF9zeW1rZXk6IEFycmF5QnVmZmVyLCBwbGFpbnRleHQ6IHN0cmluZykgPT5cbiAgICAgICAgUHJvbWlzZS5yZXNvbHZlKHsgcGxhaW50ZXh0LCBjaXBoZXJ0ZXh0QnVmZmVyOiBuZXcgVWludDhBcnJheSgpIH0pXG4gICAgICApO1xuICB9KTtcblxuICBhZnRlckVhY2goKCkgPT4ge1xuICAgIFRlc3RVdGlscy5yZXN0b3JlU3R1YnMoKTtcbiAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3Byb2Nlc3NPbmlvblJlc3BvbnNlJywgKCkgPT4ge1xuICAgIGl0KCd0aHJvd3MgYSBub24tcmV0cnlhYmxlIGVycm9yIHdoZW4gdGhlIHJlcXVlc3QgaXMgYWJvcnRlZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcHJvY2Vzc09uaW9uUmVzcG9uc2Uoe1xuICAgICAgICAgIHJlc3BvbnNlOiBnZXRGYWtlUmVzcG9uc2VPblBhdGgoKSxcbiAgICAgICAgICBzeW1tZXRyaWNLZXk6IG5ldyBVaW50OEFycmF5KCksXG4gICAgICAgICAgZ3VhcmROb2RlOiBndWFyZFNub2RlMSxcbiAgICAgICAgICBhYm9ydFNpZ25hbDogYWJvcnRDb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgfSk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRXJyb3IgZXhwZWN0ZWQnKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZXhwZWN0KGUubWVzc2FnZSkudG8uZXF1YWwoJ1JlcXVlc3QgZ290IGFib3J0ZWQnKTtcbiAgICAgICAgLy8gdGhpcyBtYWtlcyBzdXJlIHRoYXQgdGhpcyBjYWxsIHdvdWxkIG5vdCBiZSByZXRyaWVkXG4gICAgICAgIGV4cGVjdChlLm5hbWUpLnRvLmVxdWFsKCdBYm9ydEVycm9yJyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpdCgnZG9lcyBub3QgdGhyb3cgaWYgd2UgZ2V0IDIwMCBvbiBwYXRoIGFuZCBkZXN0aW5hdGlvbicsIGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25EZXN0aW5hdGlvbigyMDApLFxuICAgICAgICAgIHN5bW1ldHJpY0tleTogbmV3IFVpbnQ4QXJyYXkoKSxcbiAgICAgICAgICBndWFyZE5vZGU6IGd1YXJkU25vZGUxLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEaWQgbm90IHRocm93Jyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGV4cGVjdChlLm1lc3NhZ2UpLnRvLmVxdWFsKCdEaWQgbm90IHRocm93Jyk7XG4gICAgICB9XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVNub2RlUG9vbC5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVBhdGhTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgfSk7XG5cbiAgICBpdCgnZG9lcyBub3QgdGhyb3cgaWYgd2UgZ2V0IDIwMCBvbiBwYXRoIGJ1dCBubyBzdGF0dXMgY29kZSBvbiBkZXN0aW5hdGlvbicsIGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25EZXN0aW5hdGlvbigpLFxuICAgICAgICAgIHN5bW1ldHJpY0tleTogbmV3IFVpbnQ4QXJyYXkoKSxcbiAgICAgICAgICBndWFyZE5vZGU6IGd1YXJkU25vZGUxLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEaWQgbm90IHRocm93Jyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGV4cGVjdChlLm1lc3NhZ2UpLnRvLmVxdWFsKCdEaWQgbm90IHRocm93Jyk7XG4gICAgICB9XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVNub2RlUG9vbC5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVBhdGhTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgncHJvY2Vzc09uaW9uUmVzcG9uc2UgLSA0MDYnLCAoKSA9PiB7XG4gICAgICBpdCgndGhyb3dzIGFuIG5vbiByZXRyeWFibGUgZXJyb3Igd2UgZ2V0IGEgNDA2IG9uIHBhdGgnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgcHJvY2Vzc09uaW9uUmVzcG9uc2Uoe1xuICAgICAgICAgICAgcmVzcG9uc2U6IGdldEZha2VSZXNwb25zZU9uUGF0aCg0MDYpLFxuICAgICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgICAgZ3VhcmROb2RlOiBndWFyZFNub2RlMSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIGV4cGVjdGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBleHBlY3QoZS5tZXNzYWdlKS50by5lcXVhbChcbiAgICAgICAgICAgICdZb3VyIGNsb2NrIGlzIG91dCBvZiBzeW5jIHdpdGggdGhlIG5ldHdvcmsuIENoZWNrIHlvdXIgY2xvY2suJ1xuICAgICAgICAgICk7XG4gICAgICAgICAgLy8gdGhpcyBtYWtlcyBzdXJlIHRoYXQgdGhpcyBjYWxsIHdvdWxkIG5vdCBiZSByZXRyaWVkXG4gICAgICAgICAgZXhwZWN0KGUubmFtZSkudG8uZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVNub2RlUG9vbC5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21QYXRoU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIH0pO1xuICAgICAgaXQoJ3Rocm93cyBhbiBub24gcmV0cnlhYmxlIGVycm9yIHdlIGdldCBhIDQwNiBvbiBkZXN0aW5hdGlvbicsIGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBwcm9jZXNzT25pb25SZXNwb25zZSh7XG4gICAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25EZXN0aW5hdGlvbig0MDYpLFxuICAgICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgICAgZ3VhcmROb2RlOiBndWFyZFNub2RlMSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIGV4cGVjdGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBleHBlY3QoZS5tZXNzYWdlKS50by5lcXVhbChcbiAgICAgICAgICAgICdZb3VyIGNsb2NrIGlzIG91dCBvZiBzeW5jIHdpdGggdGhlIG5ldHdvcmsuIENoZWNrIHlvdXIgY2xvY2suJ1xuICAgICAgICAgICk7XG4gICAgICAgICAgLy8gdGhpcyBtYWtlcyBzdXJlIHRoYXQgdGhpcyBjYWxsIHdvdWxkIG5vdCBiZSByZXRyaWVkXG4gICAgICAgICAgZXhwZWN0KGUubmFtZSkudG8uZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVNub2RlUG9vbC5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21QYXRoU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ3Byb2Nlc3NPbmlvblJlc3BvbnNlIC0gNDIxJywgKCkgPT4ge1xuICAgICAgZGVzY3JpYmUoJ3Byb2Nlc3NPbmlvblJlc3BvbnNlIC0gNDIxIC0gb24gcGF0aCcsICgpID0+IHtcbiAgICAgICAgaXQoJ3Rocm93cyBhIG5vbi1yZXRyeWFibGUgZXJyb3IgaWYgd2UgZ2V0IGEgNDIxIHN0YXR1cyBjb2RlIHdpdGhvdXQgbmV3IHN3YXJtJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhcmdldE5vZGUgPSBvdGhlck5vZGVzUHVia2V5c1swXTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBwcm9jZXNzT25pb25SZXNwb25zZSh7XG4gICAgICAgICAgICAgIHJlc3BvbnNlOiBnZXRGYWtlUmVzcG9uc2VPblBhdGgoNDIxKSxcbiAgICAgICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgICAgICBndWFyZE5vZGU6IGd1YXJkU25vZGUxLFxuICAgICAgICAgICAgICBsc3JwY0VkMjU1MTlLZXk6IHRhcmdldE5vZGUsXG5cbiAgICAgICAgICAgICAgYXNzb2NpYXRlZFdpdGgsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXJyb3IgZXhwZWN0ZWQnKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBleHBlY3QoZS5tZXNzYWdlKS50by5lcXVhbCgnNDIxIGhhbmRsZWQuIFJldHJ5IHRoaXMgcmVxdWVzdCB3aXRoIGEgbmV3IHRhcmdldE5vZGUnKTtcbiAgICAgICAgICAgIGV4cGVjdChlLm5hbWUpLnRvLmVxdWFsKCdBYm9ydEVycm9yJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGV4cGVjdCh1cGRhdGVTd2FybVNweS5jYWxsQ291bnQpLnRvLmVxKDEpO1xuICAgICAgICAgIC8vIGlmIHdlIGRvbid0IGdldCBhIG5ldyBzd2FybSBpbiB0aGUgcmV0dXJuZWQganNvbiwgd2UgZHJvcCB0aGUgdGFyZ2V0IG5vZGUgY29uc2lkZXJpbmcgaXQgaXMgYSBiYWQgc25vZGVcbiAgICAgICAgICBleHBlY3QodXBkYXRlU3dhcm1TcHkuYXJnc1swXVsxXSkudG8uZGVlcC5lcShcbiAgICAgICAgICAgIGZha2VTd2FybUZvckFzc29jaWF0ZWRXaXRoLmZpbHRlcihtID0+IG0gIT09IHRhcmdldE5vZGUpXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIC8vIG5vdyB3ZSBtYWtlIHN1cmUgdGhhdCB0aGlzIGJhZCBzbm9kZSB3YXMgZHJvcHBlZCBmcm9tIHRoaXMgcHVia2V5J3Mgc3dhcm1cbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuZmlyc3RDYWxsLmFyZ3NbMF0pLnRvLmVxKGFzc29jaWF0ZWRXaXRoKTtcbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuZmlyc3RDYWxsLmFyZ3NbMV0pLnRvLmVxKHRhcmdldE5vZGUpO1xuXG4gICAgICAgICAgLy8gdGhpcyBub2RlIGZhaWxlZCBvbmx5IG9uY2UuIGl0IHNob3VsZCBub3QgYmUgZHJvcHBlZCB5ZXQgZnJvbSB0aGUgc25vZGVwb29sXG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVBhdGhTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgICBleHBlY3QoaW5jcmVtZW50QmFkUGF0aENvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAgICAgICBleHBlY3QoaW5jcmVtZW50QmFkU25vZGVDb3VudE9yRHJvcFNweS5maXJzdENhbGwuYXJnc1swXSkudG8uZGVlcC5lcSh7XG4gICAgICAgICAgICBzbm9kZUVkMjU1MTk6IHRhcmdldE5vZGUsXG4gICAgICAgICAgICBhc3NvY2lhdGVkV2l0aCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgZGVzY3JpYmUoJ3Byb2Nlc3NPbmlvblJlc3BvbnNlIC0gNDIxIC0gb24gZGVzdGluYXRpb24nLCAoKSA9PiB7XG4gICAgICAgIGl0KCd0aHJvd3MgYSBub24tcmV0cnlhYmxlIGVycm9yIHdlIGdldCBhIDQyMSBzdGF0dXMgY29kZSB3aXRoIGEgbmV3IHN3YXJtJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhcmdldE5vZGUgPSBvdGhlck5vZGVzUHVia2V5c1swXTtcblxuICAgICAgICAgIGNvbnN0IHJlc3VsdEV4cGVjdGVkOiBBcnJheTxEYXRhLlNub2RlPiA9IFtcbiAgICAgICAgICAgIG90aGVyTm9kZXNBcnJheVs0XSxcbiAgICAgICAgICAgIG90aGVyTm9kZXNBcnJheVs1XSxcbiAgICAgICAgICAgIG90aGVyTm9kZXNBcnJheVs2XSxcbiAgICAgICAgICBdO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBwcm9jZXNzT25pb25SZXNwb25zZSh7XG4gICAgICAgICAgICAgIHJlc3BvbnNlOiBnZXRGYWtlUmVzcG9uc2VPbkRlc3RpbmF0aW9uKFxuICAgICAgICAgICAgICAgIDQyMSxcbiAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7IHNub2RlczogcmVzdWx0RXhwZWN0ZWQgfSlcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgICAgICBndWFyZE5vZGU6IGd1YXJkU25vZGUxLFxuICAgICAgICAgICAgICBsc3JwY0VkMjU1MTlLZXk6IHRhcmdldE5vZGUsXG4gICAgICAgICAgICAgIGFzc29jaWF0ZWRXaXRoLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIGV4cGVjdGVkJyk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgZXhwZWN0KGUubWVzc2FnZSkudG8uZXF1YWwoJzQyMSBoYW5kbGVkLiBSZXRyeSB0aGlzIHJlcXVlc3Qgd2l0aCBhIG5ldyB0YXJnZXROb2RlJyk7XG4gICAgICAgICAgICBleHBlY3QoZS5uYW1lKS50by5lcXVhbCgnQWJvcnRFcnJvcicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBleHBlY3QodXBkYXRlU3dhcm1TcHkuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAgICAgICAvLyB3ZSBnb3QgMyBzbm9kZSBpbiB0aGUgcmVzdWx0cywgdGhpcyBpcyBvdXIgbmV3IHN3YXJtIGZvciB0aGlzIGFzc29jaWF0ZWQgd2l0aCBwdWJrZXlcbiAgICAgICAgICBleHBlY3QodXBkYXRlU3dhcm1TcHkuYXJnc1swXVsxXSkudG8uZGVlcC5lcShyZXN1bHRFeHBlY3RlZC5tYXAobSA9PiBtLnB1YmtleV9lZDI1NTE5KSk7XG5cbiAgICAgICAgICAvLyB3ZSBnb3QgYSBuZXcgc3dhcm0gZm9yIHRoaXMgcHVia2V5LiBzbyBpdCdzIE9LIHRoYXQgZHJvcFNub2RlRnJvbVN3YXJtIHdhcyBub3QgY2FsbGVkIGZvciB0aGlzIHB1YmtleVxuXG4gICAgICAgICAgLy8gdGhpcyBub2RlIGZhaWxlZCBvbmx5IG9uY2UuIGl0IHNob3VsZCBub3QgYmUgZHJvcHBlZCB5ZXQgZnJvbSB0aGUgc25vZGVwb29sXG4gICAgICAgICAgLy8gdGhpcyBub2RlIGZhaWxlZCBvbmx5IG9uY2UuIGl0IHNob3VsZCBub3QgYmUgZHJvcHBlZCB5ZXQgZnJvbSB0aGUgc25vZGVwb29sXG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVBhdGhTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgICAgICBleHBlY3QoaW5jcmVtZW50QmFkUGF0aENvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAgICAgICBleHBlY3QoaW5jcmVtZW50QmFkU25vZGVDb3VudE9yRHJvcFNweS5maXJzdENhbGwuYXJnc1swXSkudG8uZGVlcC5lcSh7XG4gICAgICAgICAgICBzbm9kZUVkMjU1MTk6IHRhcmdldE5vZGUsXG4gICAgICAgICAgICBhc3NvY2lhdGVkV2l0aCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaXQoJ3Rocm93cyBhIG5vbi1yZXRyeWFibGUgZXJyb3Igd2UgZ2V0IGEgNDIxIHN0YXR1cyBjb2RlIHdpdGggaW52YWxpZCBqc29uIGJvZHknLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IG90aGVyTm9kZXNQdWJrZXlzWzBdO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICAgICAgcmVzcG9uc2U6IGdldEZha2VSZXNwb25zZU9uRGVzdGluYXRpb24oNDIxLCAnVEhJUyBJUyBTT01FIElOVkFMSUQgSlNPTicpLFxuICAgICAgICAgICAgICBzeW1tZXRyaWNLZXk6IG5ldyBVaW50OEFycmF5KCksXG4gICAgICAgICAgICAgIGd1YXJkTm9kZTogZ3VhcmRTbm9kZTEsXG4gICAgICAgICAgICAgIGxzcnBjRWQyNTUxOUtleTogdGFyZ2V0Tm9kZSxcblxuICAgICAgICAgICAgICBhc3NvY2lhdGVkV2l0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFcnJvciBleHBlY3RlZCcpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGV4cGVjdChlLm1lc3NhZ2UpLnRvLmVxdWFsKCc0MjEgaGFuZGxlZC4gUmV0cnkgdGhpcyByZXF1ZXN0IHdpdGggYSBuZXcgdGFyZ2V0Tm9kZScpO1xuICAgICAgICAgICAgZXhwZWN0KGUubmFtZSkudG8uZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZXhwZWN0KHVwZGF0ZVN3YXJtU3B5LmNhbGxDb3VudCkudG8uZXEoMSk7XG4gICAgICAgICAgLy8gd2UgaGF2ZSBhbiBpbnZhbGlkIGpzb24gY29udGVudC4ganVzdCByZW1vdmUgdGhlIHRhcmdldE5vZGUgZnJvbSB0aGUgbGlzdFxuICAgICAgICAgIGV4cGVjdCh1cGRhdGVTd2FybVNweS5hcmdzWzBdWzFdKS50by5kZWVwLmVxKFxuICAgICAgICAgICAgZmFrZVN3YXJtRm9yQXNzb2NpYXRlZFdpdGguZmlsdGVyKG0gPT4gbSAhPT0gdGFyZ2V0Tm9kZSlcbiAgICAgICAgICApO1xuICAgICAgICAgIC8vIG5vdyB3ZSBtYWtlIHN1cmUgdGhhdCB0aGlzIGJhZCBzbm9kZSB3YXMgZHJvcHBlZCBmcm9tIHRoaXMgcHVia2V5J3Mgc3dhcm1cbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuZmlyc3RDYWxsLmFyZ3NbMF0pLnRvLmVxKGFzc29jaWF0ZWRXaXRoKTtcbiAgICAgICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuZmlyc3RDYWxsLmFyZ3NbMV0pLnRvLmVxKHRhcmdldE5vZGUpO1xuICAgICAgICAgIC8vIHRoaXMgbm9kZSBmYWlsZWQgb25seSBvbmNlLiBpdCBzaG91bGQgbm90IGJlIGRyb3BwZWQgeWV0IGZyb20gdGhlIHNub2RlcG9vbFxuICAgICAgICAgIGV4cGVjdChkcm9wU25vZGVGcm9tU25vZGVQb29sLmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21QYXRoU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcFNweS5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMSk7XG4gICAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuZmlyc3RDYWxsLmFyZ3NbMF0pLnRvLmRlZXAuZXEoe1xuICAgICAgICAgICAgc25vZGVFZDI1NTE5OiB0YXJnZXROb2RlLFxuICAgICAgICAgICAgYXNzb2NpYXRlZFdpdGgsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCd0aHJvd3MgYSBub24tcmV0cnlhYmxlIG9uIGRlc3RpbmF0aW9uIDQyMSB3aXRob3V0IG5ldyBzd2FybSAnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IG90aGVyTm9kZXNQdWJrZXlzWzBdO1xuICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnN0cmluZ2lmeSh7IHN0YXR1czogNDIxIH0pO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICAgICAgcmVzcG9uc2U6IGdldEZha2VSZXNwb25zZU9uRGVzdGluYXRpb24oNDIxLCBqc29uKSxcbiAgICAgICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgICAgICBndWFyZE5vZGU6IGd1YXJkU25vZGUxLFxuICAgICAgICAgICAgICBsc3JwY0VkMjU1MTlLZXk6IHRhcmdldE5vZGUsXG4gICAgICAgICAgICAgIGFzc29jaWF0ZWRXaXRoLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIGV4cGVjdGVkJyk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgZXhwZWN0KGUubWVzc2FnZSkudG8uZXF1YWwoJzQyMSBoYW5kbGVkLiBSZXRyeSB0aGlzIHJlcXVlc3Qgd2l0aCBhIG5ldyB0YXJnZXROb2RlJyk7XG4gICAgICAgICAgICBleHBlY3QoZS5uYW1lKS50by5lcXVhbCgnQWJvcnRFcnJvcicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBleHBlY3QodXBkYXRlU3dhcm1TcHkuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAgICAgICAvLyA0MjEgd2l0aG91dCBzd2FybSBpbmNsdWRlZCBtZWFucyBkcm9wIHRoZSB0YXJnZXQgbm9kZSBvbmx5XG4gICAgICAgICAgZXhwZWN0KHVwZGF0ZVN3YXJtU3B5LmFyZ3NbMF1bMV0pLnRvLmRlZXAuZXEoXG4gICAgICAgICAgICBmYWtlU3dhcm1Gb3JBc3NvY2lhdGVkV2l0aC5maWx0ZXIobSA9PiBtICE9PSB0YXJnZXROb2RlKVxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBub3cgd2UgbWFrZSBzdXJlIHRoYXQgdGhpcyBiYWQgc25vZGUgd2FzIGRyb3BwZWQgZnJvbSB0aGlzIHB1YmtleSdzIHN3YXJtXG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmNhbGxDb3VudCkudG8uZXEoMSk7XG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmZpcnN0Q2FsbC5hcmdzWzBdKS50by5lcShhc3NvY2lhdGVkV2l0aCk7XG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmZpcnN0Q2FsbC5hcmdzWzFdKS50by5lcSh0YXJnZXROb2RlKTtcblxuICAgICAgICAgIC8vIHRoaXMgbm9kZSBmYWlsZWQgb25seSBvbmNlLiBpdCBzaG91bGQgbm90IGJlIGRyb3BwZWQgeWV0IGZyb20gdGhlIHNub2RlcG9vbFxuICAgICAgICAgIGV4cGVjdChkcm9wU25vZGVGcm9tU25vZGVQb29sLmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21QYXRoU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcFNweS5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMSk7XG4gICAgICAgICAgZXhwZWN0KGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuZmlyc3RDYWxsLmFyZ3NbMF0pLnRvLmRlZXAuZXEoe1xuICAgICAgICAgICAgc25vZGVFZDI1NTE5OiB0YXJnZXROb2RlLFxuICAgICAgICAgICAgYXNzb2NpYXRlZFdpdGgsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBwcm9jZXNzT25pb25SZXNwb25zZSBPWEVOIFNFUlZFUiBFUlJPUlxuICAgKi9cbiAgZGVzY3JpYmUoJ3Byb2Nlc3NPbmlvblJlc3BvbnNlIC0gT1hFTl9TRVJWRVJfRVJST1InLCAoKSA9PiB7XG4gICAgLy8gb3BlbiBncm91cCBzZXJ2ZXIgdjIgb25seSB0YWxrZXMgb25pb24gcm91dGluZyByZXF1ZXN0LiBTbyBlcnJvcnMgY2FuIG9ubHkgaGFwcGVuIGF0IGRlc3RpbmF0aW9uXG4gICAgaXQoJ3Rocm93cyBhIG5vbi1yZXRyeWFibGUgZXJyb3Igb24gb3hlbiBzZXJ2ZXIgZXJyb3JzIG9uIGRlc3RpbmF0aW9uJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IG90aGVyTm9kZXNQdWJrZXlzWzBdO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBwcm9jZXNzT25pb25SZXNwb25zZSh7XG4gICAgICAgICAgcmVzcG9uc2U6IGdldEZha2VSZXNwb25zZU9uRGVzdGluYXRpb24oNDAwLCBPWEVOX1NFUlZFUl9FUlJPUiksXG4gICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgIGd1YXJkTm9kZTogZ3VhcmRTbm9kZTEsXG4gICAgICAgICAgbHNycGNFZDI1NTE5S2V5OiB0YXJnZXROb2RlLFxuXG4gICAgICAgICAgYXNzb2NpYXRlZFdpdGgsXG4gICAgICAgIH0pO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIGV4cGVjdGVkJyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGV4cGVjdChlLm1lc3NhZ2UpLnRvLmVxdWFsKE9YRU5fU0VSVkVSX0VSUk9SKTtcbiAgICAgICAgZXhwZWN0KGUubmFtZSkudG8uZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGV4cGVjdCh1cGRhdGVTd2FybVNweS5jYWxsQ291bnQpLnRvLmVxKDApO1xuICAgICAgLy8gbm93IHdlIG1ha2Ugc3VyZSB0aGF0IHRoaXMgYmFkIHNub2RlIHdhcyBkcm9wcGVkIGZyb20gdGhpcyBwdWJrZXkncyBzd2FybVxuICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG5cbiAgICAgIC8vIHRoaXMgbm9kZSBkaWQgbm90IHJlYWxseSBmYWlsZWRcbiAgICAgIGV4cGVjdChkcm9wU25vZGVGcm9tU25vZGVQb29sLmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVBhdGhTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBwcm9jZXNzT25pb25SZXNwb25zZSBPWEVOIFNFUlZFUiBFUlJPUlxuICAgKi9cbiAgZGVzY3JpYmUoJ3Byb2Nlc3NPbmlvblJlc3BvbnNlIC0gNTAyIC0gbm9kZSBub3QgZm91bmQnLCAoKSA9PiB7XG4gICAgLy8gb3BlbiBncm91cCBzZXJ2ZXIgdjIgb25seSB0YWxrZXMgb25pb24gcm91dGluZyByZXF1ZXN0LiBTbyBlcnJvcnMgY2FuIG9ubHkgaGFwcGVuIGF0IGRlc3RpbmF0aW9uXG4gICAgaXQoJ3Rocm93cyBhIHJldHJ5YWJsZSBlcnJvciBvbiA1MDIgb24gaW50ZXJtZWRpYXRlIHNub2RlJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IG90aGVyTm9kZXNQdWJrZXlzWzBdO1xuICAgICAgY29uc3QgZmFpbGluZ1Nub2RlID0gb2xkT25pb25QYXRoc1swXVsxXTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25QYXRoKFxuICAgICAgICAgICAgNTAyLFxuICAgICAgICAgICAgYCR7TkVYVF9OT0RFX05PVF9GT1VORF9QUkVGSVh9JHtmYWlsaW5nU25vZGUucHVia2V5X2VkMjU1MTl9YFxuICAgICAgICAgICksXG4gICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgIGd1YXJkTm9kZTogZ3VhcmRTbm9kZTEsXG4gICAgICAgICAgbHNycGNFZDI1NTE5S2V5OiB0YXJnZXROb2RlLFxuICAgICAgICAgIGFzc29jaWF0ZWRXaXRoLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFcnJvciBleHBlY3RlZCcpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBleHBlY3QoZS5tZXNzYWdlKS50by5lcXVhbCgnQmFkIFBhdGggaGFuZGxlZC4gUmV0cnkgdGhpcyByZXF1ZXN0LiBTdGF0dXM6IDUwMicpO1xuICAgICAgICBleHBlY3QoZS5uYW1lKS50by5ub3QuZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGV4cGVjdCh1cGRhdGVTd2FybVNweS5jYWxsQ291bnQpLnRvLmVxKDApO1xuXG4gICAgICAvLyB0aGlzIHNwZWNpZmljIG5vZGUgZmFpbGVkIGp1c3Qgb25jZSBidXQgaXQgd2FzIGEgbm9kZSBub3QgZm91bmQgZXJyb3IuIEZvcmNlIGRyb3AgaXRcbiAgICAgIGV4cGVjdChcbiAgICAgICAgZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuY2FsbENvdW50LFxuICAgICAgICAnZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkgc2hvdWxkIGhhdmUgYmVlbiBjYWxsZWQnXG4gICAgICApLnRvLmVxKDEpO1xuICAgICAgZXhwZWN0KFxuICAgICAgICBkcm9wU25vZGVGcm9tU25vZGVQb29sLmNhbGxDb3VudCxcbiAgICAgICAgJ2Ryb3BTbm9kZUZyb21Tbm9kZVBvb2wgc2hvdWxkIGhhdmUgYmVlbiBjYWxsZWQnXG4gICAgICApLnRvLmVxKDEpO1xuICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21QYXRoU3B5LmNhbGxDb3VudCwgJ2Ryb3BTbm9kZUZyb21QYXRoIHNob3VsZCBoYXZlIGJlZW4gY2FsbGVkJykudG8uZXEoMSk7XG4gICAgICBleHBlY3QoXG4gICAgICAgIGluY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcFNweS5jYWxsQ291bnQsXG4gICAgICAgICdpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3Agc2hvdWxkIG5vdCBoYXZlIGJlZW4gY2FsbGVkJ1xuICAgICAgKS50by5lcSgwKTtcbiAgICAgIGV4cGVjdChcbiAgICAgICAgaW5jcmVtZW50QmFkU25vZGVDb3VudE9yRHJvcFNweS5jYWxsQ291bnQsXG4gICAgICAgICdpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wIHNob3VsZCBub3QgaGF2ZSBiZWVuIGNhbGxlZCdcbiAgICAgICkudG8uZXEoMCk7XG4gICAgfSk7XG5cbiAgICBpdCgndGhyb3dzIGEgcmV0cnlhYmxlIGVycm9yIG9uIDUwMiBvbiBsYXN0IHNub2RlJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IG90aGVyTm9kZXNQdWJrZXlzWzBdO1xuICAgICAgY29uc3QgZmFpbGluZ1Nub2RlID0gb2xkT25pb25QYXRoc1swXVsyXTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25QYXRoKFxuICAgICAgICAgICAgNTAyLFxuICAgICAgICAgICAgYCR7TkVYVF9OT0RFX05PVF9GT1VORF9QUkVGSVh9JHtmYWlsaW5nU25vZGUucHVia2V5X2VkMjU1MTl9YFxuICAgICAgICAgICksXG4gICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgIGd1YXJkTm9kZTogZ3VhcmRTbm9kZTEsXG4gICAgICAgICAgbHNycGNFZDI1NTE5S2V5OiB0YXJnZXROb2RlLFxuICAgICAgICAgIGFzc29jaWF0ZWRXaXRoLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFcnJvciBleHBlY3RlZCcpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBleHBlY3QoZS5tZXNzYWdlKS50by5lcXVhbCgnQmFkIFBhdGggaGFuZGxlZC4gUmV0cnkgdGhpcyByZXF1ZXN0LiBTdGF0dXM6IDUwMicpO1xuICAgICAgICBleHBlY3QoZS5uYW1lKS50by5ub3QuZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGV4cGVjdCh1cGRhdGVTd2FybVNweS5jYWxsQ291bnQpLnRvLmVxKDApO1xuXG4gICAgICAvLyB0aGlzIHNwZWNpZmljIG5vZGUgZmFpbGVkIGp1c3Qgb25jZSBidXQgaXQgd2FzIGEgbm9kZSBub3QgZm91bmQgZXJyb3IuIEZvcmNlIGRyb3AgaXRcbiAgICAgIGV4cGVjdChkcm9wU25vZGVGcm9tU3dhcm1JZk5lZWRlZFNweS5jYWxsQ291bnQpLnRvLmVxKDEpO1xuXG4gICAgICBleHBlY3QoXG4gICAgICAgIGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wuY2FsbENvdW50LFxuICAgICAgICAnZHJvcFNub2RlRnJvbVNub2RlUG9vbCBzaG91bGQgaGF2ZSBiZWVuIGNhbGxlZCdcbiAgICAgICkudG8uZXEoMSk7XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVBhdGhTcHkuY2FsbENvdW50LCAnZHJvcFNub2RlRnJvbVBhdGggc2hvdWxkIGhhdmUgYmVlbiBjYWxsZWQnKS50by5lcSgxKTtcbiAgICAgIGV4cGVjdChcbiAgICAgICAgaW5jcmVtZW50QmFkUGF0aENvdW50T3JEcm9wU3B5LmNhbGxDb3VudCxcbiAgICAgICAgJ2luY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcCBzaG91bGQgbm90IGhhdmUgYmVlbiBjYWxsZWQnXG4gICAgICApLnRvLmVxKDApO1xuICAgICAgZXhwZWN0KFxuICAgICAgICBpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmNhbGxDb3VudCxcbiAgICAgICAgJ2luY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3Agc2hvdWxkIG5vdCBoYXZlIGJlZW4gY2FsbGVkJ1xuICAgICAgKS50by5lcSgwKTtcbiAgICB9KTtcblxuICAgIGl0KCdkcm9wIGEgc25vZGUgZnJvbSBwb29sLCBzd2FybSBhbmQgcGF0aCBpZiBpdCBrZWVwIGZhaWxpbmcnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXROb2RlID0gb3RoZXJOb2Rlc1B1YmtleXNbMF07XG4gICAgICBjb25zdCBmYWlsaW5nU25vZGUgPSBvbGRPbmlvblBhdGhzWzBdWzFdO1xuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IDM7IGluZGV4KyspIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBwcm9jZXNzT25pb25SZXNwb25zZSh7XG4gICAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25QYXRoKFxuICAgICAgICAgICAgICA1MDIsXG4gICAgICAgICAgICAgIGAke05FWFRfTk9ERV9OT1RfRk9VTkRfUFJFRklYfSR7ZmFpbGluZ1Nub2RlLnB1YmtleV9lZDI1NTE5fWBcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBzeW1tZXRyaWNLZXk6IG5ldyBVaW50OEFycmF5KCksXG4gICAgICAgICAgICBndWFyZE5vZGU6IGd1YXJkU25vZGUxLFxuICAgICAgICAgICAgbHNycGNFZDI1NTE5S2V5OiB0YXJnZXROb2RlLFxuICAgICAgICAgICAgYXNzb2NpYXRlZFdpdGgsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFcnJvciBleHBlY3RlZCcpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgZXhwZWN0KGUubWVzc2FnZSkudG8uZXF1YWwoJ0JhZCBQYXRoIGhhbmRsZWQuIFJldHJ5IHRoaXMgcmVxdWVzdC4gU3RhdHVzOiA1MDInKTtcbiAgICAgICAgICBleHBlY3QoZS5uYW1lKS50by5ub3QuZXF1YWwoJ0Fib3J0RXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBleHBlY3QodXBkYXRlU3dhcm1TcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAgIC8vIG5vdyB3ZSBtYWtlIHN1cmUgdGhhdCB0aGlzIGJhZCBzbm9kZSB3YXMgZHJvcHBlZCBmcm9tIHRoaXMgcHVia2V5J3Mgc3dhcm1cbiAgICAgIGV4cGVjdChkcm9wU25vZGVGcm9tU3dhcm1JZk5lZWRlZFNweS5jYWxsQ291bnQpLnRvLmVxKDMpO1xuICAgICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmZpcnN0Q2FsbC5hcmdzWzBdKS50by5lcShhc3NvY2lhdGVkV2l0aCk7XG4gICAgICBleHBlY3QoZHJvcFNub2RlRnJvbVN3YXJtSWZOZWVkZWRTcHkuZmlyc3RDYWxsLmFyZ3NbMV0pLnRvLmVxKGZhaWxpbmdTbm9kZS5wdWJrZXlfZWQyNTUxOSk7XG5cbiAgICAgIGV4cGVjdChcbiAgICAgICAgZHJvcFNub2RlRnJvbVNub2RlUG9vbC5jYWxsQ291bnQsXG4gICAgICAgICdkcm9wU25vZGVGcm9tU25vZGVQb29sIHNob3VsZCBoYXZlIGJlZW4gY2FsbGVkJ1xuICAgICAgKS50by5lcSgzKTtcbiAgICAgIGV4cGVjdChkcm9wU25vZGVGcm9tUGF0aFNweS5jYWxsQ291bnQsICdkcm9wU25vZGVGcm9tUGF0aCBzaG91bGQgaGF2ZSBiZWVuIGNhbGxlZCcpLnRvLmVxKDMpO1xuICAgICAgZXhwZWN0KFxuICAgICAgICBpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50LFxuICAgICAgICAnaW5jcmVtZW50QmFkUGF0aENvdW50T3JEcm9wIHNob3VsZCBub3QgaGF2ZSBiZWVuIGNhbGxlZCdcbiAgICAgICkudG8uZXEoMCk7XG4gICAgICBleHBlY3QoXG4gICAgICAgIGluY3JlbWVudEJhZFNub2RlQ291bnRPckRyb3BTcHkuY2FsbENvdW50LFxuICAgICAgICAnaW5jcmVtZW50QmFkU25vZGVDb3VudE9yRHJvcCBzaG91bGQgbm90IGhhdmUgYmVlbiBjYWxsZWQnXG4gICAgICApLnRvLmVxKDApO1xuICAgIH0pO1xuICB9KTtcbiAgaXQoJ2Ryb3AgYSBwYXRoIGlmIGl0IGtlZXAgZmFpbGluZyB3aXRob3V0IGEgc3BlY2lmaWMgbm9kZSBpbiBmYXVsdCcsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB0YXJnZXROb2RlID0gb3RoZXJOb2Rlc1B1YmtleXNbMF07XG4gICAgY29uc3QgZ3VhcmROb2RlID0gb2xkT25pb25QYXRoc1swXVswXTtcblxuICAgIC8vIGRvaW5nIHRoaXMsXG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IDM7IGluZGV4KyspIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHByb2Nlc3NPbmlvblJlc3BvbnNlKHtcbiAgICAgICAgICByZXNwb25zZTogZ2V0RmFrZVJlc3BvbnNlT25QYXRoKDUwMCksXG4gICAgICAgICAgc3ltbWV0cmljS2V5OiBuZXcgVWludDhBcnJheSgpLFxuICAgICAgICAgIGd1YXJkTm9kZSxcbiAgICAgICAgICBsc3JwY0VkMjU1MTlLZXk6IHRhcmdldE5vZGUsXG4gICAgICAgICAgYXNzb2NpYXRlZFdpdGgsXG4gICAgICAgIH0pO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIGV4cGVjdGVkJyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGV4cGVjdChlLm1lc3NhZ2UpLnRvLmVxdWFsKCdCYWQgUGF0aCBoYW5kbGVkLiBSZXRyeSB0aGlzIHJlcXVlc3QuIFN0YXR1czogNTAwJyk7XG4gICAgICAgIGV4cGVjdChlLm5hbWUpLnRvLm5vdC5lcXVhbCgnQWJvcnRFcnJvcicpO1xuICAgICAgICBpZiAoaW5kZXggPCAyKSB7XG4gICAgICAgICAgZXhwZWN0KHBhdGhGYWlsdXJlQ291bnRbZ3VhcmROb2RlLnB1YmtleV9lZDI1NTE5XSkudG8uZXEoaW5kZXggKyAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBwYXRoRmFpbHVyZUNvdW50IGlzIHJlc2V0IG9uY2Ugd2UgaGl0IDMgZm9yIHRoaXMgZ3VhcmRub2RlXG4gICAgICAgICAgZXhwZWN0KHBhdGhGYWlsdXJlQ291bnRbZ3VhcmROb2RlLnB1YmtleV9lZDI1NTE5XSkudG8uZXEoMCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleHBlY3QodXBkYXRlU3dhcm1TcHkuY2FsbENvdW50KS50by5lcSgwKTtcbiAgICAvLyBlYWNoIHNub2RlIG9uIHRoZSBwYXRoIHNob3VsZCBoYXZlIGl0cyBjb3VudCBzZXQgdG8gdGhyZWUuXG4gICAgLy8gZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybVNweS5jYWxsQ291bnQpLnRvLmVxKDEpO1xuXG4gICAgLy8gdGhpcyBzcGVjaWZpYyBwYXRoIGZhaWxlZCB0aHJlZSB0aW1lc1xuICAgIGV4cGVjdChpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuY2FsbENvdW50KS50by5lcSgzKTtcbiAgICBleHBlY3QoaW5jcmVtZW50QmFkU25vZGVDb3VudE9yRHJvcFNweS5jYWxsQ291bnQpLnRvLmVxKDIgKiAzKTsgLy8gdGhyZWUgdGltZXMgZm9yIGVhY2ggbm9kZXMgZXhjbHVkaW5nIHRoZSBndWFyZCBub2RlXG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IDY7IGluZGV4KyspIHtcbiAgICAgIGV4cGVjdChpbmNyZW1lbnRCYWRTbm9kZUNvdW50T3JEcm9wU3B5LmFyZ3NbaW5kZXhdWzBdKS50by5kZWVwLmVxKHtcbiAgICAgICAgc25vZGVFZDI1NTE5OiBvbGRPbmlvblBhdGhzWzBdWyhpbmRleCAlIDIpICsgMV0ucHVia2V5X2VkMjU1MTksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBleHBlY3QodXBkYXRlR3VhcmROb2Rlc1N0dWIuY2FsbENvdW50KS50by5lcSgxKTtcbiAgICAvLyB3ZSBkb250IGtub3cgd2hpY2ggc25vZGUgZmFpbGVkIHNvIGRvbid0IGV4Y2x1ZGUgYW55IG9mIHRob3NlIGZyb20gc3dhcm1zXG4gICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Td2FybUlmTmVlZGVkU3B5LmNhbGxDb3VudCkudG8uZXEoMCk7XG5cbiAgICBleHBlY3QoZ3VhcmROb2RlLnB1YmtleV9lZDI1NTE5KS50by5lcShpbmNyZW1lbnRCYWRQYXRoQ291bnRPckRyb3BTcHkuYXJnc1swXVswXSk7XG4gICAgZXhwZWN0KGd1YXJkTm9kZS5wdWJrZXlfZWQyNTUxOSkudG8uZXEoaW5jcmVtZW50QmFkUGF0aENvdW50T3JEcm9wU3B5LmFyZ3NbMV1bMF0pO1xuICAgIGV4cGVjdChndWFyZE5vZGUucHVia2V5X2VkMjU1MTkpLnRvLmVxKGluY3JlbWVudEJhZFBhdGhDb3VudE9yRHJvcFNweS5hcmdzWzJdWzBdKTtcblxuICAgIGV4cGVjdChkcm9wU25vZGVGcm9tUGF0aFNweS5jYWxsQ291bnQpLnRvLmVxKDIpO1xuICAgIGV4cGVjdChkcm9wU25vZGVGcm9tU25vZGVQb29sLmNhbGxDb3VudCkudG8uZXEoMyk7XG4gICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wuYXJnc1swXVswXSkudG8uZXEob2xkT25pb25QYXRoc1swXVsxXS5wdWJrZXlfZWQyNTUxOSk7XG4gICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wuYXJnc1sxXVswXSkudG8uZXEob2xkT25pb25QYXRoc1swXVsyXS5wdWJrZXlfZWQyNTUxOSk7XG4gICAgZXhwZWN0KGRyb3BTbm9kZUZyb21Tbm9kZVBvb2wuYXJnc1syXVswXSkudG8uZXEob2xkT25pb25QYXRoc1swXVswXS5wdWJrZXlfZWQyNTUxOSk7IC8vIGd1YXJkIG5vZGUgaXMgZHJvcHBlZCBsYXN0XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7O0FBRUEsa0JBQWlCO0FBQ2pCLFlBQXVCO0FBQ3ZCLG1CQUF5QjtBQUV6Qix3QkFBMEI7QUFDMUIsZUFBMEI7QUFFMUIsOEJBQTJCO0FBQzNCLG9CQUEyQjtBQUMzQixxQkFJTztBQUNQLDhCQUE0QjtBQUM1QixXQUFzQjtBQUN0Qix1QkFBaUM7QUFDakMsMkJBQTRCO0FBQzVCLG1CQUEyQztBQUUzQyxvQkFBSyxJQUFJLCtCQUFxQjtBQUM5QixvQkFBSyxP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
