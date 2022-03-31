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
var stubbing_exports = {};
__export(stubbing_exports, {
  restoreStubs: () => restoreStubs,
  stubData: () => stubData,
  stubWindow: () => stubWindow,
  stubWindowLog: () => stubWindowLog
});
module.exports = __toCommonJS(stubbing_exports);
var sinon = __toESM(require("sinon"));
const globalAny = global;
const sandbox = sinon.createSandbox();
const Data = require("../../../../ts/data/data");
function stubData(fn) {
  return sandbox.stub(Data, fn);
}
function stubWindow(fn, value) {
  if (typeof globalAny.window === "undefined") {
    globalAny.window = {};
  }
  const set = /* @__PURE__ */ __name((newValue) => {
    globalAny.window[fn] = newValue;
  }, "set");
  const get = /* @__PURE__ */ __name(() => {
    return globalAny.window[fn];
  }, "get");
  globalAny.window[fn] = value;
  return {
    get,
    set
  };
}
function restoreStubs() {
  globalAny.window = void 0;
  sandbox.restore();
}
const stubWindowLog = /* @__PURE__ */ __name(() => {
  stubWindow("log", {
    info: (args) => console.info(args),
    warn: (args) => console.warn(args),
    error: (args) => console.error(args)
  });
}, "stubWindowLog");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  restoreStubs,
  stubData,
  stubWindow,
  stubWindowLog
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vdHMvdGVzdC90ZXN0LXV0aWxzL3V0aWxzL3N0dWJiaW5nLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgKiBhcyBEYXRhU2hhcGUgZnJvbSAnLi4vLi4vLi4vLi4vdHMvZGF0YS9kYXRhJztcblxuY29uc3QgZ2xvYmFsQW55OiBhbnkgPSBnbG9iYWw7XG5jb25zdCBzYW5kYm94ID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuXG4vLyBXZSBoYXZlIHRvIGRvIHRoaXMgaW4gYSB3ZWlyZCB3YXkgYmVjYXVzZSBEYXRhIHVzZXMgbW9kdWxlLmV4cG9ydHNcbi8vICB3aGljaCBkb2Vzbid0IHBsYXkgd2VsbCB3aXRoIHNpbm9uIG9yIEltcG9ydE1vY2tcbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8tcmVxdWlyZS1pbXBvcnRzIG5vLXZhci1yZXF1aXJlc1xuY29uc3QgRGF0YSA9IHJlcXVpcmUoJy4uLy4uLy4uLy4uL3RzL2RhdGEvZGF0YScpO1xudHlwZSBEYXRhRnVuY3Rpb24gPSB0eXBlb2YgRGF0YVNoYXBlO1xuXG4vKipcbiAqIFN0dWIgYSBmdW5jdGlvbiBpbnNpZGUgRGF0YS5cbiAqXG4gKiBOb3RlOiBUaGlzIHVzZXMgYSBjdXN0b20gc2FuZGJveC5cbiAqIFBsZWFzZSBjYWxsIGByZXN0b3JlU3R1YnMoKWAgb3IgYHN0dWIucmVzdG9yZSgpYCB0byByZXN0b3JlIG9yaWdpbmFsIGZ1bmN0aW9uYWxpdHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdHViRGF0YTxLIGV4dGVuZHMga2V5b2YgRGF0YUZ1bmN0aW9uPihmbjogSyk6IHNpbm9uLlNpbm9uU3R1YiB7XG4gIHJldHVybiBzYW5kYm94LnN0dWIoRGF0YSwgZm4pO1xufVxuXG50eXBlIFdpbmRvd1ZhbHVlPEsgZXh0ZW5kcyBrZXlvZiBXaW5kb3c+ID0gUGFydGlhbDxXaW5kb3dbS10+IHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIFN0dWIgYSB3aW5kb3cgb2JqZWN0LlxuICpcbiAqIE5vdGU6IFRoaXMgdXNlcyBhIGN1c3RvbSBzYW5kYm94LlxuICogUGxlYXNlIGNhbGwgYHJlc3RvcmVTdHVicygpYCBvciBgc3R1Yi5yZXN0b3JlKClgIHRvIHJlc3RvcmUgb3JpZ2luYWwgZnVuY3Rpb25hbGl0eS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0dWJXaW5kb3c8SyBleHRlbmRzIGtleW9mIFdpbmRvdz4oZm46IEssIHZhbHVlOiBXaW5kb3dWYWx1ZTxLPikge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG5vLXR5cGVvZi11bmRlZmluZWRcbiAgaWYgKHR5cGVvZiBnbG9iYWxBbnkud2luZG93ID09PSAndW5kZWZpbmVkJykge1xuICAgIGdsb2JhbEFueS53aW5kb3cgPSB7fTtcbiAgfVxuXG4gIGNvbnN0IHNldCA9IChuZXdWYWx1ZTogV2luZG93VmFsdWU8Sz4pID0+IHtcbiAgICBnbG9iYWxBbnkud2luZG93W2ZuXSA9IG5ld1ZhbHVlO1xuICB9O1xuXG4gIGNvbnN0IGdldCA9ICgpID0+IHtcbiAgICByZXR1cm4gZ2xvYmFsQW55LndpbmRvd1tmbl0gYXMgV2luZG93VmFsdWU8Sz47XG4gIH07XG5cbiAgZ2xvYmFsQW55LndpbmRvd1tmbl0gPSB2YWx1ZTtcblxuICByZXR1cm4ge1xuICAgIGdldCxcbiAgICBzZXQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXN0b3JlU3R1YnMoKSB7XG4gIGdsb2JhbEFueS53aW5kb3cgPSB1bmRlZmluZWQ7XG4gIHNhbmRib3gucmVzdG9yZSgpO1xufVxuXG5leHBvcnQgY29uc3Qgc3R1YldpbmRvd0xvZyA9ICgpID0+IHtcbiAgc3R1YldpbmRvdygnbG9nJywge1xuICAgIC8vIHRzbGludDpkaXNhYmxlOiBuby12b2lkLWV4cHJlc3Npb25cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZTogbm8tY29uc29sZVxuICAgIGluZm86IChhcmdzOiBhbnkpID0+IGNvbnNvbGUuaW5mbyhhcmdzKSxcbiAgICB3YXJuOiAoYXJnczogYW55KSA9PiBjb25zb2xlLndhcm4oYXJncyksXG4gICAgZXJyb3I6IChhcmdzOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYXJncyksXG4gIH0pO1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQUF1QjtBQUd2QixNQUFNLFlBQWlCO0FBQ3ZCLE1BQU0sVUFBVSxNQUFNLGNBQWM7QUFLcEMsTUFBTSxPQUFPLFFBQVEsMEJBQTBCO0FBU3hDLGtCQUFnRCxJQUF3QjtBQUM3RSxTQUFPLFFBQVEsS0FBSyxNQUFNLEVBQUU7QUFDOUI7QUFGZ0IsQUFZVCxvQkFBNEMsSUFBTyxPQUF1QjtBQUUvRSxNQUFJLE9BQU8sVUFBVSxXQUFXLGFBQWE7QUFDM0MsY0FBVSxTQUFTLENBQUM7QUFBQSxFQUN0QjtBQUVBLFFBQU0sTUFBTSx3QkFBQyxhQUE2QjtBQUN4QyxjQUFVLE9BQU8sTUFBTTtBQUFBLEVBQ3pCLEdBRlk7QUFJWixRQUFNLE1BQU0sNkJBQU07QUFDaEIsV0FBTyxVQUFVLE9BQU87QUFBQSxFQUMxQixHQUZZO0FBSVosWUFBVSxPQUFPLE1BQU07QUFFdkIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUNGO0FBcEJnQixBQXNCVCx3QkFBd0I7QUFDN0IsWUFBVSxTQUFTO0FBQ25CLFVBQVEsUUFBUTtBQUNsQjtBQUhnQixBQUtULE1BQU0sZ0JBQWdCLDZCQUFNO0FBQ2pDLGFBQVcsT0FBTztBQUFBLElBR2hCLE1BQU0sQ0FBQyxTQUFjLFFBQVEsS0FBSyxJQUFJO0FBQUEsSUFDdEMsTUFBTSxDQUFDLFNBQWMsUUFBUSxLQUFLLElBQUk7QUFBQSxJQUN0QyxPQUFPLENBQUMsU0FBYyxRQUFRLE1BQU0sSUFBSTtBQUFBLEVBQzFDLENBQUM7QUFDSCxHQVI2QjsiLAogICJuYW1lcyI6IFtdCn0K
