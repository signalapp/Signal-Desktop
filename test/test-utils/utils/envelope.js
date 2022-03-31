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
var envelope_exports = {};
__export(envelope_exports, {
  generateEnvelopePlus: () => generateEnvelopePlus,
  generateEnvelopePlusClosedGroup: () => generateEnvelopePlusClosedGroup
});
module.exports = __toCommonJS(envelope_exports);
var import_protobuf = require("../../../protobuf");
var import_uuid = __toESM(require("uuid"));
function generateEnvelopePlusClosedGroup(groupId, sender) {
  const envelope = {
    senderIdentity: sender,
    receivedAt: Date.now(),
    timestamp: Date.now() - 2e3,
    id: (0, import_uuid.default)(),
    type: import_protobuf.SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE,
    source: groupId,
    content: new Uint8Array(),
    toJSON: () => ["fake"]
  };
  return envelope;
}
function generateEnvelopePlus(sender) {
  const envelope = {
    receivedAt: Date.now(),
    timestamp: Date.now() - 2e3,
    id: (0, import_uuid.default)(),
    type: import_protobuf.SignalService.Envelope.Type.SESSION_MESSAGE,
    source: sender,
    senderIdentity: sender,
    content: new Uint8Array(),
    toJSON: () => ["fake"]
  };
  return envelope;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateEnvelopePlus,
  generateEnvelopePlusClosedGroup
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vdHMvdGVzdC90ZXN0LXV0aWxzL3V0aWxzL2VudmVsb3BlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBFbnZlbG9wZVBsdXMgfSBmcm9tICcuLi8uLi8uLi9yZWNlaXZlci90eXBlcyc7XG5pbXBvcnQgeyBTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcHJvdG9idWYnO1xuXG5pbXBvcnQgdXVpZCBmcm9tICd1dWlkJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRW52ZWxvcGVQbHVzQ2xvc2VkR3JvdXAoZ3JvdXBJZDogc3RyaW5nLCBzZW5kZXI6IHN0cmluZyk6IEVudmVsb3BlUGx1cyB7XG4gIGNvbnN0IGVudmVsb3BlOiBFbnZlbG9wZVBsdXMgPSB7XG4gICAgc2VuZGVySWRlbnRpdHk6IHNlbmRlcixcbiAgICByZWNlaXZlZEF0OiBEYXRlLm5vdygpLFxuICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSAtIDIwMDAsXG4gICAgaWQ6IHV1aWQoKSxcbiAgICB0eXBlOiBTaWduYWxTZXJ2aWNlLkVudmVsb3BlLlR5cGUuQ0xPU0VEX0dST1VQX01FU1NBR0UsXG4gICAgc291cmNlOiBncm91cElkLFxuICAgIGNvbnRlbnQ6IG5ldyBVaW50OEFycmF5KCksXG4gICAgdG9KU09OOiAoKSA9PiBbJ2Zha2UnXSxcbiAgfTtcblxuICByZXR1cm4gZW52ZWxvcGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUVudmVsb3BlUGx1cyhzZW5kZXI6IHN0cmluZyk6IEVudmVsb3BlUGx1cyB7XG4gIGNvbnN0IGVudmVsb3BlOiBFbnZlbG9wZVBsdXMgPSB7XG4gICAgcmVjZWl2ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB0aW1lc3RhbXA6IERhdGUubm93KCkgLSAyMDAwLFxuICAgIGlkOiB1dWlkKCksXG4gICAgdHlwZTogU2lnbmFsU2VydmljZS5FbnZlbG9wZS5UeXBlLlNFU1NJT05fTUVTU0FHRSxcbiAgICBzb3VyY2U6IHNlbmRlcixcbiAgICBzZW5kZXJJZGVudGl0eTogc2VuZGVyLFxuICAgIGNvbnRlbnQ6IG5ldyBVaW50OEFycmF5KCksXG4gICAgdG9KU09OOiAoKSA9PiBbJ2Zha2UnXSxcbiAgfTtcblxuICByZXR1cm4gZW52ZWxvcGU7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQSxzQkFBOEI7QUFFOUIsa0JBQWlCO0FBRVYseUNBQXlDLFNBQWlCLFFBQThCO0FBQzdGLFFBQU0sV0FBeUI7QUFBQSxJQUM3QixnQkFBZ0I7QUFBQSxJQUNoQixZQUFZLEtBQUssSUFBSTtBQUFBLElBQ3JCLFdBQVcsS0FBSyxJQUFJLElBQUk7QUFBQSxJQUN4QixJQUFJLHlCQUFLO0FBQUEsSUFDVCxNQUFNLDhCQUFjLFNBQVMsS0FBSztBQUFBLElBQ2xDLFFBQVE7QUFBQSxJQUNSLFNBQVMsSUFBSSxXQUFXO0FBQUEsSUFDeEIsUUFBUSxNQUFNLENBQUMsTUFBTTtBQUFBLEVBQ3ZCO0FBRUEsU0FBTztBQUNUO0FBYmdCLEFBZVQsOEJBQThCLFFBQThCO0FBQ2pFLFFBQU0sV0FBeUI7QUFBQSxJQUM3QixZQUFZLEtBQUssSUFBSTtBQUFBLElBQ3JCLFdBQVcsS0FBSyxJQUFJLElBQUk7QUFBQSxJQUN4QixJQUFJLHlCQUFLO0FBQUEsSUFDVCxNQUFNLDhCQUFjLFNBQVMsS0FBSztBQUFBLElBQ2xDLFFBQVE7QUFBQSxJQUNSLGdCQUFnQjtBQUFBLElBQ2hCLFNBQVMsSUFBSSxXQUFXO0FBQUEsSUFDeEIsUUFBUSxNQUFNLENBQUMsTUFBTTtBQUFBLEVBQ3ZCO0FBRUEsU0FBTztBQUNUO0FBYmdCIiwKICAibmFtZXMiOiBbXQp9Cg==
