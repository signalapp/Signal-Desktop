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
var open_exports = {};
__export(open_exports, {
  getAppDataPath: () => getAppDataPath,
  openApp: () => openApp
});
module.exports = __toCommonJS(open_exports);
var import_test = __toESM(require("@playwright/test"));
var import_fs = require("fs");
var path = __toESM(require("path"));
const NODE_ENV = "test-integration";
let appDataPath;
import_test.default.beforeAll(async () => {
  appDataPath = await getAppDataPath();
});
const getDirectoriesOfSessionDataPath = /* @__PURE__ */ __name((source) => (0, import_fs.readdirSync)(source, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name).filter((n) => n.startsWith(`Session-${NODE_ENV}`)), "getDirectoriesOfSessionDataPath");
import_test.default.beforeEach(() => {
  if (!appDataPath || !appDataPath.length) {
    throw new Error("appDataPath unset");
  }
  const parentFolderOfAllDataPath = path.dirname(appDataPath);
  if (!parentFolderOfAllDataPath || parentFolderOfAllDataPath.length < 20) {
    throw new Error("parentFolderOfAllDataPath not found or invalid");
  }
  const allAppDataPath = getDirectoriesOfSessionDataPath(parentFolderOfAllDataPath);
  allAppDataPath.map((folder) => {
    if (!appDataPath) {
      throw new Error("parentFolderOfAllDataPath unset");
    }
    const pathToRemove = path.join(parentFolderOfAllDataPath, folder);
    (0, import_fs.rmdirSync)(pathToRemove, { recursive: true });
  });
});
const getAppDataPath = /* @__PURE__ */ __name(async () => {
  process.env.NODE_ENV = NODE_ENV;
  const electronApp = await import_test._electron.launch({ args: ["main.js"] });
  const appPath = await electronApp.evaluate(async ({ app }) => {
    return app.getPath("userData");
  });
  const window = await electronApp.firstWindow();
  await window.close();
  return appPath;
}, "getAppDataPath");
const openApp = /* @__PURE__ */ __name(async (multi) => {
  process.env.NODE_APP_INSTANCE = multi;
  process.env.NODE_ENV = NODE_ENV;
  const electronApp = await import_test._electron.launch({ args: ["main.js"] });
  const window = await electronApp.firstWindow();
  await window.reload();
  return window;
}, "openApp");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getAppDataPath,
  openApp
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC9hdXRvbWF0aW9uL29wZW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB0ZXN0LCB7IF9lbGVjdHJvbiB9IGZyb20gJ0BwbGF5d3JpZ2h0L3Rlc3QnO1xuaW1wb3J0IHsgcmVhZGRpclN5bmMsIHJtZGlyU3luYyB9IGZyb20gJ2ZzJztcblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgTk9ERV9FTlYgPSAndGVzdC1pbnRlZ3JhdGlvbic7XG5cbmxldCBhcHBEYXRhUGF0aDogdW5kZWZpbmVkIHwgc3RyaW5nO1xuXG50ZXN0LmJlZm9yZUFsbChhc3luYyAoKSA9PiB7XG4gIGFwcERhdGFQYXRoID0gYXdhaXQgZ2V0QXBwRGF0YVBhdGgoKTtcbn0pO1xuXG5jb25zdCBnZXREaXJlY3Rvcmllc09mU2Vzc2lvbkRhdGFQYXRoID0gKHNvdXJjZTogc3RyaW5nKSA9PlxuICByZWFkZGlyU3luYyhzb3VyY2UsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpKVxuICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgIC5maWx0ZXIobiA9PiBuLnN0YXJ0c1dpdGgoYFNlc3Npb24tJHtOT0RFX0VOVn1gKSk7XG5cbnRlc3QuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGlmICghYXBwRGF0YVBhdGggfHwgIWFwcERhdGFQYXRoLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYXBwRGF0YVBhdGggdW5zZXQnKTtcbiAgfVxuICBjb25zdCBwYXJlbnRGb2xkZXJPZkFsbERhdGFQYXRoID0gcGF0aC5kaXJuYW1lKGFwcERhdGFQYXRoKTtcblxuICBpZiAoIXBhcmVudEZvbGRlck9mQWxsRGF0YVBhdGggfHwgcGFyZW50Rm9sZGVyT2ZBbGxEYXRhUGF0aC5sZW5ndGggPCAyMCkge1xuICAgIHRocm93IG5ldyBFcnJvcigncGFyZW50Rm9sZGVyT2ZBbGxEYXRhUGF0aCBub3QgZm91bmQgb3IgaW52YWxpZCcpO1xuICB9XG5cbiAgY29uc3QgYWxsQXBwRGF0YVBhdGggPSBnZXREaXJlY3Rvcmllc09mU2Vzc2lvbkRhdGFQYXRoKHBhcmVudEZvbGRlck9mQWxsRGF0YVBhdGgpO1xuXG4gIGFsbEFwcERhdGFQYXRoLm1hcChmb2xkZXIgPT4ge1xuICAgIGlmICghYXBwRGF0YVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncGFyZW50Rm9sZGVyT2ZBbGxEYXRhUGF0aCB1bnNldCcpO1xuICAgIH1cbiAgICBjb25zdCBwYXRoVG9SZW1vdmUgPSBwYXRoLmpvaW4ocGFyZW50Rm9sZGVyT2ZBbGxEYXRhUGF0aCwgZm9sZGVyKTtcbiAgICBybWRpclN5bmMocGF0aFRvUmVtb3ZlLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfSk7XG59KTtcblxuZXhwb3J0IGNvbnN0IGdldEFwcERhdGFQYXRoID0gYXN5bmMgKCkgPT4ge1xuICBwcm9jZXNzLmVudi5OT0RFX0VOViA9IE5PREVfRU5WO1xuICBjb25zdCBlbGVjdHJvbkFwcCA9IGF3YWl0IF9lbGVjdHJvbi5sYXVuY2goeyBhcmdzOiBbJ21haW4uanMnXSB9KTtcbiAgY29uc3QgYXBwUGF0aCA9IGF3YWl0IGVsZWN0cm9uQXBwLmV2YWx1YXRlKGFzeW5jICh7IGFwcCB9KSA9PiB7XG4gICAgcmV0dXJuIGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICB9KTtcbiAgY29uc3Qgd2luZG93ID0gYXdhaXQgZWxlY3Ryb25BcHAuZmlyc3RXaW5kb3coKTtcbiAgYXdhaXQgd2luZG93LmNsb3NlKCk7XG5cbiAgcmV0dXJuIGFwcFBhdGg7XG59O1xuXG5leHBvcnQgY29uc3Qgb3BlbkFwcCA9IGFzeW5jIChtdWx0aTogc3RyaW5nKSA9PiB7XG4gIHByb2Nlc3MuZW52Lk5PREVfQVBQX0lOU1RBTkNFID0gbXVsdGk7XG4gIHByb2Nlc3MuZW52Lk5PREVfRU5WID0gTk9ERV9FTlY7XG4gIGNvbnN0IGVsZWN0cm9uQXBwID0gYXdhaXQgX2VsZWN0cm9uLmxhdW5jaCh7IGFyZ3M6IFsnbWFpbi5qcyddIH0pO1xuICAvLyBHZXQgdGhlIGZpcnN0IHdpbmRvdyB0aGF0IHRoZSBhcHAgb3BlbnMsIHdhaXQgaWYgbmVjZXNzYXJ5LlxuICBjb25zdCB3aW5kb3cgPSBhd2FpdCBlbGVjdHJvbkFwcC5maXJzdFdpbmRvdygpO1xuXG4gIGF3YWl0IHdpbmRvdy5yZWxvYWQoKTtcbiAgcmV0dXJuIHdpbmRvdztcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFBZ0M7QUFDaEMsZ0JBQXVDO0FBRXZDLFdBQXNCO0FBRXRCLE1BQU0sV0FBVztBQUVqQixJQUFJO0FBRUosb0JBQUssVUFBVSxZQUFZO0FBQ3pCLGdCQUFjLE1BQU0sZUFBZTtBQUNyQyxDQUFDO0FBRUQsTUFBTSxrQ0FBa0Msd0JBQUMsV0FDdkMsMkJBQVksUUFBUSxFQUFFLGVBQWUsS0FBSyxDQUFDLEVBQ3hDLE9BQU8sWUFBVSxPQUFPLFlBQVksQ0FBQyxFQUNyQyxJQUFJLFlBQVUsT0FBTyxJQUFJLEVBQ3pCLE9BQU8sT0FBSyxFQUFFLFdBQVcsV0FBVyxVQUFVLENBQUMsR0FKWjtBQU14QyxvQkFBSyxXQUFXLE1BQU07QUFDcEIsTUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLFFBQVE7QUFDdkMsVUFBTSxJQUFJLE1BQU0sbUJBQW1CO0FBQUEsRUFDckM7QUFDQSxRQUFNLDRCQUE0QixLQUFLLFFBQVEsV0FBVztBQUUxRCxNQUFJLENBQUMsNkJBQTZCLDBCQUEwQixTQUFTLElBQUk7QUFDdkUsVUFBTSxJQUFJLE1BQU0sZ0RBQWdEO0FBQUEsRUFDbEU7QUFFQSxRQUFNLGlCQUFpQixnQ0FBZ0MseUJBQXlCO0FBRWhGLGlCQUFlLElBQUksWUFBVTtBQUMzQixRQUFJLENBQUMsYUFBYTtBQUNoQixZQUFNLElBQUksTUFBTSxpQ0FBaUM7QUFBQSxJQUNuRDtBQUNBLFVBQU0sZUFBZSxLQUFLLEtBQUssMkJBQTJCLE1BQU07QUFDaEUsNkJBQVUsY0FBYyxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsRUFDN0MsQ0FBQztBQUNILENBQUM7QUFFTSxNQUFNLGlCQUFpQixtQ0FBWTtBQUN4QyxVQUFRLElBQUksV0FBVztBQUN2QixRQUFNLGNBQWMsTUFBTSxzQkFBVSxPQUFPLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ2hFLFFBQU0sVUFBVSxNQUFNLFlBQVksU0FBUyxPQUFPLEVBQUUsVUFBVTtBQUM1RCxXQUFPLElBQUksUUFBUSxVQUFVO0FBQUEsRUFDL0IsQ0FBQztBQUNELFFBQU0sU0FBUyxNQUFNLFlBQVksWUFBWTtBQUM3QyxRQUFNLE9BQU8sTUFBTTtBQUVuQixTQUFPO0FBQ1QsR0FWOEI7QUFZdkIsTUFBTSxVQUFVLDhCQUFPLFVBQWtCO0FBQzlDLFVBQVEsSUFBSSxvQkFBb0I7QUFDaEMsVUFBUSxJQUFJLFdBQVc7QUFDdkIsUUFBTSxjQUFjLE1BQU0sc0JBQVUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUVoRSxRQUFNLFNBQVMsTUFBTSxZQUFZLFlBQVk7QUFFN0MsUUFBTSxPQUFPLE9BQU87QUFDcEIsU0FBTztBQUNULEdBVHVCOyIsCiAgIm5hbWVzIjogW10KfQo=
