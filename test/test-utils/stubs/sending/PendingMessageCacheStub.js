var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var PendingMessageCacheStub_exports = {};
__export(PendingMessageCacheStub_exports, {
  PendingMessageCacheStub: () => PendingMessageCacheStub
});
module.exports = __toCommonJS(PendingMessageCacheStub_exports);
var import_sending = require("../../../../session/sending");
class PendingMessageCacheStub extends import_sending.PendingMessageCache {
  constructor(dbData = []) {
    super();
    this.dbData = dbData;
  }
  getCache() {
    return this.cache;
  }
  async getFromStorage() {
    return this.dbData;
  }
  async saveToDB() {
    return;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PendingMessageCacheStub
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC90ZXN0LXV0aWxzL3N0dWJzL3NlbmRpbmcvUGVuZGluZ01lc3NhZ2VDYWNoZVN0dWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBlbmRpbmdNZXNzYWdlQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL3NlbmRpbmcnO1xuaW1wb3J0IHsgUmF3TWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgUGVuZGluZ01lc3NhZ2VDYWNoZVN0dWIgZXh0ZW5kcyBQZW5kaW5nTWVzc2FnZUNhY2hlIHtcbiAgcHVibGljIGRiRGF0YTogQXJyYXk8UmF3TWVzc2FnZT47XG4gIGNvbnN0cnVjdG9yKGRiRGF0YTogQXJyYXk8UmF3TWVzc2FnZT4gPSBbXSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5kYkRhdGEgPSBkYkRhdGE7XG4gIH1cblxuICBwdWJsaWMgZ2V0Q2FjaGUoKTogUmVhZG9ubHk8QXJyYXk8UmF3TWVzc2FnZT4+IHtcbiAgICByZXR1cm4gdGhpcy5jYWNoZTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBnZXRGcm9tU3RvcmFnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYkRhdGE7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgc2F2ZVRvREIoKSB7XG4gICAgcmV0dXJuO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQW9DO0FBRzdCLE1BQU0sZ0NBQWdDLG1DQUFvQjtBQUFBLEVBRS9ELFlBQVksU0FBNEIsQ0FBQyxHQUFHO0FBQzFDLFVBQU07QUFDTixTQUFLLFNBQVM7QUFBQSxFQUNoQjtBQUFBLEVBRU8sV0FBd0M7QUFDN0MsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBLFFBRWdCLGlCQUFpQjtBQUMvQixXQUFPLEtBQUs7QUFBQSxFQUNkO0FBQUEsUUFFZ0IsV0FBVztBQUN6QjtBQUFBLEVBQ0Y7QUFDRjtBQWxCTyIsCiAgIm5hbWVzIjogW10KfQo=
