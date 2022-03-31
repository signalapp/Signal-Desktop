var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var OS_exports = {};
__export(OS_exports, {
  isLinux: () => isLinux,
  isMacOS: () => isMacOS,
  isWindows: () => isWindows
});
module.exports = __toCommonJS(OS_exports);
var import_lodash = __toESM(require("lodash"));
var import_os = __toESM(require("os"));
var import_semver = __toESM(require("semver"));
const isMacOS = /* @__PURE__ */ __name(() => process.platform === "darwin", "isMacOS");
const isLinux = /* @__PURE__ */ __name(() => process.platform === "linux", "isLinux");
const isWindows = /* @__PURE__ */ __name((minVersion) => {
  const osRelease = import_os.default.release();
  if (process.platform !== "win32") {
    return false;
  }
  return import_lodash.default.isUndefined(minVersion) ? true : import_semver.default.gte(osRelease, minVersion);
}, "isWindows");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isLinux,
  isMacOS,
  isWindows
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHMvT1MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG5leHBvcnQgY29uc3QgaXNNYWNPUyA9ICgpID0+IHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nO1xuZXhwb3J0IGNvbnN0IGlzTGludXggPSAoKSA9PiBwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnO1xuZXhwb3J0IGNvbnN0IGlzV2luZG93cyA9IChtaW5WZXJzaW9uPzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IG9zUmVsZWFzZSA9IG9zLnJlbGVhc2UoKTtcblxuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBfLmlzVW5kZWZpbmVkKG1pblZlcnNpb24pID8gdHJ1ZSA6IHNlbXZlci5ndGUob3NSZWxlYXNlLCBtaW5WZXJzaW9uKTtcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG9CQUFjO0FBQ2QsZ0JBQWU7QUFDZixvQkFBbUI7QUFFWixNQUFNLFVBQVUsNkJBQU0sUUFBUSxhQUFhLFVBQTNCO0FBQ2hCLE1BQU0sVUFBVSw2QkFBTSxRQUFRLGFBQWEsU0FBM0I7QUFDaEIsTUFBTSxZQUFZLHdCQUFDLGVBQXdCO0FBQ2hELFFBQU0sWUFBWSxrQkFBRyxRQUFRO0FBRTdCLE1BQUksUUFBUSxhQUFhLFNBQVM7QUFDaEMsV0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPLHNCQUFFLFlBQVksVUFBVSxJQUFJLE9BQU8sc0JBQU8sSUFBSSxXQUFXLFVBQVU7QUFDNUUsR0FSeUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
