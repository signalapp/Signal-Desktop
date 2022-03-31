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
var import_chai_as_promised = __toESM(require("chai-as-promised"));
var import_TaskWithTimeout = require("../../../../session/utils/TaskWithTimeout");
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { assert } = import_chai.default;
const taskName = "whatever";
describe("createTaskWithTimeout", () => {
  it("resolves when promise resolves", async () => {
    const task = /* @__PURE__ */ __name(() => Promise.resolve("hi!"), "task");
    const taskWithTimeout = (0, import_TaskWithTimeout.createTaskWithTimeout)(task, "task_123");
    await taskWithTimeout().then((result) => {
      assert.strictEqual(result, "hi!");
    });
  });
  it("flows error from promise back", async () => {
    const error = new Error("original");
    const task = /* @__PURE__ */ __name(() => Promise.reject(error), "task");
    const taskWithTimeout = (0, import_TaskWithTimeout.createTaskWithTimeout)(task, "task_123");
    await taskWithTimeout().catch((flowedError) => {
      assert.strictEqual(error, flowedError);
    });
  });
  it("rejects if promise takes too long (this one logs error to console)", async () => {
    let complete = false;
    const task = /* @__PURE__ */ __name(async () => new Promise((resolve) => {
      setTimeout(() => {
        complete = true;
        resolve(null);
      }, 3e3);
    }), "task");
    const taskWithTimeout = (0, import_TaskWithTimeout.createTaskWithTimeout)(task, taskName, 10);
    await taskWithTimeout().then(() => {
      throw new Error("it was not supposed to resolve!");
    }, () => {
      assert.strictEqual(complete, false);
    });
  });
  it("resolves if task returns something falsey", async () => {
    const task = /* @__PURE__ */ __name(() => {
    }, "task");
    const taskWithTimeout = (0, import_TaskWithTimeout.createTaskWithTimeout)(task, taskName);
    await taskWithTimeout();
  });
  it("resolves if task returns a non-promise", async () => {
    const task = /* @__PURE__ */ __name(() => "hi!", "task");
    const taskWithTimeout = (0, import_TaskWithTimeout.createTaskWithTimeout)(task, taskName);
    await taskWithTimeout().then((result) => {
      assert.strictEqual(result, "hi!");
    });
  });
  it("rejects if task throws (and does not log about taking too long)", async () => {
    const error = new Error("Task is throwing!");
    const task = /* @__PURE__ */ __name(() => {
      throw error;
    }, "task");
    const taskWithTimeout = (0, import_TaskWithTimeout.createTaskWithTimeout)(task, taskName, 10);
    await taskWithTimeout().then(() => {
      throw new Error("Overall task should reject!");
    }, (flowedError) => {
      assert.strictEqual(flowedError, error);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvdXRpbHMvVGFza1dpdGhUaW1lb3V0X3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHRzbGludDpkaXNhYmxlOiBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXMgbWF4LWZ1bmMtYm9keS1sZW5ndGggbm8tdW51c2VkLWV4cHJlc3Npb25cblxuaW1wb3J0IGNoYWkgZnJvbSAnY2hhaSc7XG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8tcmVxdWlyZS1pbXBvcnRzIG5vLXZhci1yZXF1aXJlc1xuaW1wb3J0IGNoYWlBc1Byb21pc2VkIGZyb20gJ2NoYWktYXMtcHJvbWlzZWQnO1xuaW1wb3J0IHsgY3JlYXRlVGFza1dpdGhUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi91dGlscy9UYXNrV2l0aFRpbWVvdXQnO1xuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQgYXMgYW55KTtcbmNoYWkuc2hvdWxkKCk7XG5cbmNvbnN0IHsgYXNzZXJ0IH0gPSBjaGFpO1xuXG5jb25zdCB0YXNrTmFtZSA9ICd3aGF0ZXZlcic7XG5cbmRlc2NyaWJlKCdjcmVhdGVUYXNrV2l0aFRpbWVvdXQnLCAoKSA9PiB7XG4gIGl0KCdyZXNvbHZlcyB3aGVuIHByb21pc2UgcmVzb2x2ZXMnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgdGFzayA9ICgpID0+IFByb21pc2UucmVzb2x2ZSgnaGkhJyk7XG4gICAgY29uc3QgdGFza1dpdGhUaW1lb3V0ID0gY3JlYXRlVGFza1dpdGhUaW1lb3V0KHRhc2ssICd0YXNrXzEyMycpO1xuXG4gICAgYXdhaXQgdGFza1dpdGhUaW1lb3V0KCkudGhlbigocmVzdWx0OiBhbnkpID0+IHtcbiAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICdoaSEnKTtcbiAgICB9KTtcbiAgfSk7XG4gIGl0KCdmbG93cyBlcnJvciBmcm9tIHByb21pc2UgYmFjaycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignb3JpZ2luYWwnKTtcbiAgICBjb25zdCB0YXNrID0gKCkgPT4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgIGNvbnN0IHRhc2tXaXRoVGltZW91dCA9IGNyZWF0ZVRhc2tXaXRoVGltZW91dCh0YXNrLCAndGFza18xMjMnKTtcblxuICAgIGF3YWl0IHRhc2tXaXRoVGltZW91dCgpLmNhdGNoKChmbG93ZWRFcnJvcjogYW55KSA9PiB7XG4gICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3IsIGZsb3dlZEVycm9yKTtcbiAgICB9KTtcbiAgfSk7XG4gIGl0KCdyZWplY3RzIGlmIHByb21pc2UgdGFrZXMgdG9vIGxvbmcgKHRoaXMgb25lIGxvZ3MgZXJyb3IgdG8gY29uc29sZSknLCBhc3luYyAoKSA9PiB7XG4gICAgbGV0IGNvbXBsZXRlID0gZmFsc2U7XG4gICAgY29uc3QgdGFzayA9IGFzeW5jICgpID0+XG4gICAgICBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICAgIHJlc29sdmUobnVsbCk7XG4gICAgICAgIH0sIDMwMDApO1xuICAgICAgfSk7XG4gICAgY29uc3QgdGFza1dpdGhUaW1lb3V0ID0gY3JlYXRlVGFza1dpdGhUaW1lb3V0KHRhc2ssIHRhc2tOYW1lLCAxMCk7XG5cbiAgICBhd2FpdCB0YXNrV2l0aFRpbWVvdXQoKS50aGVuKFxuICAgICAgKCkgPT4ge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2l0IHdhcyBub3Qgc3VwcG9zZWQgdG8gcmVzb2x2ZSEnKTtcbiAgICAgIH0sXG4gICAgICAoKSA9PiB7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0ZSwgZmFsc2UpO1xuICAgICAgfVxuICAgICk7XG4gIH0pO1xuICBpdCgncmVzb2x2ZXMgaWYgdGFzayByZXR1cm5zIHNvbWV0aGluZyBmYWxzZXknLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1lbXB0eVxuICAgIGNvbnN0IHRhc2sgPSAoKSA9PiB7fTtcbiAgICBjb25zdCB0YXNrV2l0aFRpbWVvdXQgPSBjcmVhdGVUYXNrV2l0aFRpbWVvdXQodGFzaywgdGFza05hbWUpO1xuICAgIGF3YWl0IHRhc2tXaXRoVGltZW91dCgpO1xuICB9KTtcbiAgaXQoJ3Jlc29sdmVzIGlmIHRhc2sgcmV0dXJucyBhIG5vbi1wcm9taXNlJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHRhc2sgPSAoKSA9PiAnaGkhJztcbiAgICBjb25zdCB0YXNrV2l0aFRpbWVvdXQgPSBjcmVhdGVUYXNrV2l0aFRpbWVvdXQodGFzaywgdGFza05hbWUpO1xuICAgIGF3YWl0IHRhc2tXaXRoVGltZW91dCgpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnaGkhJyk7XG4gICAgfSk7XG4gIH0pO1xuICBpdCgncmVqZWN0cyBpZiB0YXNrIHRocm93cyAoYW5kIGRvZXMgbm90IGxvZyBhYm91dCB0YWtpbmcgdG9vIGxvbmcpJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdUYXNrIGlzIHRocm93aW5nIScpO1xuICAgIGNvbnN0IHRhc2sgPSAoKSA9PiB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9O1xuICAgIGNvbnN0IHRhc2tXaXRoVGltZW91dCA9IGNyZWF0ZVRhc2tXaXRoVGltZW91dCh0YXNrLCB0YXNrTmFtZSwgMTApO1xuICAgIGF3YWl0IHRhc2tXaXRoVGltZW91dCgpLnRoZW4oXG4gICAgICAoKSA9PiB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT3ZlcmFsbCB0YXNrIHNob3VsZCByZWplY3QhJyk7XG4gICAgICB9LFxuICAgICAgKGZsb3dlZEVycm9yOiBhbnkpID0+IHtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGZsb3dlZEVycm9yLCBlcnJvcik7XG4gICAgICB9XG4gICAgKTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxrQkFBaUI7QUFHakIsOEJBQTJCO0FBQzNCLDZCQUFzQztBQUN0QyxvQkFBSyxJQUFJLCtCQUFxQjtBQUM5QixvQkFBSyxPQUFPO0FBRVosTUFBTSxFQUFFLFdBQVc7QUFFbkIsTUFBTSxXQUFXO0FBRWpCLFNBQVMseUJBQXlCLE1BQU07QUFDdEMsS0FBRyxrQ0FBa0MsWUFBWTtBQUMvQyxVQUFNLE9BQU8sNkJBQU0sUUFBUSxRQUFRLEtBQUssR0FBM0I7QUFDYixVQUFNLGtCQUFrQixrREFBc0IsTUFBTSxVQUFVO0FBRTlELFVBQU0sZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLFdBQWdCO0FBQzVDLGFBQU8sWUFBWSxRQUFRLEtBQUs7QUFBQSxJQUNsQyxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBQ0QsS0FBRyxpQ0FBaUMsWUFBWTtBQUM5QyxVQUFNLFFBQVEsSUFBSSxNQUFNLFVBQVU7QUFDbEMsVUFBTSxPQUFPLDZCQUFNLFFBQVEsT0FBTyxLQUFLLEdBQTFCO0FBQ2IsVUFBTSxrQkFBa0Isa0RBQXNCLE1BQU0sVUFBVTtBQUU5RCxVQUFNLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxnQkFBcUI7QUFDbEQsYUFBTyxZQUFZLE9BQU8sV0FBVztBQUFBLElBQ3ZDLENBQUM7QUFBQSxFQUNILENBQUM7QUFDRCxLQUFHLHNFQUFzRSxZQUFZO0FBQ25GLFFBQUksV0FBVztBQUNmLFVBQU0sT0FBTyxtQ0FDWCxJQUFJLFFBQVEsYUFBVztBQUNyQixpQkFBVyxNQUFNO0FBQ2YsbUJBQVc7QUFDWCxnQkFBUSxJQUFJO0FBQUEsTUFDZCxHQUFHLEdBQUk7QUFBQSxJQUNULENBQUMsR0FOVTtBQU9iLFVBQU0sa0JBQWtCLGtEQUFzQixNQUFNLFVBQVUsRUFBRTtBQUVoRSxVQUFNLGdCQUFnQixFQUFFLEtBQ3RCLE1BQU07QUFDSixZQUFNLElBQUksTUFBTSxpQ0FBaUM7QUFBQSxJQUNuRCxHQUNBLE1BQU07QUFDSixhQUFPLFlBQVksVUFBVSxLQUFLO0FBQUEsSUFDcEMsQ0FDRjtBQUFBLEVBQ0YsQ0FBQztBQUNELEtBQUcsNkNBQTZDLFlBQVk7QUFFMUQsVUFBTSxPQUFPLDZCQUFNO0FBQUEsSUFBQyxHQUFQO0FBQ2IsVUFBTSxrQkFBa0Isa0RBQXNCLE1BQU0sUUFBUTtBQUM1RCxVQUFNLGdCQUFnQjtBQUFBLEVBQ3hCLENBQUM7QUFDRCxLQUFHLDBDQUEwQyxZQUFZO0FBQ3ZELFVBQU0sT0FBTyw2QkFBTSxPQUFOO0FBQ2IsVUFBTSxrQkFBa0Isa0RBQXNCLE1BQU0sUUFBUTtBQUM1RCxVQUFNLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxXQUFnQjtBQUM1QyxhQUFPLFlBQVksUUFBUSxLQUFLO0FBQUEsSUFDbEMsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUNELEtBQUcsbUVBQW1FLFlBQVk7QUFDaEYsVUFBTSxRQUFRLElBQUksTUFBTSxtQkFBbUI7QUFDM0MsVUFBTSxPQUFPLDZCQUFNO0FBQ2pCLFlBQU07QUFBQSxJQUNSLEdBRmE7QUFHYixVQUFNLGtCQUFrQixrREFBc0IsTUFBTSxVQUFVLEVBQUU7QUFDaEUsVUFBTSxnQkFBZ0IsRUFBRSxLQUN0QixNQUFNO0FBQ0osWUFBTSxJQUFJLE1BQU0sNkJBQTZCO0FBQUEsSUFDL0MsR0FDQSxDQUFDLGdCQUFxQjtBQUNwQixhQUFPLFlBQVksYUFBYSxLQUFLO0FBQUEsSUFDdkMsQ0FDRjtBQUFBLEVBQ0YsQ0FBQztBQUNILENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
