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
var message_exports = {};
__export(message_exports, {
  MockConversation: () => MockConversation,
  generateClosedGroupMessage: () => generateClosedGroupMessage,
  generateOpenGroupMessageV2: () => generateOpenGroupMessageV2,
  generateOpenGroupV2RoomInfos: () => generateOpenGroupV2RoomInfos,
  generateOpenGroupVisibleMessage: () => generateOpenGroupVisibleMessage,
  generateVisibleMessage: () => generateVisibleMessage
});
module.exports = __toCommonJS(message_exports);
var import_uuid = require("uuid");
var import_pubkey = require("./pubkey");
var import_ClosedGroupVisibleMessage = require("../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage");
var import_conversation = require("../../../models/conversation");
var import_VisibleMessage = require("../../../session/messages/outgoing/visibleMessage/VisibleMessage");
var import_OpenGroupUtils = require("../../../session/apis/open_group_api/utils/OpenGroupUtils");
var import_OpenGroupMessageV2 = require("../../../session/apis/open_group_api/opengroupV2/OpenGroupMessageV2");
var import__ = require("..");
var import_OpenGroupVisibleMessage = require("../../../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage");
function generateVisibleMessage({
  identifier,
  timestamp
} = {}) {
  return new import_VisibleMessage.VisibleMessage({
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
    identifier: identifier ?? (0, import_uuid.v4)(),
    timestamp: timestamp || Date.now(),
    attachments: void 0,
    quote: void 0,
    expireTimer: void 0,
    lokiProfile: void 0,
    preview: void 0
  });
}
function generateOpenGroupMessageV2() {
  return new import_OpenGroupMessageV2.OpenGroupMessageV2({
    sentTimestamp: Date.now(),
    sender: import__.TestUtils.generateFakePubKey().key,
    base64EncodedData: "whatever"
  });
}
function generateOpenGroupVisibleMessage() {
  return new import_OpenGroupVisibleMessage.OpenGroupVisibleMessage({
    timestamp: Date.now()
  });
}
function generateOpenGroupV2RoomInfos() {
  return { roomId: "main", serverUrl: "http://116.203.70.33" };
}
function generateClosedGroupMessage(groupId) {
  return new import_ClosedGroupVisibleMessage.ClosedGroupVisibleMessage({
    identifier: (0, import_uuid.v4)(),
    groupId: groupId ?? (0, import_pubkey.generateFakePubKey)().key,
    chatMessage: generateVisibleMessage()
  });
}
class MockConversation {
  constructor(params) {
    this.id = params.id ?? (0, import_pubkey.generateFakePubKey)().key;
    const members = params.isMediumGroup ? params.members ?? (0, import_pubkey.generateFakePubKeys)(10).map((m) => m.key) : [];
    this.type = params.type;
    this.attributes = {
      id: this.id,
      name: "",
      profileName: void 0,
      type: params.type === import_conversation.ConversationTypeEnum.GROUP ? "group" : params.type,
      members,
      left: false,
      expireTimer: 0,
      mentionedUs: false,
      unreadCount: 5,
      isKickedFromGroup: false,
      active_at: Date.now(),
      lastJoinedTimestamp: Date.now(),
      lastMessageStatus: void 0,
      lastMessage: null,
      zombies: [],
      triggerNotificationsFor: "all",
      isTrustedForAttachmentDownload: false,
      isPinned: false,
      isApproved: false,
      didApproveMe: false
    };
  }
  isPrivate() {
    return this.type === import_conversation.ConversationTypeEnum.PRIVATE;
  }
  isBlocked() {
    return false;
  }
  isPublic() {
    return this.id.match(import_OpenGroupUtils.openGroupPrefixRegex);
  }
  isMediumGroup() {
    return this.type === "group";
  }
  get(obj) {
    return this.attributes[obj];
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MockConversation,
  generateClosedGroupMessage,
  generateOpenGroupMessageV2,
  generateOpenGroupV2RoomInfos,
  generateOpenGroupVisibleMessage,
  generateVisibleMessage
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vdHMvdGVzdC90ZXN0LXV0aWxzL3V0aWxzL21lc3NhZ2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IHY0IGFzIHV1aWQgfSBmcm9tICd1dWlkJztcbmltcG9ydCB7IGdlbmVyYXRlRmFrZVB1YktleSwgZ2VuZXJhdGVGYWtlUHViS2V5cyB9IGZyb20gJy4vcHVia2V5JztcbmltcG9ydCB7IENsb3NlZEdyb3VwVmlzaWJsZU1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXNzaW9uL21lc3NhZ2VzL291dGdvaW5nL3Zpc2libGVNZXNzYWdlL0Nsb3NlZEdyb3VwVmlzaWJsZU1lc3NhZ2UnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uQXR0cmlidXRlcywgQ29udmVyc2F0aW9uVHlwZUVudW0gfSBmcm9tICcuLi8uLi8uLi9tb2RlbHMvY29udmVyc2F0aW9uJztcbmltcG9ydCB7IFZpc2libGVNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vc2Vzc2lvbi9tZXNzYWdlcy9vdXRnb2luZy92aXNpYmxlTWVzc2FnZS9WaXNpYmxlTWVzc2FnZSc7XG5pbXBvcnQgeyBvcGVuR3JvdXBQcmVmaXhSZWdleCB9IGZyb20gJy4uLy4uLy4uL3Nlc3Npb24vYXBpcy9vcGVuX2dyb3VwX2FwaS91dGlscy9PcGVuR3JvdXBVdGlscyc7XG5pbXBvcnQgeyBPcGVuR3JvdXBNZXNzYWdlVjIgfSBmcm9tICcuLi8uLi8uLi9zZXNzaW9uL2FwaXMvb3Blbl9ncm91cF9hcGkvb3Blbmdyb3VwVjIvT3Blbkdyb3VwTWVzc2FnZVYyJztcbmltcG9ydCB7IFRlc3RVdGlscyB9IGZyb20gJy4uJztcbmltcG9ydCB7IE9wZW5Hcm91cFJlcXVlc3RDb21tb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vc2Vzc2lvbi9hcGlzL29wZW5fZ3JvdXBfYXBpL29wZW5ncm91cFYyL0FwaVV0aWwnO1xuaW1wb3J0IHsgT3Blbkdyb3VwVmlzaWJsZU1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXNzaW9uL21lc3NhZ2VzL291dGdvaW5nL3Zpc2libGVNZXNzYWdlL09wZW5Hcm91cFZpc2libGVNZXNzYWdlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVmlzaWJsZU1lc3NhZ2Uoe1xuICBpZGVudGlmaWVyLFxuICB0aW1lc3RhbXAsXG59OiB7XG4gIGlkZW50aWZpZXI/OiBzdHJpbmc7XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0gPSB7fSk6IFZpc2libGVNZXNzYWdlIHtcbiAgcmV0dXJuIG5ldyBWaXNpYmxlTWVzc2FnZSh7XG4gICAgYm9keTogJ0xvcmVtIGlwc3VtIGRvbG9yIHNpdCBhbWV0LCBjb25zZWN0ZXR1ciBhZGlwaXNjaW5nIGVsaXQnLFxuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgPz8gdXVpZCgpLFxuICAgIHRpbWVzdGFtcDogdGltZXN0YW1wIHx8IERhdGUubm93KCksXG4gICAgYXR0YWNobWVudHM6IHVuZGVmaW5lZCxcbiAgICBxdW90ZTogdW5kZWZpbmVkLFxuICAgIGV4cGlyZVRpbWVyOiB1bmRlZmluZWQsXG4gICAgbG9raVByb2ZpbGU6IHVuZGVmaW5lZCxcbiAgICBwcmV2aWV3OiB1bmRlZmluZWQsXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVPcGVuR3JvdXBNZXNzYWdlVjIoKTogT3Blbkdyb3VwTWVzc2FnZVYyIHtcbiAgcmV0dXJuIG5ldyBPcGVuR3JvdXBNZXNzYWdlVjIoe1xuICAgIHNlbnRUaW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgc2VuZGVyOiBUZXN0VXRpbHMuZ2VuZXJhdGVGYWtlUHViS2V5KCkua2V5LFxuICAgIGJhc2U2NEVuY29kZWREYXRhOiAnd2hhdGV2ZXInLFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlT3Blbkdyb3VwVmlzaWJsZU1lc3NhZ2UoKTogT3Blbkdyb3VwVmlzaWJsZU1lc3NhZ2Uge1xuICByZXR1cm4gbmV3IE9wZW5Hcm91cFZpc2libGVNZXNzYWdlKHtcbiAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVPcGVuR3JvdXBWMlJvb21JbmZvcygpOiBPcGVuR3JvdXBSZXF1ZXN0Q29tbW9uVHlwZSB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8taHR0cC1zdHJpbmdcbiAgcmV0dXJuIHsgcm9vbUlkOiAnbWFpbicsIHNlcnZlclVybDogJ2h0dHA6Ly8xMTYuMjAzLjcwLjMzJyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDbG9zZWRHcm91cE1lc3NhZ2UoZ3JvdXBJZD86IHN0cmluZyk6IENsb3NlZEdyb3VwVmlzaWJsZU1lc3NhZ2Uge1xuICByZXR1cm4gbmV3IENsb3NlZEdyb3VwVmlzaWJsZU1lc3NhZ2Uoe1xuICAgIGlkZW50aWZpZXI6IHV1aWQoKSxcbiAgICBncm91cElkOiBncm91cElkID8/IGdlbmVyYXRlRmFrZVB1YktleSgpLmtleSxcbiAgICBjaGF0TWVzc2FnZTogZ2VuZXJhdGVWaXNpYmxlTWVzc2FnZSgpLFxuICB9KTtcbn1cblxuaW50ZXJmYWNlIE1vY2tDb252ZXJzYXRpb25QYXJhbXMge1xuICBpZD86IHN0cmluZztcbiAgbWVtYmVycz86IEFycmF5PHN0cmluZz47XG4gIHR5cGU6IENvbnZlcnNhdGlvblR5cGVFbnVtO1xuICBpc01lZGl1bUdyb3VwPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIE1vY2tDb252ZXJzYXRpb24ge1xuICBwdWJsaWMgaWQ6IHN0cmluZztcbiAgcHVibGljIHR5cGU6IENvbnZlcnNhdGlvblR5cGVFbnVtO1xuICBwdWJsaWMgYXR0cmlidXRlczogQ29udmVyc2F0aW9uQXR0cmlidXRlcztcblxuICBjb25zdHJ1Y3RvcihwYXJhbXM6IE1vY2tDb252ZXJzYXRpb25QYXJhbXMpIHtcbiAgICB0aGlzLmlkID0gcGFyYW1zLmlkID8/IGdlbmVyYXRlRmFrZVB1YktleSgpLmtleTtcblxuICAgIGNvbnN0IG1lbWJlcnMgPSBwYXJhbXMuaXNNZWRpdW1Hcm91cFxuICAgICAgPyBwYXJhbXMubWVtYmVycyA/PyBnZW5lcmF0ZUZha2VQdWJLZXlzKDEwKS5tYXAobSA9PiBtLmtleSlcbiAgICAgIDogW107XG5cbiAgICB0aGlzLnR5cGUgPSBwYXJhbXMudHlwZTtcblxuICAgIHRoaXMuYXR0cmlidXRlcyA9IHtcbiAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgbmFtZTogJycsXG4gICAgICBwcm9maWxlTmFtZTogdW5kZWZpbmVkLFxuICAgICAgdHlwZTogcGFyYW1zLnR5cGUgPT09IENvbnZlcnNhdGlvblR5cGVFbnVtLkdST1VQID8gJ2dyb3VwJyA6IHBhcmFtcy50eXBlLFxuICAgICAgbWVtYmVycyxcbiAgICAgIGxlZnQ6IGZhbHNlLFxuICAgICAgZXhwaXJlVGltZXI6IDAsXG4gICAgICBtZW50aW9uZWRVczogZmFsc2UsXG4gICAgICB1bnJlYWRDb3VudDogNSxcbiAgICAgIGlzS2lja2VkRnJvbUdyb3VwOiBmYWxzZSxcbiAgICAgIGFjdGl2ZV9hdDogRGF0ZS5ub3coKSxcbiAgICAgIGxhc3RKb2luZWRUaW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBsYXN0TWVzc2FnZVN0YXR1czogdW5kZWZpbmVkLFxuICAgICAgbGFzdE1lc3NhZ2U6IG51bGwsXG4gICAgICB6b21iaWVzOiBbXSxcbiAgICAgIHRyaWdnZXJOb3RpZmljYXRpb25zRm9yOiAnYWxsJyxcbiAgICAgIGlzVHJ1c3RlZEZvckF0dGFjaG1lbnREb3dubG9hZDogZmFsc2UsXG4gICAgICBpc1Bpbm5lZDogZmFsc2UsXG4gICAgICBpc0FwcHJvdmVkOiBmYWxzZSxcbiAgICAgIGRpZEFwcHJvdmVNZTogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIHB1YmxpYyBpc1ByaXZhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gQ29udmVyc2F0aW9uVHlwZUVudW0uUFJJVkFURTtcbiAgfVxuXG4gIHB1YmxpYyBpc0Jsb2NrZWQoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHVibGljIGlzUHVibGljKCkge1xuICAgIHJldHVybiB0aGlzLmlkLm1hdGNoKG9wZW5Hcm91cFByZWZpeFJlZ2V4KTtcbiAgfVxuXG4gIHB1YmxpYyBpc01lZGl1bUdyb3VwKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT09ICdncm91cCc7XG4gIH1cblxuICBwdWJsaWMgZ2V0KG9iajogc3RyaW5nKSB7XG4gICAgcmV0dXJuICh0aGlzLmF0dHJpYnV0ZXMgYXMgYW55KVtvYmpdO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGtCQUEyQjtBQUMzQixvQkFBd0Q7QUFDeEQsdUNBQTBDO0FBQzFDLDBCQUE2RDtBQUM3RCw0QkFBK0I7QUFDL0IsNEJBQXFDO0FBQ3JDLGdDQUFtQztBQUNuQyxlQUEwQjtBQUUxQixxQ0FBd0M7QUFFakMsZ0NBQWdDO0FBQUEsRUFDckM7QUFBQSxFQUNBO0FBQUEsSUFJRSxDQUFDLEdBQW1CO0FBQ3RCLFNBQU8sSUFBSSxxQ0FBZTtBQUFBLElBQ3hCLE1BQU07QUFBQSxJQUNOLFlBQVksY0FBYyxvQkFBSztBQUFBLElBQy9CLFdBQVcsYUFBYSxLQUFLLElBQUk7QUFBQSxJQUNqQyxhQUFhO0FBQUEsSUFDYixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixhQUFhO0FBQUEsSUFDYixTQUFTO0FBQUEsRUFDWCxDQUFDO0FBQ0g7QUFqQmdCLEFBbUJULHNDQUEwRDtBQUMvRCxTQUFPLElBQUksNkNBQW1CO0FBQUEsSUFDNUIsZUFBZSxLQUFLLElBQUk7QUFBQSxJQUN4QixRQUFRLG1CQUFVLG1CQUFtQixFQUFFO0FBQUEsSUFDdkMsbUJBQW1CO0FBQUEsRUFDckIsQ0FBQztBQUNIO0FBTmdCLEFBUVQsMkNBQW9FO0FBQ3pFLFNBQU8sSUFBSSx1REFBd0I7QUFBQSxJQUNqQyxXQUFXLEtBQUssSUFBSTtBQUFBLEVBQ3RCLENBQUM7QUFDSDtBQUpnQixBQU1ULHdDQUFvRTtBQUV6RSxTQUFPLEVBQUUsUUFBUSxRQUFRLFdBQVcsdUJBQXVCO0FBQzdEO0FBSGdCLEFBS1Qsb0NBQW9DLFNBQTZDO0FBQ3RGLFNBQU8sSUFBSSwyREFBMEI7QUFBQSxJQUNuQyxZQUFZLG9CQUFLO0FBQUEsSUFDakIsU0FBUyxXQUFXLHNDQUFtQixFQUFFO0FBQUEsSUFDekMsYUFBYSx1QkFBdUI7QUFBQSxFQUN0QyxDQUFDO0FBQ0g7QUFOZ0IsQUFlVCxNQUFNLGlCQUFpQjtBQUFBLEVBSzVCLFlBQVksUUFBZ0M7QUFDMUMsU0FBSyxLQUFLLE9BQU8sTUFBTSxzQ0FBbUIsRUFBRTtBQUU1QyxVQUFNLFVBQVUsT0FBTyxnQkFDbkIsT0FBTyxXQUFXLHVDQUFvQixFQUFFLEVBQUUsSUFBSSxPQUFLLEVBQUUsR0FBRyxJQUN4RCxDQUFDO0FBRUwsU0FBSyxPQUFPLE9BQU87QUFFbkIsU0FBSyxhQUFhO0FBQUEsTUFDaEIsSUFBSSxLQUFLO0FBQUEsTUFDVCxNQUFNO0FBQUEsTUFDTixhQUFhO0FBQUEsTUFDYixNQUFNLE9BQU8sU0FBUyx5Q0FBcUIsUUFBUSxVQUFVLE9BQU87QUFBQSxNQUNwRTtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sYUFBYTtBQUFBLE1BQ2IsYUFBYTtBQUFBLE1BQ2IsYUFBYTtBQUFBLE1BQ2IsbUJBQW1CO0FBQUEsTUFDbkIsV0FBVyxLQUFLLElBQUk7QUFBQSxNQUNwQixxQkFBcUIsS0FBSyxJQUFJO0FBQUEsTUFDOUIsbUJBQW1CO0FBQUEsTUFDbkIsYUFBYTtBQUFBLE1BQ2IsU0FBUyxDQUFDO0FBQUEsTUFDVix5QkFBeUI7QUFBQSxNQUN6QixnQ0FBZ0M7QUFBQSxNQUNoQyxVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsTUFDWixjQUFjO0FBQUEsSUFDaEI7QUFBQSxFQUNGO0FBQUEsRUFFTyxZQUFZO0FBQ2pCLFdBQU8sS0FBSyxTQUFTLHlDQUFxQjtBQUFBLEVBQzVDO0FBQUEsRUFFTyxZQUFZO0FBQ2pCLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFTyxXQUFXO0FBQ2hCLFdBQU8sS0FBSyxHQUFHLE1BQU0sMENBQW9CO0FBQUEsRUFDM0M7QUFBQSxFQUVPLGdCQUFnQjtBQUNyQixXQUFPLEtBQUssU0FBUztBQUFBLEVBQ3ZCO0FBQUEsRUFFTyxJQUFJLEtBQWE7QUFDdEIsV0FBUSxLQUFLLFdBQW1CO0FBQUEsRUFDbEM7QUFDRjtBQXpETyIsCiAgIm5hbWVzIjogW10KfQo=
