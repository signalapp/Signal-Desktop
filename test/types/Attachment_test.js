var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var import_chai = require("chai");
var import_moment = __toESM(require("moment"));
var Attachment = __toESM(require("../../types/Attachment"));
var MIME = __toESM(require("../../types/MIME"));
var import_protobuf = require("../../protobuf");
const stringToArrayBuffer = /* @__PURE__ */ __name((str) => {
  if (typeof str !== "string") {
    throw new TypeError("'string' must be a string");
  }
  const array = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    array[i] = str.charCodeAt(i);
  }
  return array.buffer;
}, "stringToArrayBuffer");
describe("Attachment", () => {
  describe("getFileExtension", () => {
    it("should return file extension from content type", () => {
      const input = {
        fileName: "funny-cat.mov",
        url: "funny-cat.mov",
        contentType: MIME.IMAGE_GIF,
        fileSize: null,
        screenshot: null,
        thumbnail: null
      };
      import_chai.assert.strictEqual(Attachment.getFileExtension(input), "gif");
    });
    it("should return file extension for QuickTime videos", () => {
      const input = {
        fileName: "funny-cat.mov",
        url: "funny-cat.mov",
        contentType: MIME.VIDEO_QUICKTIME,
        fileSize: null,
        screenshot: null,
        thumbnail: null
      };
      import_chai.assert.strictEqual(Attachment.getFileExtension(input), "mov");
    });
    it("should return file extension for application files", () => {
      const input = {
        fileName: "funny-cat.odt",
        url: "funny-cat.odt",
        contentType: MIME.ODT,
        fileSize: null,
        screenshot: null,
        thumbnail: null
      };
      import_chai.assert.strictEqual(Attachment.getFileExtension(input), "odt");
    });
  });
  describe("getSuggestedFilename", () => {
    context("for attachment with filename", () => {
      it("should generate a filename without timestamp", () => {
        const attachment = {
          fileName: "funny-cat.mov",
          url: "funny-cat.mov",
          contentType: MIME.VIDEO_QUICKTIME,
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const actual = Attachment.getSuggestedFilename({ attachment });
        const expected = "funny-cat.mov";
        import_chai.assert.strictEqual(actual, expected);
      });
      it("should generate a filename without timestamp but with an index", () => {
        const attachment = {
          fileName: "funny-cat.mov",
          url: "funny-cat.mov",
          contentType: MIME.VIDEO_QUICKTIME,
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const actual = Attachment.getSuggestedFilename({
          attachment,
          index: 3
        });
        const expected = "funny-cat.mov";
        import_chai.assert.strictEqual(actual, expected);
      });
      it("should generate a filename with an extension if contentType is not setup", () => {
        const attachment = {
          fileName: "funny-cat.ini",
          url: "funny-cat.ini",
          contentType: "",
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const actual = Attachment.getSuggestedFilename({
          attachment,
          index: 3
        });
        const expected = "funny-cat.ini";
        import_chai.assert.strictEqual(actual, expected);
      });
      it("should generate a filename with an extension if contentType is text/plain", () => {
        const attachment = {
          fileName: "funny-cat.txt",
          url: "funny-cat.txt",
          contentType: "text/plain",
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const actual = Attachment.getSuggestedFilename({
          attachment,
          index: 3
        });
        const expected = "funny-cat.txt";
        import_chai.assert.strictEqual(actual, expected);
      });
      it("should generate a filename with an extension if contentType is json", () => {
        const attachment = {
          fileName: "funny-cat.json",
          url: "funny-cat.json",
          contentType: "",
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const actual = Attachment.getSuggestedFilename({
          attachment,
          index: 3
        });
        const expected = "funny-cat.json";
        import_chai.assert.strictEqual(actual, expected);
      });
    });
    context("for attachment without filename", () => {
      it("should generate a filename based on timestamp", () => {
        const attachment = {
          contentType: MIME.VIDEO_QUICKTIME,
          url: "funny-cat.mov",
          fileName: "funny-cat.mov",
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const timestamp = (0, import_moment.default)("2000-01-01").toDate();
        const actual = Attachment.getSuggestedFilename({
          attachment,
          timestamp
        });
        const expected = "funny-cat.mov";
        import_chai.assert.strictEqual(actual, expected);
      });
    });
    context("for attachment with index", () => {
      it("should generate a filename based on timestamp if filename is not set", () => {
        const attachment = {
          fileName: "",
          url: "funny-cat.mov",
          contentType: MIME.VIDEO_QUICKTIME,
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const timestamp = new Date(new Date(0).getTimezoneOffset() * 60 * 1e3);
        const actual = Attachment.getSuggestedFilename({
          attachment,
          timestamp,
          index: 3
        });
        const expected = "session-attachment-1970-01-01-000000_003.mov";
        import_chai.assert.strictEqual(actual, expected);
      });
      it("should generate a filename based on filename if present", () => {
        const attachment = {
          fileName: "funny-cat.mov",
          url: "funny-cat.mov",
          contentType: MIME.VIDEO_QUICKTIME,
          fileSize: null,
          screenshot: null,
          thumbnail: null
        };
        const timestamp = new Date(new Date(0).getTimezoneOffset() * 60 * 1e3);
        const actual = Attachment.getSuggestedFilename({
          attachment,
          timestamp,
          index: 3
        });
        const expected = "funny-cat.mov";
        import_chai.assert.strictEqual(actual, expected);
      });
    });
  });
  describe("isVisualMedia", () => {
    it("should return true for images", () => {
      const attachment = {
        fileName: "meme.gif",
        data: stringToArrayBuffer("gif"),
        contentType: MIME.IMAGE_GIF
      };
      import_chai.assert.isTrue(Attachment.isVisualMedia(attachment));
    });
    it("should return true for videos", () => {
      const attachment = {
        fileName: "meme.mp4",
        data: stringToArrayBuffer("mp4"),
        contentType: MIME.VIDEO_MP4
      };
      import_chai.assert.isTrue(Attachment.isVisualMedia(attachment));
    });
    it("should return false for voice message attachment", () => {
      const attachment = {
        fileName: "Voice Message.aac",
        flags: import_protobuf.SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
        data: stringToArrayBuffer("voice message"),
        contentType: MIME.AUDIO_AAC
      };
      import_chai.assert.isFalse(Attachment.isVisualMedia(attachment));
    });
    it("should return false for other attachments", () => {
      const attachment = {
        fileName: "foo.json",
        data: stringToArrayBuffer('{"foo": "bar"}'),
        contentType: MIME.APPLICATION_JSON
      };
      import_chai.assert.isFalse(Attachment.isVisualMedia(attachment));
    });
  });
  describe("isFile", () => {
    it("should return true for JSON", () => {
      const attachment = {
        fileName: "foo.json",
        data: stringToArrayBuffer('{"foo": "bar"}'),
        contentType: MIME.APPLICATION_JSON
      };
      import_chai.assert.isTrue(Attachment.isFile(attachment));
    });
    it("should return false for images", () => {
      const attachment = {
        fileName: "meme.gif",
        data: stringToArrayBuffer("gif"),
        contentType: MIME.IMAGE_GIF
      };
      import_chai.assert.isFalse(Attachment.isFile(attachment));
    });
    it("should return false for videos", () => {
      const attachment = {
        fileName: "meme.mp4",
        data: stringToArrayBuffer("mp4"),
        contentType: MIME.VIDEO_MP4
      };
      import_chai.assert.isFalse(Attachment.isFile(attachment));
    });
    it("should return false for voice message attachment", () => {
      const attachment = {
        fileName: "Voice Message.aac",
        flags: import_protobuf.SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
        data: stringToArrayBuffer("voice message"),
        contentType: MIME.AUDIO_AAC
      };
      import_chai.assert.isFalse(Attachment.isFile(attachment));
    });
  });
  describe("isVoiceMessage", () => {
    it("should return true for voice message attachment", () => {
      const attachment = {
        fileName: "Voice Message.aac",
        flags: import_protobuf.SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
        data: stringToArrayBuffer("voice message"),
        contentType: MIME.AUDIO_AAC
      };
      import_chai.assert.isTrue(Attachment.isVoiceMessage(attachment));
    });
    it("should return true for legacy Android voice message attachment", () => {
      const attachment = {
        data: stringToArrayBuffer("voice message"),
        contentType: MIME.AUDIO_MP3
      };
      import_chai.assert.isTrue(Attachment.isVoiceMessage(attachment));
    });
    it("should return false for other attachments", () => {
      const attachment = {
        fileName: "foo.gif",
        data: stringToArrayBuffer("foo"),
        contentType: MIME.IMAGE_GIF
      };
      import_chai.assert.isFalse(Attachment.isVoiceMessage(attachment));
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC90eXBlcy9BdHRhY2htZW50X3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IGFzc2VydCB9IGZyb20gJ2NoYWknO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQnO1xuXG5pbXBvcnQgKiBhcyBBdHRhY2htZW50IGZyb20gJy4uLy4uL3R5cGVzL0F0dGFjaG1lbnQnO1xuaW1wb3J0ICogYXMgTUlNRSBmcm9tICcuLi8uLi90eXBlcy9NSU1FJztcbmltcG9ydCB7IFNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wcm90b2J1Zic7XG5cbmNvbnN0IHN0cmluZ1RvQXJyYXlCdWZmZXIgPSAoc3RyOiBzdHJpbmcpID0+IHtcbiAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIidzdHJpbmcnIG11c3QgYmUgYSBzdHJpbmdcIik7XG4gIH1cblxuICBjb25zdCBhcnJheSA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGgpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGFycmF5W2ldID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gIH1cbiAgcmV0dXJuIGFycmF5LmJ1ZmZlcjtcbn07XG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbWF4LWZ1bmMtYm9keS1sZW5ndGhcbmRlc2NyaWJlKCdBdHRhY2htZW50JywgKCkgPT4ge1xuICBkZXNjcmliZSgnZ2V0RmlsZUV4dGVuc2lvbicsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHJldHVybiBmaWxlIGV4dGVuc2lvbiBmcm9tIGNvbnRlbnQgdHlwZScsICgpID0+IHtcbiAgICAgIGNvbnN0IGlucHV0OiBBdHRhY2htZW50LkF0dGFjaG1lbnRUeXBlID0ge1xuICAgICAgICBmaWxlTmFtZTogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICB1cmw6ICdmdW5ueS1jYXQubW92JyxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuSU1BR0VfR0lGLFxuICAgICAgICBmaWxlU2l6ZTogbnVsbCxcbiAgICAgICAgc2NyZWVuc2hvdDogbnVsbCxcbiAgICAgICAgdGh1bWJuYWlsOiBudWxsLFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChBdHRhY2htZW50LmdldEZpbGVFeHRlbnNpb24oaW5wdXQpLCAnZ2lmJyk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBmaWxlIGV4dGVuc2lvbiBmb3IgUXVpY2tUaW1lIHZpZGVvcycsICgpID0+IHtcbiAgICAgIGNvbnN0IGlucHV0OiBBdHRhY2htZW50LkF0dGFjaG1lbnRUeXBlID0ge1xuICAgICAgICBmaWxlTmFtZTogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICB1cmw6ICdmdW5ueS1jYXQubW92JyxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuVklERU9fUVVJQ0tUSU1FLFxuICAgICAgICBmaWxlU2l6ZTogbnVsbCxcbiAgICAgICAgc2NyZWVuc2hvdDogbnVsbCxcbiAgICAgICAgdGh1bWJuYWlsOiBudWxsLFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChBdHRhY2htZW50LmdldEZpbGVFeHRlbnNpb24oaW5wdXQpLCAnbW92Jyk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBmaWxlIGV4dGVuc2lvbiBmb3IgYXBwbGljYXRpb24gZmlsZXMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBpbnB1dDogQXR0YWNobWVudC5BdHRhY2htZW50VHlwZSA9IHtcbiAgICAgICAgZmlsZU5hbWU6ICdmdW5ueS1jYXQub2R0JyxcbiAgICAgICAgdXJsOiAnZnVubnktY2F0Lm9kdCcsXG4gICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLk9EVCxcbiAgICAgICAgZmlsZVNpemU6IG51bGwsXG4gICAgICAgIHNjcmVlbnNob3Q6IG51bGwsXG4gICAgICAgIHRodW1ibmFpbDogbnVsbCxcbiAgICAgIH07XG4gICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoQXR0YWNobWVudC5nZXRGaWxlRXh0ZW5zaW9uKGlucHV0KSwgJ29kdCcpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnZ2V0U3VnZ2VzdGVkRmlsZW5hbWUnLCAoKSA9PiB7XG4gICAgY29udGV4dCgnZm9yIGF0dGFjaG1lbnQgd2l0aCBmaWxlbmFtZScsICgpID0+IHtcbiAgICAgIGl0KCdzaG91bGQgZ2VuZXJhdGUgYSBmaWxlbmFtZSB3aXRob3V0IHRpbWVzdGFtcCcsICgpID0+IHtcbiAgICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudC5BdHRhY2htZW50VHlwZSA9IHtcbiAgICAgICAgICBmaWxlTmFtZTogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIHVybDogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLlZJREVPX1FVSUNLVElNRSxcbiAgICAgICAgICBmaWxlU2l6ZTogbnVsbCxcbiAgICAgICAgICBzY3JlZW5zaG90OiBudWxsLFxuICAgICAgICAgIHRodW1ibmFpbDogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgYWN0dWFsID0gQXR0YWNobWVudC5nZXRTdWdnZXN0ZWRGaWxlbmFtZSh7IGF0dGFjaG1lbnQgfSk7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkID0gJ2Z1bm55LWNhdC5tb3YnO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgZ2VuZXJhdGUgYSBmaWxlbmFtZSB3aXRob3V0IHRpbWVzdGFtcCBidXQgd2l0aCBhbiBpbmRleCcsICgpID0+IHtcbiAgICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudC5BdHRhY2htZW50VHlwZSA9IHtcbiAgICAgICAgICBmaWxlTmFtZTogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIHVybDogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLlZJREVPX1FVSUNLVElNRSxcbiAgICAgICAgICBmaWxlU2l6ZTogbnVsbCxcbiAgICAgICAgICBzY3JlZW5zaG90OiBudWxsLFxuICAgICAgICAgIHRodW1ibmFpbDogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgYWN0dWFsID0gQXR0YWNobWVudC5nZXRTdWdnZXN0ZWRGaWxlbmFtZSh7XG4gICAgICAgICAgYXR0YWNobWVudCxcbiAgICAgICAgICBpbmRleDogMyxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkID0gJ2Z1bm55LWNhdC5tb3YnO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgZ2VuZXJhdGUgYSBmaWxlbmFtZSB3aXRoIGFuIGV4dGVuc2lvbiBpZiBjb250ZW50VHlwZSBpcyBub3Qgc2V0dXAnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQuQXR0YWNobWVudFR5cGUgPSB7XG4gICAgICAgICAgZmlsZU5hbWU6ICdmdW5ueS1jYXQuaW5pJyxcbiAgICAgICAgICB1cmw6ICdmdW5ueS1jYXQuaW5pJyxcbiAgICAgICAgICBjb250ZW50VHlwZTogJycsXG4gICAgICAgICAgZmlsZVNpemU6IG51bGwsXG4gICAgICAgICAgc2NyZWVuc2hvdDogbnVsbCxcbiAgICAgICAgICB0aHVtYm5haWw6IG51bGwsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGFjdHVhbCA9IEF0dGFjaG1lbnQuZ2V0U3VnZ2VzdGVkRmlsZW5hbWUoe1xuICAgICAgICAgIGF0dGFjaG1lbnQsXG4gICAgICAgICAgaW5kZXg6IDMsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9ICdmdW5ueS1jYXQuaW5pJztcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZ2VuZXJhdGUgYSBmaWxlbmFtZSB3aXRoIGFuIGV4dGVuc2lvbiBpZiBjb250ZW50VHlwZSBpcyB0ZXh0L3BsYWluJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnRUeXBlID0ge1xuICAgICAgICAgIGZpbGVOYW1lOiAnZnVubnktY2F0LnR4dCcsXG4gICAgICAgICAgdXJsOiAnZnVubnktY2F0LnR4dCcsXG4gICAgICAgICAgY29udGVudFR5cGU6ICd0ZXh0L3BsYWluJyxcbiAgICAgICAgICBmaWxlU2l6ZTogbnVsbCxcbiAgICAgICAgICBzY3JlZW5zaG90OiBudWxsLFxuICAgICAgICAgIHRodW1ibmFpbDogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgYWN0dWFsID0gQXR0YWNobWVudC5nZXRTdWdnZXN0ZWRGaWxlbmFtZSh7XG4gICAgICAgICAgYXR0YWNobWVudCxcbiAgICAgICAgICBpbmRleDogMyxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkID0gJ2Z1bm55LWNhdC50eHQnO1xuICAgICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgZ2VuZXJhdGUgYSBmaWxlbmFtZSB3aXRoIGFuIGV4dGVuc2lvbiBpZiBjb250ZW50VHlwZSBpcyBqc29uJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnRUeXBlID0ge1xuICAgICAgICAgIGZpbGVOYW1lOiAnZnVubnktY2F0Lmpzb24nLFxuICAgICAgICAgIHVybDogJ2Z1bm55LWNhdC5qc29uJyxcbiAgICAgICAgICBjb250ZW50VHlwZTogJycsXG4gICAgICAgICAgZmlsZVNpemU6IG51bGwsXG4gICAgICAgICAgc2NyZWVuc2hvdDogbnVsbCxcbiAgICAgICAgICB0aHVtYm5haWw6IG51bGwsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGFjdHVhbCA9IEF0dGFjaG1lbnQuZ2V0U3VnZ2VzdGVkRmlsZW5hbWUoe1xuICAgICAgICAgIGF0dGFjaG1lbnQsXG4gICAgICAgICAgaW5kZXg6IDMsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9ICdmdW5ueS1jYXQuanNvbic7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGNvbnRleHQoJ2ZvciBhdHRhY2htZW50IHdpdGhvdXQgZmlsZW5hbWUnLCAoKSA9PiB7XG4gICAgICBpdCgnc2hvdWxkIGdlbmVyYXRlIGEgZmlsZW5hbWUgYmFzZWQgb24gdGltZXN0YW1wJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnRUeXBlID0ge1xuICAgICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLlZJREVPX1FVSUNLVElNRSxcbiAgICAgICAgICB1cmw6ICdmdW5ueS1jYXQubW92JyxcbiAgICAgICAgICBmaWxlTmFtZTogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIGZpbGVTaXplOiBudWxsLFxuICAgICAgICAgIHNjcmVlbnNob3Q6IG51bGwsXG4gICAgICAgICAgdGh1bWJuYWlsOiBudWxsLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB0aW1lc3RhbXAgPSBtb21lbnQoJzIwMDAtMDEtMDEnKS50b0RhdGUoKTtcbiAgICAgICAgY29uc3QgYWN0dWFsID0gQXR0YWNobWVudC5nZXRTdWdnZXN0ZWRGaWxlbmFtZSh7XG4gICAgICAgICAgYXR0YWNobWVudCxcbiAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9ICdmdW5ueS1jYXQubW92JztcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgY29udGV4dCgnZm9yIGF0dGFjaG1lbnQgd2l0aCBpbmRleCcsICgpID0+IHtcbiAgICAgIGl0KCdzaG91bGQgZ2VuZXJhdGUgYSBmaWxlbmFtZSBiYXNlZCBvbiB0aW1lc3RhbXAgaWYgZmlsZW5hbWUgaXMgbm90IHNldCcsICgpID0+IHtcbiAgICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudC5BdHRhY2htZW50VHlwZSA9IHtcbiAgICAgICAgICBmaWxlTmFtZTogJycsXG4gICAgICAgICAgdXJsOiAnZnVubnktY2F0Lm1vdicsXG4gICAgICAgICAgY29udGVudFR5cGU6IE1JTUUuVklERU9fUVVJQ0tUSU1FLFxuICAgICAgICAgIGZpbGVTaXplOiBudWxsLFxuICAgICAgICAgIHNjcmVlbnNob3Q6IG51bGwsXG4gICAgICAgICAgdGh1bWJuYWlsOiBudWxsLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZShuZXcgRGF0ZSgwKS5nZXRUaW1lem9uZU9mZnNldCgpICogNjAgKiAxMDAwKTtcbiAgICAgICAgY29uc3QgYWN0dWFsID0gQXR0YWNobWVudC5nZXRTdWdnZXN0ZWRGaWxlbmFtZSh7XG4gICAgICAgICAgYXR0YWNobWVudCxcbiAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgaW5kZXg6IDMsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9ICdzZXNzaW9uLWF0dGFjaG1lbnQtMTk3MC0wMS0wMS0wMDAwMDBfMDAzLm1vdic7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGdlbmVyYXRlIGEgZmlsZW5hbWUgYmFzZWQgb24gZmlsZW5hbWUgaWYgcHJlc2VudCcsICgpID0+IHtcbiAgICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudC5BdHRhY2htZW50VHlwZSA9IHtcbiAgICAgICAgICBmaWxlTmFtZTogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIHVybDogJ2Z1bm55LWNhdC5tb3YnLFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLlZJREVPX1FVSUNLVElNRSxcbiAgICAgICAgICBmaWxlU2l6ZTogbnVsbCxcbiAgICAgICAgICBzY3JlZW5zaG90OiBudWxsLFxuICAgICAgICAgIHRodW1ibmFpbDogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUobmV3IERhdGUoMCkuZ2V0VGltZXpvbmVPZmZzZXQoKSAqIDYwICogMTAwMCk7XG4gICAgICAgIGNvbnN0IGFjdHVhbCA9IEF0dGFjaG1lbnQuZ2V0U3VnZ2VzdGVkRmlsZW5hbWUoe1xuICAgICAgICAgIGF0dGFjaG1lbnQsXG4gICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgIGluZGV4OiAzLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWQgPSAnZnVubnktY2F0Lm1vdic7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnaXNWaXN1YWxNZWRpYScsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHJldHVybiB0cnVlIGZvciBpbWFnZXMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnbWVtZS5naWYnLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCdnaWYnKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuSU1BR0VfR0lGLFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5pc1RydWUoQXR0YWNobWVudC5pc1Zpc3VhbE1lZGlhKGF0dGFjaG1lbnQpKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUgZm9yIHZpZGVvcycsICgpID0+IHtcbiAgICAgIGNvbnN0IGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQuQXR0YWNobWVudCA9IHtcbiAgICAgICAgZmlsZU5hbWU6ICdtZW1lLm1wNCcsXG4gICAgICAgIGRhdGE6IHN0cmluZ1RvQXJyYXlCdWZmZXIoJ21wNCcpLFxuICAgICAgICBjb250ZW50VHlwZTogTUlNRS5WSURFT19NUDQsXG4gICAgICB9O1xuICAgICAgYXNzZXJ0LmlzVHJ1ZShBdHRhY2htZW50LmlzVmlzdWFsTWVkaWEoYXR0YWNobWVudCkpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gZmFsc2UgZm9yIHZvaWNlIG1lc3NhZ2UgYXR0YWNobWVudCcsICgpID0+IHtcbiAgICAgIGNvbnN0IGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQuQXR0YWNobWVudCA9IHtcbiAgICAgICAgZmlsZU5hbWU6ICdWb2ljZSBNZXNzYWdlLmFhYycsXG4gICAgICAgIGZsYWdzOiBTaWduYWxTZXJ2aWNlLkF0dGFjaG1lbnRQb2ludGVyLkZsYWdzLlZPSUNFX01FU1NBR0UsXG4gICAgICAgIGRhdGE6IHN0cmluZ1RvQXJyYXlCdWZmZXIoJ3ZvaWNlIG1lc3NhZ2UnKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuQVVESU9fQUFDLFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5pc0ZhbHNlKEF0dGFjaG1lbnQuaXNWaXN1YWxNZWRpYShhdHRhY2htZW50KSk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBmYWxzZSBmb3Igb3RoZXIgYXR0YWNobWVudHMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnZm9vLmpzb24nLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCd7XCJmb29cIjogXCJiYXJcIn0nKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuQVBQTElDQVRJT05fSlNPTixcbiAgICAgIH07XG4gICAgICBhc3NlcnQuaXNGYWxzZShBdHRhY2htZW50LmlzVmlzdWFsTWVkaWEoYXR0YWNobWVudCkpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnaXNGaWxlJywgKCkgPT4ge1xuICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUgZm9yIEpTT04nLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnZm9vLmpzb24nLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCd7XCJmb29cIjogXCJiYXJcIn0nKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuQVBQTElDQVRJT05fSlNPTixcbiAgICAgIH07XG4gICAgICBhc3NlcnQuaXNUcnVlKEF0dGFjaG1lbnQuaXNGaWxlKGF0dGFjaG1lbnQpKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlIGZvciBpbWFnZXMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnbWVtZS5naWYnLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCdnaWYnKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuSU1BR0VfR0lGLFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5pc0ZhbHNlKEF0dGFjaG1lbnQuaXNGaWxlKGF0dGFjaG1lbnQpKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlIGZvciB2aWRlb3MnLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnbWVtZS5tcDQnLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCdtcDQnKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuVklERU9fTVA0LFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5pc0ZhbHNlKEF0dGFjaG1lbnQuaXNGaWxlKGF0dGFjaG1lbnQpKTtcbiAgICB9KTtcblxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlIGZvciB2b2ljZSBtZXNzYWdlIGF0dGFjaG1lbnQnLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnVm9pY2UgTWVzc2FnZS5hYWMnLFxuICAgICAgICBmbGFnczogU2lnbmFsU2VydmljZS5BdHRhY2htZW50UG9pbnRlci5GbGFncy5WT0lDRV9NRVNTQUdFLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCd2b2ljZSBtZXNzYWdlJyksXG4gICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLkFVRElPX0FBQyxcbiAgICAgIH07XG4gICAgICBhc3NlcnQuaXNGYWxzZShBdHRhY2htZW50LmlzRmlsZShhdHRhY2htZW50KSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdpc1ZvaWNlTWVzc2FnZScsICgpID0+IHtcbiAgICBpdCgnc2hvdWxkIHJldHVybiB0cnVlIGZvciB2b2ljZSBtZXNzYWdlIGF0dGFjaG1lbnQnLCAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50LkF0dGFjaG1lbnQgPSB7XG4gICAgICAgIGZpbGVOYW1lOiAnVm9pY2UgTWVzc2FnZS5hYWMnLFxuICAgICAgICBmbGFnczogU2lnbmFsU2VydmljZS5BdHRhY2htZW50UG9pbnRlci5GbGFncy5WT0lDRV9NRVNTQUdFLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCd2b2ljZSBtZXNzYWdlJyksXG4gICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLkFVRElPX0FBQyxcbiAgICAgIH07XG4gICAgICBhc3NlcnQuaXNUcnVlKEF0dGFjaG1lbnQuaXNWb2ljZU1lc3NhZ2UoYXR0YWNobWVudCkpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gdHJ1ZSBmb3IgbGVnYWN5IEFuZHJvaWQgdm9pY2UgbWVzc2FnZSBhdHRhY2htZW50JywgKCkgPT4ge1xuICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudC5BdHRhY2htZW50ID0ge1xuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCd2b2ljZSBtZXNzYWdlJyksXG4gICAgICAgIGNvbnRlbnRUeXBlOiBNSU1FLkFVRElPX01QMyxcbiAgICAgIH07XG4gICAgICBhc3NlcnQuaXNUcnVlKEF0dGFjaG1lbnQuaXNWb2ljZU1lc3NhZ2UoYXR0YWNobWVudCkpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gZmFsc2UgZm9yIG90aGVyIGF0dGFjaG1lbnRzJywgKCkgPT4ge1xuICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudC5BdHRhY2htZW50ID0ge1xuICAgICAgICBmaWxlTmFtZTogJ2Zvby5naWYnLFxuICAgICAgICBkYXRhOiBzdHJpbmdUb0FycmF5QnVmZmVyKCdmb28nKSxcbiAgICAgICAgY29udGVudFR5cGU6IE1JTUUuSU1BR0VfR0lGLFxuICAgICAgfTtcbiAgICAgIGFzc2VydC5pc0ZhbHNlKEF0dGFjaG1lbnQuaXNWb2ljZU1lc3NhZ2UoYXR0YWNobWVudCkpO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGtCQUF1QjtBQUN2QixvQkFBbUI7QUFFbkIsaUJBQTRCO0FBQzVCLFdBQXNCO0FBQ3RCLHNCQUE4QjtBQUU5QixNQUFNLHNCQUFzQix3QkFBQyxRQUFnQjtBQUMzQyxNQUFJLE9BQU8sUUFBUSxV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
