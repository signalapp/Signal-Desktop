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
var sinon = __toESM(require("sinon"));
var import_blockedNumberController = require("../../util/blockedNumberController");
var import_test_utils = require("../test-utils");
var import_utils = require("../../session/utils");
describe("BlockedNumberController", () => {
  const sandbox = sinon.createSandbox();
  let memoryDB;
  beforeEach(() => {
    memoryDB = {};
    import_test_utils.TestUtils.stubData("createOrUpdateItem").callsFake((data) => {
      memoryDB[data.id] = data.value;
    });
    import_test_utils.TestUtils.stubData("getItemById").callsFake((id) => {
      if (!memoryDB[id]) {
        return void 0;
      }
      const value = memoryDB[id];
      return {
        id,
        value
      };
    });
    import_blockedNumberController.BlockedNumberController.reset();
  });
  afterEach(() => {
    sandbox.restore();
    import_test_utils.TestUtils.restoreStubs();
  });
  describe("load", () => {
    it("should load data from the database", async () => {
      const normal = import_test_utils.TestUtils.generateFakePubKey();
      const group = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [normal.key];
      memoryDB["blocked-groups"] = [group.key];
      await import_blockedNumberController.BlockedNumberController.load();
      const blockedNumbers = import_blockedNumberController.BlockedNumberController.getBlockedNumbers();
      const blockedGroups = import_blockedNumberController.BlockedNumberController.getBlockedGroups();
      (0, import_chai.expect)(blockedNumbers).to.have.lengthOf(1);
      (0, import_chai.expect)(blockedNumbers).to.include(normal.key);
      (0, import_chai.expect)(blockedGroups).to.have.lengthOf(1);
      (0, import_chai.expect)(blockedGroups).to.include(group.key);
    });
    it("should return empty if nothing in the db exists", async () => {
      await import_blockedNumberController.BlockedNumberController.load();
      const blockedNumbers = import_blockedNumberController.BlockedNumberController.getBlockedNumbers();
      const blockedGroups = import_blockedNumberController.BlockedNumberController.getBlockedGroups();
      (0, import_chai.expect)(blockedNumbers).to.be.empty;
      (0, import_chai.expect)(blockedGroups).to.be.empty;
    });
  });
  describe("block", () => {
    it("should block the user", async () => {
      const other = import_test_utils.TestUtils.generateFakePubKey();
      await import_blockedNumberController.BlockedNumberController.block(other);
      const blockedNumbers = import_blockedNumberController.BlockedNumberController.getBlockedNumbers();
      (0, import_chai.expect)(blockedNumbers).to.have.lengthOf(1);
      (0, import_chai.expect)(blockedNumbers).to.include(other.key);
      (0, import_chai.expect)(memoryDB.blocked).to.include(other.key);
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.getBlockedGroups()).to.be.empty;
    });
  });
  describe("unblock", () => {
    it("should unblock the user", async () => {
      const primary = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [primary.key];
      await import_blockedNumberController.BlockedNumberController.unblock(primary);
      const blockedNumbers = import_blockedNumberController.BlockedNumberController.getBlockedNumbers();
      (0, import_chai.expect)(blockedNumbers).to.be.empty;
      (0, import_chai.expect)(memoryDB.blocked).to.be.empty;
    });
    it("should only unblock if a device was blocked", async () => {
      const pubKey = import_test_utils.TestUtils.generateFakePubKey();
      const another = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key, another.key];
      await import_blockedNumberController.BlockedNumberController.unblock(pubKey);
      const blockedNumbers = import_blockedNumberController.BlockedNumberController.getBlockedNumbers();
      (0, import_chai.expect)(blockedNumbers).to.have.lengthOf(1);
      (0, import_chai.expect)(blockedNumbers).to.include(another.key);
      (0, import_chai.expect)(memoryDB.blocked).to.have.lengthOf(1);
      (0, import_chai.expect)(memoryDB.blocked).to.include(another.key);
    });
  });
  describe("blockGroup", () => {
    it("should block a group", async () => {
      const group = import_test_utils.TestUtils.generateFakePubKey();
      await import_blockedNumberController.BlockedNumberController.blockGroup(group);
      const blockedGroups = import_blockedNumberController.BlockedNumberController.getBlockedGroups();
      (0, import_chai.expect)(blockedGroups).to.have.lengthOf(1);
      (0, import_chai.expect)(blockedGroups).to.include(group.key);
      (0, import_chai.expect)(memoryDB["blocked-groups"]).to.have.lengthOf(1);
      (0, import_chai.expect)(memoryDB["blocked-groups"]).to.include(group.key);
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.getBlockedNumbers()).to.be.empty;
    });
  });
  describe("unblockGroup", () => {
    it("should unblock a group", async () => {
      const group = import_test_utils.TestUtils.generateFakePubKey();
      const another = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB["blocked-groups"] = [group.key, another.key];
      await import_blockedNumberController.BlockedNumberController.unblockGroup(group);
      const blockedGroups = import_blockedNumberController.BlockedNumberController.getBlockedGroups();
      (0, import_chai.expect)(blockedGroups).to.have.lengthOf(1);
      (0, import_chai.expect)(blockedGroups).to.include(another.key);
      (0, import_chai.expect)(memoryDB["blocked-groups"]).to.have.lengthOf(1);
      (0, import_chai.expect)(memoryDB["blocked-groups"]).to.include(another.key);
    });
  });
  describe("isBlocked", () => {
    it("should return true if number is blocked", async () => {
      const pubKey = import_test_utils.TestUtils.generateFakePubKey();
      const groupPubKey = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key];
      memoryDB["blocked-groups"] = [groupPubKey.key];
      await import_blockedNumberController.BlockedNumberController.load();
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.isBlocked(pubKey.key)).to.equal(true, "Expected isBlocked to return true for user pubkey");
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.isBlocked(groupPubKey.key)).to.equal(false, "Expected isBlocked to return false for a group pubkey");
    });
    it("should return false if number is not blocked", async () => {
      const pubKey = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [];
      await import_blockedNumberController.BlockedNumberController.load();
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.isBlocked(pubKey.key)).to.equal(false, "Expected isBlocked to return false");
    });
  });
  describe("isBlockedAsync", () => {
    let ourDevice;
    beforeEach(() => {
      ourDevice = import_test_utils.TestUtils.generateFakePubKey();
      sandbox.stub(import_utils.UserUtils, "getOurPubKeyStrFromCache").returns(ourDevice.key);
    });
    it("should return false for our device", async () => {
      const isBlocked = await import_blockedNumberController.BlockedNumberController.isBlockedAsync(ourDevice);
      (0, import_chai.expect)(isBlocked).to.equal(false, "Expected our device to return false");
    });
    it("should return true if the device is blocked", async () => {
      const other = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [other.key];
      const isBlocked = await import_blockedNumberController.BlockedNumberController.isBlockedAsync(other);
      (0, import_chai.expect)(isBlocked).to.equal(true, "Expected isBlockedAsync to return true.");
    });
    it("should return false if device is not blocked", async () => {
      const other = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [];
      const isBlocked = await import_blockedNumberController.BlockedNumberController.isBlockedAsync(other);
      (0, import_chai.expect)(isBlocked).to.equal(false, "Expected isBlockedAsync to return false.");
    });
  });
  describe("isGroupBlocked", () => {
    it("should return true if group is blocked", async () => {
      const pubKey = import_test_utils.TestUtils.generateFakePubKey();
      const groupPubKey = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key];
      memoryDB["blocked-groups"] = [groupPubKey.key];
      await import_blockedNumberController.BlockedNumberController.load();
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.isGroupBlocked(pubKey.key)).to.equal(false, "Expected isGroupBlocked to return false for user pubkey");
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.isGroupBlocked(groupPubKey.key)).to.equal(true, "Expected isGroupBlocked to return true for a group pubkey");
    });
    it("should return false if group is not blocked", async () => {
      const groupPubKey = import_test_utils.TestUtils.generateFakePubKey();
      memoryDB["blocked-groups"] = [];
      await import_blockedNumberController.BlockedNumberController.load();
      (0, import_chai.expect)(import_blockedNumberController.BlockedNumberController.isGroupBlocked(groupPubKey.key)).to.equal(false, "Expected isGroupBlocked to return false");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC91dGlsL2Jsb2NrZWROdW1iZXJDb250cm9sbGVyX3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHRzbGludDpkaXNhYmxlOiBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXMgbWF4LWZ1bmMtYm9keS1sZW5ndGggbm8tdW51c2VkLWV4cHJlc3Npb25cblxuaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBCbG9ja2VkTnVtYmVyQ29udHJvbGxlciB9IGZyb20gJy4uLy4uL3V0aWwvYmxvY2tlZE51bWJlckNvbnRyb2xsZXInO1xuaW1wb3J0IHsgVGVzdFV0aWxzIH0gZnJvbSAnLi4vdGVzdC11dGlscyc7XG5pbXBvcnQgeyBQdWJLZXkgfSBmcm9tICcuLi8uLi9zZXNzaW9uL3R5cGVzJztcbmltcG9ydCB7IFVzZXJVdGlscyB9IGZyb20gJy4uLy4uL3Nlc3Npb24vdXRpbHMnO1xuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1mdW5jLWJvZHktbGVuZ3RoXG5kZXNjcmliZSgnQmxvY2tlZE51bWJlckNvbnRyb2xsZXInLCAoKSA9PiB7XG4gIGNvbnN0IHNhbmRib3ggPSBzaW5vbi5jcmVhdGVTYW5kYm94KCk7XG4gIGxldCBtZW1vcnlEQjogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgbWVtb3J5REIgPSB7fTtcblxuICAgIFRlc3RVdGlscy5zdHViRGF0YSgnY3JlYXRlT3JVcGRhdGVJdGVtJykuY2FsbHNGYWtlKGRhdGEgPT4ge1xuICAgICAgbWVtb3J5REJbZGF0YS5pZF0gPSBkYXRhLnZhbHVlO1xuICAgIH0pO1xuXG4gICAgVGVzdFV0aWxzLnN0dWJEYXRhKCdnZXRJdGVtQnlJZCcpLmNhbGxzRmFrZShpZCA9PiB7XG4gICAgICBpZiAoIW1lbW9yeURCW2lkXSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgY29uc3QgdmFsdWUgPSBtZW1vcnlEQltpZF07XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpZCxcbiAgICAgICAgdmFsdWUsXG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIucmVzZXQoKTtcbiAgfSk7XG5cbiAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICBUZXN0VXRpbHMucmVzdG9yZVN0dWJzKCk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdsb2FkJywgKCkgPT4ge1xuICAgIGl0KCdzaG91bGQgbG9hZCBkYXRhIGZyb20gdGhlIGRhdGFiYXNlJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3Qgbm9ybWFsID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgY29uc3QgZ3JvdXAgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG4gICAgICBtZW1vcnlEQi5ibG9ja2VkID0gW25vcm1hbC5rZXldO1xuICAgICAgbWVtb3J5REJbJ2Jsb2NrZWQtZ3JvdXBzJ10gPSBbZ3JvdXAua2V5XTtcbiAgICAgIGF3YWl0IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmxvYWQoKTtcblxuICAgICAgY29uc3QgYmxvY2tlZE51bWJlcnMgPSBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5nZXRCbG9ja2VkTnVtYmVycygpO1xuICAgICAgY29uc3QgYmxvY2tlZEdyb3VwcyA9IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmdldEJsb2NrZWRHcm91cHMoKTtcblxuICAgICAgZXhwZWN0KGJsb2NrZWROdW1iZXJzKS50by5oYXZlLmxlbmd0aE9mKDEpO1xuICAgICAgZXhwZWN0KGJsb2NrZWROdW1iZXJzKS50by5pbmNsdWRlKG5vcm1hbC5rZXkpO1xuICAgICAgZXhwZWN0KGJsb2NrZWRHcm91cHMpLnRvLmhhdmUubGVuZ3RoT2YoMSk7XG4gICAgICBleHBlY3QoYmxvY2tlZEdyb3VwcykudG8uaW5jbHVkZShncm91cC5rZXkpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gZW1wdHkgaWYgbm90aGluZyBpbiB0aGUgZGIgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIubG9hZCgpO1xuICAgICAgY29uc3QgYmxvY2tlZE51bWJlcnMgPSBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5nZXRCbG9ja2VkTnVtYmVycygpO1xuICAgICAgY29uc3QgYmxvY2tlZEdyb3VwcyA9IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmdldEJsb2NrZWRHcm91cHMoKTtcblxuICAgICAgZXhwZWN0KGJsb2NrZWROdW1iZXJzKS50by5iZS5lbXB0eTtcbiAgICAgIGV4cGVjdChibG9ja2VkR3JvdXBzKS50by5iZS5lbXB0eTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ2Jsb2NrJywgKCkgPT4ge1xuICAgIGl0KCdzaG91bGQgYmxvY2sgdGhlIHVzZXInLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBvdGhlciA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcblxuICAgICAgYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIuYmxvY2sob3RoZXIpO1xuXG4gICAgICBjb25zdCBibG9ja2VkTnVtYmVycyA9IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmdldEJsb2NrZWROdW1iZXJzKCk7XG4gICAgICBleHBlY3QoYmxvY2tlZE51bWJlcnMpLnRvLmhhdmUubGVuZ3RoT2YoMSk7XG4gICAgICBleHBlY3QoYmxvY2tlZE51bWJlcnMpLnRvLmluY2x1ZGUob3RoZXIua2V5KTtcbiAgICAgIGV4cGVjdChtZW1vcnlEQi5ibG9ja2VkKS50by5pbmNsdWRlKG90aGVyLmtleSk7XG4gICAgICBleHBlY3QoQmxvY2tlZE51bWJlckNvbnRyb2xsZXIuZ2V0QmxvY2tlZEdyb3VwcygpKS50by5iZS5lbXB0eTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3VuYmxvY2snLCAoKSA9PiB7XG4gICAgaXQoJ3Nob3VsZCB1bmJsb2NrIHRoZSB1c2VyJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcHJpbWFyeSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgIG1lbW9yeURCLmJsb2NrZWQgPSBbcHJpbWFyeS5rZXldO1xuXG4gICAgICBhd2FpdCBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci51bmJsb2NrKHByaW1hcnkpO1xuXG4gICAgICBjb25zdCBibG9ja2VkTnVtYmVycyA9IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmdldEJsb2NrZWROdW1iZXJzKCk7XG4gICAgICBleHBlY3QoYmxvY2tlZE51bWJlcnMpLnRvLmJlLmVtcHR5O1xuICAgICAgZXhwZWN0KG1lbW9yeURCLmJsb2NrZWQpLnRvLmJlLmVtcHR5O1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCBvbmx5IHVuYmxvY2sgaWYgYSBkZXZpY2Ugd2FzIGJsb2NrZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwdWJLZXkgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG4gICAgICBjb25zdCBhbm90aGVyID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgbWVtb3J5REIuYmxvY2tlZCA9IFtwdWJLZXkua2V5LCBhbm90aGVyLmtleV07XG5cbiAgICAgIGF3YWl0IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLnVuYmxvY2socHViS2V5KTtcblxuICAgICAgY29uc3QgYmxvY2tlZE51bWJlcnMgPSBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5nZXRCbG9ja2VkTnVtYmVycygpO1xuICAgICAgZXhwZWN0KGJsb2NrZWROdW1iZXJzKS50by5oYXZlLmxlbmd0aE9mKDEpO1xuICAgICAgZXhwZWN0KGJsb2NrZWROdW1iZXJzKS50by5pbmNsdWRlKGFub3RoZXIua2V5KTtcbiAgICAgIGV4cGVjdChtZW1vcnlEQi5ibG9ja2VkKS50by5oYXZlLmxlbmd0aE9mKDEpO1xuICAgICAgZXhwZWN0KG1lbW9yeURCLmJsb2NrZWQpLnRvLmluY2x1ZGUoYW5vdGhlci5rZXkpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnYmxvY2tHcm91cCcsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIGJsb2NrIGEgZ3JvdXAnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBncm91cCA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcblxuICAgICAgYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIuYmxvY2tHcm91cChncm91cCk7XG5cbiAgICAgIGNvbnN0IGJsb2NrZWRHcm91cHMgPSBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5nZXRCbG9ja2VkR3JvdXBzKCk7XG4gICAgICBleHBlY3QoYmxvY2tlZEdyb3VwcykudG8uaGF2ZS5sZW5ndGhPZigxKTtcbiAgICAgIGV4cGVjdChibG9ja2VkR3JvdXBzKS50by5pbmNsdWRlKGdyb3VwLmtleSk7XG4gICAgICBleHBlY3QobWVtb3J5REJbJ2Jsb2NrZWQtZ3JvdXBzJ10pLnRvLmhhdmUubGVuZ3RoT2YoMSk7XG4gICAgICBleHBlY3QobWVtb3J5REJbJ2Jsb2NrZWQtZ3JvdXBzJ10pLnRvLmluY2x1ZGUoZ3JvdXAua2V5KTtcbiAgICAgIGV4cGVjdChCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5nZXRCbG9ja2VkTnVtYmVycygpKS50by5iZS5lbXB0eTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3VuYmxvY2tHcm91cCcsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHVuYmxvY2sgYSBncm91cCcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGdyb3VwID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgY29uc3QgYW5vdGhlciA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgIG1lbW9yeURCWydibG9ja2VkLWdyb3VwcyddID0gW2dyb3VwLmtleSwgYW5vdGhlci5rZXldO1xuXG4gICAgICBhd2FpdCBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci51bmJsb2NrR3JvdXAoZ3JvdXApO1xuXG4gICAgICBjb25zdCBibG9ja2VkR3JvdXBzID0gQmxvY2tlZE51bWJlckNvbnRyb2xsZXIuZ2V0QmxvY2tlZEdyb3VwcygpO1xuICAgICAgZXhwZWN0KGJsb2NrZWRHcm91cHMpLnRvLmhhdmUubGVuZ3RoT2YoMSk7XG4gICAgICBleHBlY3QoYmxvY2tlZEdyb3VwcykudG8uaW5jbHVkZShhbm90aGVyLmtleSk7XG4gICAgICBleHBlY3QobWVtb3J5REJbJ2Jsb2NrZWQtZ3JvdXBzJ10pLnRvLmhhdmUubGVuZ3RoT2YoMSk7XG4gICAgICBleHBlY3QobWVtb3J5REJbJ2Jsb2NrZWQtZ3JvdXBzJ10pLnRvLmluY2x1ZGUoYW5vdGhlci5rZXkpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnaXNCbG9ja2VkJywgKCkgPT4ge1xuICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUgaWYgbnVtYmVyIGlzIGJsb2NrZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwdWJLZXkgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG4gICAgICBjb25zdCBncm91cFB1YktleSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgIG1lbW9yeURCLmJsb2NrZWQgPSBbcHViS2V5LmtleV07XG4gICAgICBtZW1vcnlEQlsnYmxvY2tlZC1ncm91cHMnXSA9IFtncm91cFB1YktleS5rZXldO1xuICAgICAgYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIubG9hZCgpO1xuICAgICAgZXhwZWN0KEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmlzQmxvY2tlZChwdWJLZXkua2V5KSkudG8uZXF1YWwoXG4gICAgICAgIHRydWUsXG4gICAgICAgICdFeHBlY3RlZCBpc0Jsb2NrZWQgdG8gcmV0dXJuIHRydWUgZm9yIHVzZXIgcHVia2V5J1xuICAgICAgKTtcbiAgICAgIGV4cGVjdChCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5pc0Jsb2NrZWQoZ3JvdXBQdWJLZXkua2V5KSkudG8uZXF1YWwoXG4gICAgICAgIGZhbHNlLFxuICAgICAgICAnRXhwZWN0ZWQgaXNCbG9ja2VkIHRvIHJldHVybiBmYWxzZSBmb3IgYSBncm91cCBwdWJrZXknXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gZmFsc2UgaWYgbnVtYmVyIGlzIG5vdCBibG9ja2VkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcHViS2V5ID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgbWVtb3J5REIuYmxvY2tlZCA9IFtdO1xuICAgICAgYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIubG9hZCgpO1xuICAgICAgZXhwZWN0KEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmlzQmxvY2tlZChwdWJLZXkua2V5KSkudG8uZXF1YWwoXG4gICAgICAgIGZhbHNlLFxuICAgICAgICAnRXhwZWN0ZWQgaXNCbG9ja2VkIHRvIHJldHVybiBmYWxzZSdcbiAgICAgICk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdpc0Jsb2NrZWRBc3luYycsICgpID0+IHtcbiAgICBsZXQgb3VyRGV2aWNlOiBQdWJLZXk7XG4gICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICBvdXJEZXZpY2UgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG4gICAgICBzYW5kYm94LnN0dWIoVXNlclV0aWxzLCAnZ2V0T3VyUHViS2V5U3RyRnJvbUNhY2hlJykucmV0dXJucyhvdXJEZXZpY2Uua2V5KTtcbiAgICB9KTtcbiAgICBpdCgnc2hvdWxkIHJldHVybiBmYWxzZSBmb3Igb3VyIGRldmljZScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IGF3YWl0IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmlzQmxvY2tlZEFzeW5jKG91ckRldmljZSk7XG4gICAgICBleHBlY3QoaXNCbG9ja2VkKS50by5lcXVhbChmYWxzZSwgJ0V4cGVjdGVkIG91ciBkZXZpY2UgdG8gcmV0dXJuIGZhbHNlJyk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiB0cnVlIGlmIHRoZSBkZXZpY2UgaXMgYmxvY2tlZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IG90aGVyID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgbWVtb3J5REIuYmxvY2tlZCA9IFtvdGhlci5rZXldO1xuXG4gICAgICBjb25zdCBpc0Jsb2NrZWQgPSBhd2FpdCBCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5pc0Jsb2NrZWRBc3luYyhvdGhlcik7XG4gICAgICBleHBlY3QoaXNCbG9ja2VkKS50by5lcXVhbCh0cnVlLCAnRXhwZWN0ZWQgaXNCbG9ja2VkQXN5bmMgdG8gcmV0dXJuIHRydWUuJyk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBmYWxzZSBpZiBkZXZpY2UgaXMgbm90IGJsb2NrZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBvdGhlciA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgIG1lbW9yeURCLmJsb2NrZWQgPSBbXTtcblxuICAgICAgY29uc3QgaXNCbG9ja2VkID0gYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIuaXNCbG9ja2VkQXN5bmMob3RoZXIpO1xuICAgICAgZXhwZWN0KGlzQmxvY2tlZCkudG8uZXF1YWwoZmFsc2UsICdFeHBlY3RlZCBpc0Jsb2NrZWRBc3luYyB0byByZXR1cm4gZmFsc2UuJyk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdpc0dyb3VwQmxvY2tlZCcsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHJldHVybiB0cnVlIGlmIGdyb3VwIGlzIGJsb2NrZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwdWJLZXkgPSBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCk7XG4gICAgICBjb25zdCBncm91cFB1YktleSA9IFRlc3RVdGlscy5nZW5lcmF0ZUZha2VQdWJLZXkoKTtcbiAgICAgIG1lbW9yeURCLmJsb2NrZWQgPSBbcHViS2V5LmtleV07XG4gICAgICBtZW1vcnlEQlsnYmxvY2tlZC1ncm91cHMnXSA9IFtncm91cFB1YktleS5rZXldO1xuICAgICAgYXdhaXQgQmxvY2tlZE51bWJlckNvbnRyb2xsZXIubG9hZCgpO1xuICAgICAgZXhwZWN0KEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmlzR3JvdXBCbG9ja2VkKHB1YktleS5rZXkpKS50by5lcXVhbChcbiAgICAgICAgZmFsc2UsXG4gICAgICAgICdFeHBlY3RlZCBpc0dyb3VwQmxvY2tlZCB0byByZXR1cm4gZmFsc2UgZm9yIHVzZXIgcHVia2V5J1xuICAgICAgKTtcbiAgICAgIGV4cGVjdChCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5pc0dyb3VwQmxvY2tlZChncm91cFB1YktleS5rZXkpKS50by5lcXVhbChcbiAgICAgICAgdHJ1ZSxcbiAgICAgICAgJ0V4cGVjdGVkIGlzR3JvdXBCbG9ja2VkIHRvIHJldHVybiB0cnVlIGZvciBhIGdyb3VwIHB1YmtleSdcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBmYWxzZSBpZiBncm91cCBpcyBub3QgYmxvY2tlZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGdyb3VwUHViS2V5ID0gVGVzdFV0aWxzLmdlbmVyYXRlRmFrZVB1YktleSgpO1xuICAgICAgbWVtb3J5REJbJ2Jsb2NrZWQtZ3JvdXBzJ10gPSBbXTtcbiAgICAgIGF3YWl0IEJsb2NrZWROdW1iZXJDb250cm9sbGVyLmxvYWQoKTtcbiAgICAgIGV4cGVjdChCbG9ja2VkTnVtYmVyQ29udHJvbGxlci5pc0dyb3VwQmxvY2tlZChncm91cFB1YktleS5rZXkpKS50by5lcXVhbChcbiAgICAgICAgZmFsc2UsXG4gICAgICAgICdFeHBlY3RlZCBpc0dyb3VwQmxvY2tlZCB0byByZXR1cm4gZmFsc2UnXG4gICAgICApO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7O0FBRUEsa0JBQXVCO0FBQ3ZCLFlBQXVCO0FBQ3ZCLHFDQUF3QztBQUN4Qyx3QkFBMEI7QUFFMUIsbUJBQTBCO0FBRzFCLFNBQVMsMkJBQTJCLE1BQU07QUFDeEMsUUFBTSxVQUFVLE1BQU0sY0FBYztBQUNwQyxNQUFJO0FBQ0osYUFBVyxNQUFNO0FBQ2YsZUFBVyxDQUFDO0FBRVosZ0NBQVUsU0FBUyxvQkFBb0IsRUFBRSxVQUFVLFVBQVE7QUFDekQsZUFBUyxLQUFLLE1BQU0sS0FBSztBQUFBLElBQzNCLENBQUM7QUFFRCxnQ0FBVSxTQUFTLGFBQWEsRUFBRSxVQUFVLFFBQU07QUFDaEQsVUFBSSxDQUFDLFNBQVMsS0FBSztBQUNqQixlQUFPO0FBQUEsTUFDVDtBQUNBLFlBQU0sUUFBUSxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFFRCwyREFBd0IsTUFBTTtBQUFBLEVBQ2hDLENBQUM7QUFFRCxZQUFVLE1BQU07QUFDZCxZQUFRLFFBQVE7QUFDaEIsZ0NBQVUsYUFBYTtBQUFBLEVBQ3pCLENBQUM7QUFFRCxXQUFTLFFBQVEsTUFBTTtBQUNyQixPQUFHLHNDQUFzQyxZQUFZO0FBQ25ELFlBQU0sU0FBUyw0QkFBVSxtQkFBbUI7QUFDNUMsWUFBTSxRQUFRLDRCQUFVLG1CQUFtQjtBQUMzQyxlQUFTLFVBQVUsQ0FBQyxPQUFPLEdBQUc7QUFDOUIsZUFBUyxvQkFBb0IsQ0FBQyxNQUFNLEdBQUc7QUFDdkMsWUFBTSx1REFBd0IsS0FBSztBQUVuQyxZQUFNLGlC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
