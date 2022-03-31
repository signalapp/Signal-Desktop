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
var import_uuid = require("uuid");
var import_JobQueue = require("../../../../session/utils/JobQueue");
var import_test_utils = require("../../../test-utils");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
import_chai.default.use(import_chai_as_promised.default);
const { assert } = import_chai.default;
describe("JobQueue", () => {
  describe("has", () => {
    it("should return the correct value", async () => {
      const queue = new import_JobQueue.JobQueue();
      const id = "jobId";
      assert.isFalse(queue.has(id));
      const promise = queue.addWithId(id, async () => import_test_utils.TestUtils.timeout(30));
      assert.isTrue(queue.has(id));
      await promise;
      assert.isFalse(queue.has(id));
    });
  });
  describe("addWithId", () => {
    it("should run the jobs concurrently", async () => {
      const input = [
        [10, 10],
        [20, 8],
        [30, 2]
      ];
      const queue = new import_JobQueue.JobQueue();
      const mapper = /* @__PURE__ */ __name(async ([value, ms]) => queue.addWithId((0, import_uuid.v4)(), async () => {
        await import_test_utils.TestUtils.timeout(ms);
        return value;
      }), "mapper");
      const start = Date.now();
      await assert.eventually.deepEqual(Promise.all(input.map(mapper)), [10, 20, 30]);
      const timeTaken = Date.now() - start;
      assert.isAtLeast(timeTaken, 20, "Queue should take atleast 100ms to run.");
    });
    it("should return the result of the job", async () => {
      const queue = new import_JobQueue.JobQueue();
      const success = queue.addWithId((0, import_uuid.v4)(), async () => {
        await import_test_utils.TestUtils.timeout(10);
        return "success";
      });
      const failure = queue.addWithId((0, import_uuid.v4)(), async () => {
        await import_test_utils.TestUtils.timeout(10);
        throw new Error("failed");
      });
      await assert.eventually.equal(success, "success");
      await assert.isRejected(failure, /failed/);
    });
    it("should handle sync and async tasks", async () => {
      const queue = new import_JobQueue.JobQueue();
      const first = queue.addWithId((0, import_uuid.v4)(), () => "first");
      const second = queue.addWithId((0, import_uuid.v4)(), async () => {
        await import_test_utils.TestUtils.timeout(10);
        return "second";
      });
      const third = queue.addWithId((0, import_uuid.v4)(), () => "third");
      await assert.eventually.deepEqual(Promise.all([first, second, third]), [
        "first",
        "second",
        "third"
      ]);
    });
    it("should return the previous job if same id was passed", async () => {
      const queue = new import_JobQueue.JobQueue();
      const id = (0, import_uuid.v4)();
      const job = /* @__PURE__ */ __name(async () => {
        await import_test_utils.TestUtils.timeout(10);
        return "job1";
      }, "job");
      const promise = queue.addWithId(id, job);
      const otherPromise = queue.addWithId(id, () => "job2");
      await assert.eventually.equal(promise, "job1");
      await assert.eventually.equal(otherPromise, "job1");
    });
    it("should remove completed jobs", async () => {
      const queue = new import_JobQueue.JobQueue();
      const id = (0, import_uuid.v4)();
      const successfullJob = queue.addWithId(id, async () => import_test_utils.TestUtils.timeout(10));
      assert.isTrue(queue.has(id));
      await successfullJob;
      assert.isFalse(queue.has(id));
      const failJob = queue.addWithId(id, async () => {
        await import_test_utils.TestUtils.timeout(10);
        throw new Error("failed");
      });
      assert.isTrue(queue.has(id));
      await assert.isRejected(failJob, /failed/);
      assert.isFalse(queue.has(id));
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvdXRpbHMvSm9iUXVldWVfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gdHNsaW50OmRpc2FibGU6IG5vLWltcGxpY2l0LWRlcGVuZGVuY2llcyBtYXgtZnVuYy1ib2R5LWxlbmd0aCBuby11bnVzZWQtZXhwcmVzc2lvblxuXG5pbXBvcnQgY2hhaSBmcm9tICdjaGFpJztcbmltcG9ydCB7IHY0IGFzIHV1aWQgfSBmcm9tICd1dWlkJztcbmltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi91dGlscy9Kb2JRdWV1ZSc7XG5pbXBvcnQgeyBUZXN0VXRpbHMgfSBmcm9tICcuLi8uLi8uLi90ZXN0LXV0aWxzJztcblxuaW1wb3J0IGNoYWlBc1Byb21pc2VkIGZyb20gJ2NoYWktYXMtcHJvbWlzZWQnO1xuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQgYXMgYW55KTtcblxuY29uc3QgeyBhc3NlcnQgfSA9IGNoYWk7XG5cbmRlc2NyaWJlKCdKb2JRdWV1ZScsICgpID0+IHtcbiAgZGVzY3JpYmUoJ2hhcycsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHJldHVybiB0aGUgY29ycmVjdCB2YWx1ZScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXVlID0gbmV3IEpvYlF1ZXVlKCk7XG4gICAgICBjb25zdCBpZCA9ICdqb2JJZCc7XG5cbiAgICAgIGFzc2VydC5pc0ZhbHNlKHF1ZXVlLmhhcyhpZCkpO1xuICAgICAgY29uc3QgcHJvbWlzZSA9IHF1ZXVlLmFkZFdpdGhJZChpZCwgYXN5bmMgKCkgPT4gVGVzdFV0aWxzLnRpbWVvdXQoMzApKTtcbiAgICAgIGFzc2VydC5pc1RydWUocXVldWUuaGFzKGlkKSk7XG4gICAgICBhd2FpdCBwcm9taXNlO1xuICAgICAgYXNzZXJ0LmlzRmFsc2UocXVldWUuaGFzKGlkKSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdhZGRXaXRoSWQnLCAoKSA9PiB7XG4gICAgaXQoJ3Nob3VsZCBydW4gdGhlIGpvYnMgY29uY3VycmVudGx5JywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgaW5wdXQgPSBbXG4gICAgICAgIFsxMCwgMTBdLFxuICAgICAgICBbMjAsIDhdLFxuICAgICAgICBbMzAsIDJdLFxuICAgICAgXTtcbiAgICAgIGNvbnN0IHF1ZXVlID0gbmV3IEpvYlF1ZXVlKCk7XG4gICAgICBjb25zdCBtYXBwZXIgPSBhc3luYyAoW3ZhbHVlLCBtc106IEFycmF5PG51bWJlcj4pOiBQcm9taXNlPG51bWJlcj4gPT5cbiAgICAgICAgcXVldWUuYWRkV2l0aElkKHV1aWQoKSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IFRlc3RVdGlscy50aW1lb3V0KG1zKTtcblxuICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgIGF3YWl0IGFzc2VydC5ldmVudHVhbGx5LmRlZXBFcXVhbChQcm9taXNlLmFsbChpbnB1dC5tYXAobWFwcGVyKSksIFsxMCwgMjAsIDMwXSk7XG4gICAgICBjb25zdCB0aW1lVGFrZW4gPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG4gICAgICBhc3NlcnQuaXNBdExlYXN0KHRpbWVUYWtlbiwgMjAsICdRdWV1ZSBzaG91bGQgdGFrZSBhdGxlYXN0IDEwMG1zIHRvIHJ1bi4nKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhlIGpvYicsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXVlID0gbmV3IEpvYlF1ZXVlKCk7XG4gICAgICBjb25zdCBzdWNjZXNzID0gcXVldWUuYWRkV2l0aElkKHV1aWQoKSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBUZXN0VXRpbHMudGltZW91dCgxMCk7XG5cbiAgICAgICAgcmV0dXJuICdzdWNjZXNzJztcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZmFpbHVyZSA9IHF1ZXVlLmFkZFdpdGhJZCh1dWlkKCksIGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgVGVzdFV0aWxzLnRpbWVvdXQoMTApO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ZhaWxlZCcpO1xuICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IGFzc2VydC5ldmVudHVhbGx5LmVxdWFsKHN1Y2Nlc3MsICdzdWNjZXNzJyk7XG4gICAgICBhd2FpdCBhc3NlcnQuaXNSZWplY3RlZChmYWlsdXJlLCAvZmFpbGVkLyk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIGhhbmRsZSBzeW5jIGFuZCBhc3luYyB0YXNrcycsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXVlID0gbmV3IEpvYlF1ZXVlKCk7XG4gICAgICBjb25zdCBmaXJzdCA9IHF1ZXVlLmFkZFdpdGhJZCh1dWlkKCksICgpID0+ICdmaXJzdCcpO1xuICAgICAgY29uc3Qgc2Vjb25kID0gcXVldWUuYWRkV2l0aElkKHV1aWQoKSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBUZXN0VXRpbHMudGltZW91dCgxMCk7XG5cbiAgICAgICAgcmV0dXJuICdzZWNvbmQnO1xuICAgICAgfSk7XG4gICAgICBjb25zdCB0aGlyZCA9IHF1ZXVlLmFkZFdpdGhJZCh1dWlkKCksICgpID0+ICd0aGlyZCcpO1xuXG4gICAgICBhd2FpdCBhc3NlcnQuZXZlbnR1YWxseS5kZWVwRXF1YWwoUHJvbWlzZS5hbGwoW2ZpcnN0LCBzZWNvbmQsIHRoaXJkXSksIFtcbiAgICAgICAgJ2ZpcnN0JyxcbiAgICAgICAgJ3NlY29uZCcsXG4gICAgICAgICd0aGlyZCcsXG4gICAgICBdKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0dXJuIHRoZSBwcmV2aW91cyBqb2IgaWYgc2FtZSBpZCB3YXMgcGFzc2VkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcXVldWUgPSBuZXcgSm9iUXVldWUoKTtcbiAgICAgIGNvbnN0IGlkID0gdXVpZCgpO1xuICAgICAgY29uc3Qgam9iID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBUZXN0VXRpbHMudGltZW91dCgxMCk7XG5cbiAgICAgICAgcmV0dXJuICdqb2IxJztcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHByb21pc2UgPSBxdWV1ZS5hZGRXaXRoSWQoaWQsIGpvYik7XG4gICAgICBjb25zdCBvdGhlclByb21pc2UgPSBxdWV1ZS5hZGRXaXRoSWQoaWQsICgpID0+ICdqb2IyJyk7XG4gICAgICBhd2FpdCBhc3NlcnQuZXZlbnR1YWxseS5lcXVhbChwcm9taXNlLCAnam9iMScpO1xuICAgICAgYXdhaXQgYXNzZXJ0LmV2ZW50dWFsbHkuZXF1YWwob3RoZXJQcm9taXNlLCAnam9iMScpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZW1vdmUgY29tcGxldGVkIGpvYnMnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBxdWV1ZSA9IG5ldyBKb2JRdWV1ZSgpO1xuICAgICAgY29uc3QgaWQgPSB1dWlkKCk7XG5cbiAgICAgIGNvbnN0IHN1Y2Nlc3NmdWxsSm9iID0gcXVldWUuYWRkV2l0aElkKGlkLCBhc3luYyAoKSA9PiBUZXN0VXRpbHMudGltZW91dCgxMCkpO1xuICAgICAgYXNzZXJ0LmlzVHJ1ZShxdWV1ZS5oYXMoaWQpKTtcbiAgICAgIGF3YWl0IHN1Y2Nlc3NmdWxsSm9iO1xuICAgICAgYXNzZXJ0LmlzRmFsc2UocXVldWUuaGFzKGlkKSk7XG5cbiAgICAgIGNvbnN0IGZhaWxKb2IgPSBxdWV1ZS5hZGRXaXRoSWQoaWQsIGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgVGVzdFV0aWxzLnRpbWVvdXQoMTApO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ZhaWxlZCcpO1xuICAgICAgfSk7XG4gICAgICBhc3NlcnQuaXNUcnVlKHF1ZXVlLmhhcyhpZCkpO1xuICAgICAgYXdhaXQgYXNzZXJ0LmlzUmVqZWN0ZWQoZmFpbEpvYiwgL2ZhaWxlZC8pO1xuICAgICAgYXNzZXJ0LmlzRmFsc2UocXVldWUuaGFzKGlkKSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7O0FBRUEsa0JBQWlCO0FBQ2pCLGtCQUEyQjtBQUMzQixzQkFBeUI7QUFDekIsd0JBQTBCO0FBRTFCLDhCQUEyQjtBQUMzQixvQkFBSyxJQUFJLCtCQUFxQjtBQUU5QixNQUFNLEVBQUUsV0FBVztBQUVuQixTQUFTLFlBQVksTUFBTTtBQUN6QixXQUFTLE9BQU8sTUFBTTtBQUNwQixPQUFHLG1DQUFtQyxZQUFZO0FBQ2hELFlBQU0sUUFBUSxJQUFJLHlCQUFTO0FBQzNCLFlBQU0sS0FBSztBQUVYLGFBQU8sUUFBUSxNQUFNLElBQUksRUFBRSxDQUFDO0FBQzVCLFlBQU0sVUFBVSxNQUFNLFVBQVUsSUFBSSxZQUFZLDRCQUFVLFFBQVEsRUFBRSxDQUFDO0FBQ3JFLGFBQU8sT0FBTyxNQUFNLElBQUksRUFBRSxDQUFDO0FBQzNCLFlBQU07QUFDTixhQUFPLFFBQVEsTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUFBLElBQzlCLENBQUM7QUFBQSxFQUNILENBQUM7QUFFRCxXQUFTLGFBQWEsTUFBTTtBQUMxQixPQUFHLG9DQUFvQyxZQUFZO0FBQ2pELFlBQU0sUUFBUTtBQUFBLFFBQ1osQ0FBQyxJQUFJLEVBQUU7QUFBQSxRQUNQLENBQUMsSUFBSSxDQUFDO0FBQUEsUUFDTixDQUFDLElBQUksQ0FBQztBQUFBLE1BQ1I7QUFDQSxZQUFNLFFBQVEsSUFBSSx5QkFBUztBQUMzQixZQUFNLFNBQVMsOEJBQU8sQ0FBQyxPQUFPLFFBQzVCLE1BQU0sVUFBVSxvQkFBSyxHQUFHLFlBQVk7QUFDbEMsY0FBTSw0QkFBVSxRQUFRLEVBQUU7QUFFMUIsZUFBTztBQUFBLE1BQ1QsQ0FBQyxHQUxZO0FBT2YsWUFBTSxRQUFRLEtBQUssSUFBSTtBQUN2QixZQUFNLE9BQU8sV0FBVyxVQUFVLFFBQVEs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
