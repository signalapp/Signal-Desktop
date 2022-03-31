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
var clean_up_exports = {};
__export(clean_up_exports, {
  cleanUp: () => cleanUp
});
module.exports = __toCommonJS(clean_up_exports);
const cleanUp = /* @__PURE__ */ __name(async (window) => {
  await window.click("[data-testid=settings-section]");
  await window.click("text=Clear All Data");
  await window.click("text=Entire Account");
  await window.click("text=I am sure");
  await window.waitForTimeout(1e4);
}, "cleanUp");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cleanUp
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC9hdXRvbWF0aW9uL2NsZWFuX3VwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBfZWxlY3Ryb24sIFBhZ2UgfSBmcm9tICdAcGxheXdyaWdodC90ZXN0JztcblxuZXhwb3J0IGNvbnN0IGNsZWFuVXAgPSBhc3luYyAod2luZG93OiBQYWdlKSA9PiB7XG4gIGF3YWl0IHdpbmRvdy5jbGljaygnW2RhdGEtdGVzdGlkPXNldHRpbmdzLXNlY3Rpb25dJyk7XG4gIGF3YWl0IHdpbmRvdy5jbGljaygndGV4dD1DbGVhciBBbGwgRGF0YScpO1xuICBhd2FpdCB3aW5kb3cuY2xpY2soJ3RleHQ9RW50aXJlIEFjY291bnQnKTtcbiAgYXdhaXQgd2luZG93LmNsaWNrKCd0ZXh0PUkgYW0gc3VyZScpO1xuICBhd2FpdCB3aW5kb3cud2FpdEZvclRpbWVvdXQoMTAwMDApO1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFFTyxNQUFNLFVBQVUsOEJBQU8sV0FBaUI7QUFDN0MsUUFBTSxPQUFPLE1BQU0sZ0NBQWdDO0FBQ25ELFFBQU0sT0FBTyxNQUFNLHFCQUFxQjtBQUN4QyxRQUFNLE9BQU8sTUFBTSxxQkFBcUI7QUFDeEMsUUFBTSxPQUFPLE1BQU0sZ0JBQWdCO0FBQ25DLFFBQU0sT0FBTyxlQUFlLEdBQUs7QUFDbkMsR0FOdUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
