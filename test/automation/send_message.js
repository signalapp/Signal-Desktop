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
var send_message_exports = {};
__export(send_message_exports, {
  sendMessage: () => sendMessage
});
module.exports = __toCommonJS(send_message_exports);
const sendMessage = /* @__PURE__ */ __name(async (window, sessionid, message) => {
  await window.click("[data-testid=new-conversation-button]");
  await window.fill(".session-id-editable-textarea", sessionid);
  await window.click("text=Next");
  await window.fill("[data-testid=message-input] * textarea", message);
  await window.click("[data-testid=send-message-button]");
}, "sendMessage");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  sendMessage
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC9hdXRvbWF0aW9uL3NlbmRfbWVzc2FnZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgX2VsZWN0cm9uLCBQYWdlIH0gZnJvbSAnQHBsYXl3cmlnaHQvdGVzdCc7XG5cbmV4cG9ydCBjb25zdCBzZW5kTWVzc2FnZSA9IGFzeW5jICh3aW5kb3c6IFBhZ2UsIHNlc3Npb25pZDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgd2luZG93LmNsaWNrKCdbZGF0YS10ZXN0aWQ9bmV3LWNvbnZlcnNhdGlvbi1idXR0b25dJyk7XG4gIC8vIEVudGVyIHNlc3Npb24gSUQgb2YgVVNFUiBCXG4gIGF3YWl0IHdpbmRvdy5maWxsKCcuc2Vzc2lvbi1pZC1lZGl0YWJsZS10ZXh0YXJlYScsIHNlc3Npb25pZCk7XG4gIC8vIGNsaWNrIG5leHRcbiAgYXdhaXQgd2luZG93LmNsaWNrKCd0ZXh0PU5leHQnKTtcbiAgLy8gdHlwZSBpbnRvIG1lc3NhZ2UgaW5wdXQgYm94XG4gIGF3YWl0IHdpbmRvdy5maWxsKCdbZGF0YS10ZXN0aWQ9bWVzc2FnZS1pbnB1dF0gKiB0ZXh0YXJlYScsIG1lc3NhZ2UpO1xuICAvLyBjbGljayB1cCBhcnJvdyAoc2VuZClcbiAgYXdhaXQgd2luZG93LmNsaWNrKCdbZGF0YS10ZXN0aWQ9c2VuZC1tZXNzYWdlLWJ1dHRvbl0nKTtcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBRU8sTUFBTSxjQUFjLDhCQUFPLFFBQWMsV0FBbUIsWUFBb0I7QUFDckYsUUFBTSxPQUFPLE1BQU0sdUNBQXVDO0FBRTFELFFBQU0sT0FBTyxLQUFLLGlDQUFpQyxTQUFTO0FBRTVELFFBQU0sT0FBTyxNQUFNLFdBQVc7QUFFOUIsUUFBTSxPQUFPLEtBQUssMENBQTBDLE9BQU87QUFFbkUsUUFBTSxPQUFPLE1BQU0sbUNBQW1DO0FBQ3hELEdBVjJCOyIsCiAgIm5hbWVzIjogW10KfQo=
