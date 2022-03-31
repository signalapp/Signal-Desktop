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
var import_utils = require("../../../../session/utils");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { expect } = import_chai.default;
describe("Promise Utils", () => {
  const sandbox = sinon.createSandbox();
  let pollSpy;
  let waitForTaskSpy;
  let waitUntilSpy;
  beforeEach(() => {
    pollSpy = sandbox.spy(import_utils.PromiseUtils, "poll");
    waitForTaskSpy = sandbox.spy(import_utils.PromiseUtils, "waitForTask");
    waitUntilSpy = sandbox.spy(import_utils.PromiseUtils, "waitUntil");
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe("poll", () => {
    it("will call done on finished", async () => {
      const completionSpy = sandbox.spy();
      const task = /* @__PURE__ */ __name((done) => {
        completionSpy();
        done();
      }, "task");
      const promise = import_utils.PromiseUtils.poll(task, { interval: 10 });
      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
      return promise;
    });
    it("can timeout a task", () => {
      const completionSpy = sandbox.spy();
      const task = /* @__PURE__ */ __name((_done) => void 0, "task");
      const promise = import_utils.PromiseUtils.poll(task, { timeoutMs: 1, interval: 10 });
      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
      return promise.should.eventually.be.rejectedWith("Periodic check timeout");
    });
    it("will recur according to interval option", async () => {
      const expectedRecurrences = 4;
      const timeout = 3e3;
      const interval = 3;
      const recurrenceSpy = sandbox.spy();
      const task = /* @__PURE__ */ __name((done) => {
        recurrenceSpy();
        if (recurrenceSpy.callCount === expectedRecurrences) {
          done();
        }
      }, "task");
      const promise = import_utils.PromiseUtils.poll(task, { timeoutMs: timeout, interval });
      await promise;
      expect(pollSpy.callCount).to.equal(1);
      expect(recurrenceSpy.callCount).to.equal(expectedRecurrences);
    });
  });
  describe("waitForTask", () => {
    it("can wait for a task", async () => {
      const completionSpy = sandbox.spy();
      const task = /* @__PURE__ */ __name((done) => {
        completionSpy();
        done();
      }, "task");
      const promise = import_utils.PromiseUtils.waitForTask(task);
      expect(waitForTaskSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
      return promise;
    });
    it("can timeout a task", () => {
      const completionSpy = sandbox.spy();
      const task = /* @__PURE__ */ __name(async (_done) => void 0, "task");
      const promise = import_utils.PromiseUtils.waitForTask(task, 1);
      expect(waitForTaskSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
      return promise.should.eventually.be.rejectedWith("Task timed out");
    });
  });
  describe("waitUntil", () => {
    it("can wait for check", async () => {
      const check = /* @__PURE__ */ __name(() => true, "check");
      const promise = import_utils.PromiseUtils.waitUntil(check, 5);
      expect(waitUntilSpy.callCount).to.equal(1);
      return promise;
    });
    it("can timeout a check", () => {
      const check = /* @__PURE__ */ __name(() => false, "check");
      const promise = import_utils.PromiseUtils.waitUntil(check, 1);
      expect(waitUntilSpy.callCount).to.equal(1);
      return promise.should.eventually.be.rejectedWith("Periodic check timeout");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvdXRpbHMvUHJvbWlzZV90ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyB0c2xpbnQ6ZGlzYWJsZTogbm8taW1wbGljaXQtZGVwZW5kZW5jaWVzIG1heC1mdW5jLWJvZHktbGVuZ3RoIG5vLXVudXNlZC1leHByZXNzaW9uXG5cbmltcG9ydCBjaGFpIGZyb20gJ2NoYWknO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuXG5pbXBvcnQgeyBQcm9taXNlVXRpbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL3V0aWxzJztcblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1yZXF1aXJlLWltcG9ydHMgbm8tdmFyLXJlcXVpcmVzXG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5jaGFpLnVzZShjaGFpQXNQcm9taXNlZCBhcyBhbnkpO1xuY2hhaS5zaG91bGQoKTtcblxuY29uc3QgeyBleHBlY3QgfSA9IGNoYWk7XG5cbmRlc2NyaWJlKCdQcm9taXNlIFV0aWxzJywgKCkgPT4ge1xuICBjb25zdCBzYW5kYm94ID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuICBsZXQgcG9sbFNweTogc2lub24uU2lub25TcHk8XG4gICAgW1xuICAgICAgKGRvbmU6IChhcmc6IGFueSkgPT4gdm9pZCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQsXG4gICAgICAoUGFydGlhbDxQcm9taXNlVXRpbHMuUG9sbE9wdGlvbnM+IHwgdW5kZWZpbmVkKT9cbiAgICBdLFxuICAgIFByb21pc2U8dm9pZD5cbiAgPjtcbiAgbGV0IHdhaXRGb3JUYXNrU3B5OiBzaW5vbi5TaW5vblNweTxcbiAgICBbKGRvbmU6IChhcmc6IGFueSkgPT4gdm9pZCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQsIChudW1iZXIgfCB1bmRlZmluZWQpP10sXG4gICAgUHJvbWlzZTx1bmtub3duPlxuICA+O1xuICBsZXQgd2FpdFVudGlsU3B5OiBzaW5vbi5TaW5vblNweTxcbiAgICBbKCkgPT4gUHJvbWlzZTxib29sZWFuPiB8IGJvb2xlYW4sIChudW1iZXIgfCB1bmRlZmluZWQpP10sXG4gICAgUHJvbWlzZTx2b2lkPlxuICA+O1xuXG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIHBvbGxTcHkgPSBzYW5kYm94LnNweShQcm9taXNlVXRpbHMsICdwb2xsJyk7XG4gICAgd2FpdEZvclRhc2tTcHkgPSBzYW5kYm94LnNweShQcm9taXNlVXRpbHMsICd3YWl0Rm9yVGFzaycpO1xuICAgIHdhaXRVbnRpbFNweSA9IHNhbmRib3guc3B5KFByb21pc2VVdGlscywgJ3dhaXRVbnRpbCcpO1xuICB9KTtcblxuICBhZnRlckVhY2goKCkgPT4ge1xuICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICB9KTtcblxuICBkZXNjcmliZSgncG9sbCcsICgpID0+IHtcbiAgICBpdCgnd2lsbCBjYWxsIGRvbmUgb24gZmluaXNoZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBjb21wbGV0aW9uU3B5IHdpbGwgYmUgY2FsbGVkIG9uIGRvbmVcbiAgICAgIGNvbnN0IGNvbXBsZXRpb25TcHkgPSBzYW5kYm94LnNweSgpO1xuXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1vY2hhLXVubmVlZGVkLWRvbmVcbiAgICAgIGNvbnN0IHRhc2sgPSAoZG9uZTogYW55KSA9PiB7XG4gICAgICAgIGNvbXBsZXRpb25TcHkoKTtcbiAgICAgICAgZG9uZSgpO1xuICAgICAgfTtcblxuICAgICAgY29uc3QgcHJvbWlzZSA9IFByb21pc2VVdGlscy5wb2xsKHRhc2ssIHsgaW50ZXJ2YWw6IDEwIH0pO1xuXG4gICAgICBleHBlY3QocG9sbFNweS5jYWxsQ291bnQpLnRvLmVxdWFsKDEpO1xuICAgICAgZXhwZWN0KGNvbXBsZXRpb25TcHkuY2FsbENvdW50KS50by5lcXVhbCgxKTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0pO1xuXG4gICAgaXQoJ2NhbiB0aW1lb3V0IGEgdGFzaycsICgpID0+IHtcbiAgICAgIC8vIGNvbXBsZXRpb25TcHkgd2lsbCBiZSBjYWxsZWQgb24gZG9uZVxuICAgICAgY29uc3QgY29tcGxldGlvblNweSA9IHNhbmRib3guc3B5KCk7XG4gICAgICBjb25zdCB0YXNrID0gKF9kb25lOiBhbnkpID0+IHVuZGVmaW5lZDtcblxuICAgICAgY29uc3QgcHJvbWlzZSA9IFByb21pc2VVdGlscy5wb2xsKHRhc2ssIHsgdGltZW91dE1zOiAxLCBpbnRlcnZhbDogMTAgfSk7XG5cbiAgICAgIGV4cGVjdChwb2xsU3B5LmNhbGxDb3VudCkudG8uZXF1YWwoMSk7XG4gICAgICBleHBlY3QoY29tcGxldGlvblNweS5jYWxsQ291bnQpLnRvLmVxdWFsKDApO1xuICAgICAgcmV0dXJuIHByb21pc2Uuc2hvdWxkLmV2ZW50dWFsbHkuYmUucmVqZWN0ZWRXaXRoKCdQZXJpb2RpYyBjaGVjayB0aW1lb3V0Jyk7XG4gICAgfSk7XG5cbiAgICBpdCgnd2lsbCByZWN1ciBhY2NvcmRpbmcgdG8gaW50ZXJ2YWwgb3B0aW9uJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgZXhwZWN0ZWRSZWN1cnJlbmNlcyA9IDQ7XG4gICAgICBjb25zdCB0aW1lb3V0ID0gMzAwMDtcbiAgICAgIGNvbnN0IGludGVydmFsID0gMztcblxuICAgICAgY29uc3QgcmVjdXJyZW5jZVNweSA9IHNhbmRib3guc3B5KCk7XG4gICAgICBjb25zdCB0YXNrID0gKGRvbmU6IGFueSkgPT4ge1xuICAgICAgICByZWN1cnJlbmNlU3B5KCk7XG5cbiAgICAgICAgLy8gRG9uZSBhZnRlciB3ZSd2ZSBiZWVuIGNhbGxlZCBgZXhwZWN0ZWRSZWN1cnJlbmNlc2AgdGltZXNcbiAgICAgICAgaWYgKHJlY3VycmVuY2VTcHkuY2FsbENvdW50ID09PSBleHBlY3RlZFJlY3VycmVuY2VzKSB7XG4gICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBwcm9taXNlID0gUHJvbWlzZVV0aWxzLnBvbGwodGFzaywgeyB0aW1lb3V0TXM6IHRpbWVvdXQsIGludGVydmFsIH0pO1xuICAgICAgYXdhaXQgcHJvbWlzZTtcblxuICAgICAgZXhwZWN0KHBvbGxTcHkuY2FsbENvdW50KS50by5lcXVhbCgxKTtcbiAgICAgIGV4cGVjdChyZWN1cnJlbmNlU3B5LmNhbGxDb3VudCkudG8uZXF1YWwoZXhwZWN0ZWRSZWN1cnJlbmNlcyk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCd3YWl0Rm9yVGFzaycsICgpID0+IHtcbiAgICBpdCgnY2FuIHdhaXQgZm9yIGEgdGFzaycsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIGNvbXBsZXRpb25TcHkgd2lsbCBiZSBjYWxsZWQgb24gZG9uZVxuICAgICAgY29uc3QgY29tcGxldGlvblNweSA9IHNhbmRib3guc3B5KCk7XG5cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbW9jaGEtdW5uZWVkZWQtZG9uZVxuICAgICAgY29uc3QgdGFzayA9IChkb25lOiBhbnkpID0+IHtcbiAgICAgICAgY29tcGxldGlvblNweSgpO1xuICAgICAgICBkb25lKCk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBwcm9taXNlID0gUHJvbWlzZVV0aWxzLndhaXRGb3JUYXNrKHRhc2spO1xuXG4gICAgICBleHBlY3Qod2FpdEZvclRhc2tTcHkuY2FsbENvdW50KS50by5lcXVhbCgxKTtcbiAgICAgIGV4cGVjdChjb21wbGV0aW9uU3B5LmNhbGxDb3VudCkudG8uZXF1YWwoMSk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gdGltZW91dCBhIHRhc2snLCAoKSA9PiB7XG4gICAgICAvLyBjb21wbGV0aW9uU3B5IHdpbGwgYmUgY2FsbGVkIG9uIGRvbmVcbiAgICAgIGNvbnN0IGNvbXBsZXRpb25TcHkgPSBzYW5kYm94LnNweSgpO1xuICAgICAgY29uc3QgdGFzayA9IGFzeW5jIChfZG9uZTogYW55KSA9PiB1bmRlZmluZWQ7XG5cbiAgICAgIGNvbnN0IHByb21pc2UgPSBQcm9taXNlVXRpbHMud2FpdEZvclRhc2sodGFzaywgMSk7XG5cbiAgICAgIGV4cGVjdCh3YWl0Rm9yVGFza1NweS5jYWxsQ291bnQpLnRvLmVxdWFsKDEpO1xuICAgICAgZXhwZWN0KGNvbXBsZXRpb25TcHkuY2FsbENvdW50KS50by5lcXVhbCgwKTtcbiAgICAgIHJldHVybiBwcm9taXNlLnNob3VsZC5ldmVudHVhbGx5LmJlLnJlamVjdGVkV2l0aCgnVGFzayB0aW1lZCBvdXQnKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3dhaXRVbnRpbCcsICgpID0+IHtcbiAgICBpdCgnY2FuIHdhaXQgZm9yIGNoZWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY2hlY2sgPSAoKSA9PiB0cnVlO1xuICAgICAgY29uc3QgcHJvbWlzZSA9IFByb21pc2VVdGlscy53YWl0VW50aWwoY2hlY2ssIDUpO1xuXG4gICAgICBleHBlY3Qod2FpdFVudGlsU3B5LmNhbGxDb3VudCkudG8uZXF1YWwoMSk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gdGltZW91dCBhIGNoZWNrJywgKCkgPT4ge1xuICAgICAgY29uc3QgY2hlY2sgPSAoKSA9PiBmYWxzZTtcbiAgICAgIGNvbnN0IHByb21pc2UgPSBQcm9taXNlVXRpbHMud2FpdFVudGlsKGNoZWNrLCAxKTtcblxuICAgICAgZXhwZWN0KHdhaXRVbnRpbFNweS5jYWxsQ291bnQpLnRvLmVxdWFsKDEpO1xuICAgICAgcmV0dXJuIHByb21pc2Uuc2hvdWxkLmV2ZW50dWFsbHkuYmUucmVqZWN0ZWRXaXRoKCdQZXJpb2RpYyBjaGVjayB0aW1lb3V0Jyk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7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
