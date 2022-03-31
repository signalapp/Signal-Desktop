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
var timeout_exports = {};
__export(timeout_exports, {
  timeout: () => timeout
});
module.exports = __toCommonJS(timeout_exports);
async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  timeout
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vdHMvdGVzdC90ZXN0LXV0aWxzL3V0aWxzL3RpbWVvdXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBhc3luYyBmdW5jdGlvbiB0aW1lb3V0KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lIG5vLXN0cmluZy1iYXNlZC1zZXQtdGltZW91dFxuICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQThCLElBQTJCO0FBRXZELFNBQU8sSUFBSSxRQUFRLGFBQVcsV0FBVyxTQUFTLEVBQUUsQ0FBQztBQUN2RDtBQUhzQiIsCiAgIm5hbWVzIjogW10KfQo=
