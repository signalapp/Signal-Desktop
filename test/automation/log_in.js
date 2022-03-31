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
var log_in_exports = {};
__export(log_in_exports, {
  logIn: () => logIn
});
module.exports = __toCommonJS(log_in_exports);
var import_Promise = require("../../session/utils/Promise");
const logIn = /* @__PURE__ */ __name(async (window, userName, recoveryPhrase) => {
  await window.click("[data-testid=restore-using-recovery");
  await window.fill("[data-testid=recovery-phrase-input]", recoveryPhrase);
  await window.fill("[data-testid=display-name-input]", userName);
  await window.click("[data-testid=continue-session-button]");
  await (0, import_Promise.sleepFor)(100);
}, "logIn");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  logIn
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC9hdXRvbWF0aW9uL2xvZ19pbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgX2VsZWN0cm9uLCBQYWdlIH0gZnJvbSAnQHBsYXl3cmlnaHQvdGVzdCc7XG5pbXBvcnQgeyBzbGVlcEZvciB9IGZyb20gJy4uLy4uL3Nlc3Npb24vdXRpbHMvUHJvbWlzZSc7XG5cbmV4cG9ydCBjb25zdCBsb2dJbiA9IGFzeW5jICh3aW5kb3c6IFBhZ2UsIHVzZXJOYW1lOiBzdHJpbmcsIHJlY292ZXJ5UGhyYXNlOiBzdHJpbmcpID0+IHtcbiAgLy8gcmVzdG9yZSBhY2NvdW50XG4gIGF3YWl0IHdpbmRvdy5jbGljaygnW2RhdGEtdGVzdGlkPXJlc3RvcmUtdXNpbmctcmVjb3ZlcnknKTtcbiAgLy8gRW50ZXIgcmVjb3ZlcnkgcGhyYXNlXG4gIGF3YWl0IHdpbmRvdy5maWxsKCdbZGF0YS10ZXN0aWQ9cmVjb3ZlcnktcGhyYXNlLWlucHV0XScsIHJlY292ZXJ5UGhyYXNlKTtcbiAgLy8gRW50ZXIgZGlzcGxheSBuYW1lXG4gIGF3YWl0IHdpbmRvdy5maWxsKCdbZGF0YS10ZXN0aWQ9ZGlzcGxheS1uYW1lLWlucHV0XScsIHVzZXJOYW1lKTtcbiAgLy8gQ2xpY2sgY29udGludWUgeW91ciBzZXNzaW9uXG4gIGF3YWl0IHdpbmRvdy5jbGljaygnW2RhdGEtdGVzdGlkPWNvbnRpbnVlLXNlc3Npb24tYnV0dG9uXScpO1xuXG4gIGF3YWl0IHNsZWVwRm9yKDEwMCk7XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBLHFCQUF5QjtBQUVsQixNQUFNLFFBQVEsOEJBQU8sUUFBYyxVQUFrQixtQkFBMkI7QUFFckYsUUFBTSxPQUFPLE1BQU0scUNBQXFDO0FBRXhELFFBQU0sT0FBTyxLQUFLLHVDQUF1QyxjQUFjO0FBRXZFLFFBQU0sT0FBTyxLQUFLLG9DQUFvQyxRQUFRO0FBRTlELFFBQU0sT0FBTyxNQUFNLHVDQUF1QztBQUUxRCxRQUFNLDZCQUFTLEdBQUc7QUFDcEIsR0FYcUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
