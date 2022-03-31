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
var import_utils = require("../../../test-utils/utils");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
import_chai.default.use(import_chai_as_promised.default);
describe("SyncUtils", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
    (0, import_utils.restoreStubs)();
  });
  describe("syncConfigurationIfNeeded", () => {
    it("sync if last sync undefined", () => {
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvdXRpbHMvU3luY1V0aWxzX3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHRzbGludDpkaXNhYmxlOiBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCBjaGFpIGZyb20gJ2NoYWknO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgcmVzdG9yZVN0dWJzIH0gZnJvbSAnLi4vLi4vLi4vdGVzdC11dGlscy91dGlscyc7XG5cbmltcG9ydCBjaGFpQXNQcm9taXNlZCBmcm9tICdjaGFpLWFzLXByb21pc2VkJztcbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkIGFzIGFueSk7XG5cbmRlc2NyaWJlKCdTeW5jVXRpbHMnLCAoKSA9PiB7XG4gIGNvbnN0IHNhbmRib3ggPSBzaW5vbi5jcmVhdGVTYW5kYm94KCk7XG5cbiAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICByZXN0b3JlU3R1YnMoKTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3N5bmNDb25maWd1cmF0aW9uSWZOZWVkZWQnLCAoKSA9PiB7XG4gICAgaXQoJ3N5bmMgaWYgbGFzdCBzeW5jIHVuZGVmaW5lZCcsICgpID0+IHtcbiAgICAgIC8vIFRlc3RVdGlscy5zdHViRGF0YSgnZ2V0SXRlbUJ5SWQnKS5yZXNvbHZlcyh1bmRlZmluZWQpO1xuICAgICAgLy8gc2FuZGJveC5zdHViKENvbnZlcnNhdGlvbkNvbnRyb2xsZXIsICdnZXRDb252ZXJzYXRpb25zJykucmV0dXJucyhbXSk7XG4gICAgICAvLyBjb25zdCBnZXRDdXJyZW50Q29uZmlndXJhdGlvbk1lc3NhZ2VTcHkgPSBzYW5kYm94LnNweShNZXNzYWdlVXRpbHMsICdnZXRDdXJyZW50Q29uZmlndXJhdGlvbk1lc3NhZ2UnKTtcbiAgICAgIC8vIGF3YWl0IHN5bmNDb25maWd1cmF0aW9uSWZOZWVkZWQoKTtcbiAgICAgIC8vIGV4cGVjdChnZXRDdXJyZW50Q29uZmlndXJhdGlvbk1lc3NhZ2VTcHkuY2FsbENvdW50KS5lcXVhbCgxKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7OztBQUNBLGtCQUFpQjtBQUNqQixZQUF1QjtBQUN2QixtQkFBNkI7QUFFN0IsOEJBQTJCO0FBQzNCLG9CQUFLLElBQUksK0JBQXFCO0FBRTlCLFNBQVMsYUFBYSxNQUFNO0FBQzFCLFFBQU0sVUFBVSxNQUFNLGNBQWM7QUFFcEMsWUFBVSxNQUFNO0FBQ2QsWUFBUSxRQUFRO0FBQ2hCLG1DQUFhO0FBQUEsRUFDZixDQUFDO0FBRUQsV0FBUyw2QkFBNkIsTUFBTTtBQUMxQyxPQUFHLCtCQUErQixNQUFNO0FBQUEsSUFNeEMsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUNILENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
