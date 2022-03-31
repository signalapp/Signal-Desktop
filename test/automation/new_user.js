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
var new_user_exports = {};
__export(new_user_exports, {
  newUser: () => newUser
});
module.exports = __toCommonJS(new_user_exports);
const newUser = /* @__PURE__ */ __name(async (window, userName) => {
  await window.click("text=Create Session ID");
  await window.waitForTimeout(1500);
  const sessionid = await window.inputValue("[data-testid=session-id-signup]");
  await window.click("text=Continue");
  await window.fill("#session-input-floating-label", userName);
  await window.click("text=Get Started");
  await window.click("text=Reveal recovery phrase");
  const recoveryPhrase = await window.innerText("[data-testid=recovery-phrase-seed-modal]");
  await window.click(".session-icon-button.small");
  return { userName, sessionid, recoveryPhrase };
}, "newUser");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  newUser
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC9hdXRvbWF0aW9uL25ld191c2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBfZWxlY3Ryb24sIFBhZ2UgfSBmcm9tICdAcGxheXdyaWdodC90ZXN0JztcblxuZXhwb3J0IGNvbnN0IG5ld1VzZXIgPSBhc3luYyAod2luZG93OiBQYWdlLCB1c2VyTmFtZTogc3RyaW5nKSA9PiB7XG4gIC8vIENyZWF0ZSBVc2VyXG4gIGF3YWl0IHdpbmRvdy5jbGljaygndGV4dD1DcmVhdGUgU2Vzc2lvbiBJRCcpO1xuICAvLyBXYWl0IGZvciBhbmltYXRpb24gZm9yIGZpbmlzaCBjcmVhdGluZyBJRFxuICBhd2FpdCB3aW5kb3cud2FpdEZvclRpbWVvdXQoMTUwMCk7XG4gIC8vU2F2ZSBzZXNzaW9uIElEIHRvIGEgdmFyaWFibGVcbiAgY29uc3Qgc2Vzc2lvbmlkID0gYXdhaXQgd2luZG93LmlucHV0VmFsdWUoJ1tkYXRhLXRlc3RpZD1zZXNzaW9uLWlkLXNpZ251cF0nKTtcbiAgYXdhaXQgd2luZG93LmNsaWNrKCd0ZXh0PUNvbnRpbnVlJyk7XG4gIC8vIElucHV0IHVzZXJuYW1lID0gdGVzdHVzZXJcbiAgYXdhaXQgd2luZG93LmZpbGwoJyNzZXNzaW9uLWlucHV0LWZsb2F0aW5nLWxhYmVsJywgdXNlck5hbWUpO1xuICBhd2FpdCB3aW5kb3cuY2xpY2soJ3RleHQ9R2V0IFN0YXJ0ZWQnKTtcbiAgLy8gc2F2ZSByZWNvdmVyeSBwaHJhc2VcbiAgYXdhaXQgd2luZG93LmNsaWNrKCd0ZXh0PVJldmVhbCByZWNvdmVyeSBwaHJhc2UnKTtcbiAgY29uc3QgcmVjb3ZlcnlQaHJhc2UgPSBhd2FpdCB3aW5kb3cuaW5uZXJUZXh0KCdbZGF0YS10ZXN0aWQ9cmVjb3ZlcnktcGhyYXNlLXNlZWQtbW9kYWxdJyk7XG5cbiAgYXdhaXQgd2luZG93LmNsaWNrKCcuc2Vzc2lvbi1pY29uLWJ1dHRvbi5zbWFsbCcpO1xuICByZXR1cm4geyB1c2VyTmFtZSwgc2Vzc2lvbmlkLCByZWNvdmVyeVBocmFzZSB9O1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFFTyxNQUFNLFVBQVUsOEJBQU8sUUFBYyxhQUFxQjtBQUUvRCxRQUFNLE9BQU8sTUFBTSx3QkFBd0I7QUFFM0MsUUFBTSxPQUFPLGVBQWUsSUFBSTtBQUVoQyxRQUFNLFlBQVksTUFBTSxPQUFPLFdBQVcsaUNBQWlDO0FBQzNFLFFBQU0sT0FBTyxNQUFNLGVBQWU7QUFFbEMsUUFBTSxPQUFPLEtBQUssaUNBQWlDLFFBQVE7QUFDM0QsUUFBTSxPQUFPLE1BQU0sa0JBQWtCO0FBRXJDLFFBQU0sT0FBTyxNQUFNLDZCQUE2QjtBQUNoRCxRQUFNLGlCQUFpQixNQUFNLE9BQU8sVUFBVSwwQ0FBMEM7QUFFeEYsUUFBTSxPQUFPLE1BQU0sNEJBQTRCO0FBQy9DLFNBQU8sRUFBRSxVQUFVLFdBQVcsZUFBZTtBQUMvQyxHQWpCdUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
