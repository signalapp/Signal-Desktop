var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var import_chai = __toESM(require("chai"));
var import_mocha = require("mocha");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
var import_BufferPadding = require("../../../../session/crypto/BufferPadding");
import_chai.default.use(import_chai_as_promised.default);
import_chai.default.should();
const { expect } = import_chai.default;
(0, import_mocha.describe)("Padding", () => {
  (0, import_mocha.describe)("Attachment padding", () => {
    it("add padding", () => {
      const bufferIn = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const paddedBuffer = (0, import_BufferPadding.addAttachmentPadding)(bufferIn);
      expect(paddedBuffer.byteLength).to.equal(541);
      expect(new Uint8Array(paddedBuffer.slice(0, bufferIn.length))).to.equalBytes(bufferIn);
      expect(new Uint8Array(paddedBuffer.slice(bufferIn.length))).to.equalBytes(new Uint8Array(541 - bufferIn.length));
    });
    it("remove padding", () => {
      const expectedSize = 10;
      const paddedBuffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 5]);
      const paddingRemoveBuffer = (0, import_BufferPadding.getUnpaddedAttachment)(paddedBuffer, expectedSize);
      expect(paddingRemoveBuffer == null ? void 0 : paddingRemoveBuffer.byteLength).to.equal(expectedSize);
      expect(paddingRemoveBuffer).to.equalBytes(paddedBuffer.slice(0, expectedSize));
    });
  });
  (0, import_mocha.describe)("Message padding", () => {
    it("add padding", () => {
      const bufferIn = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const paddedMessage = (0, import_BufferPadding.addMessagePadding)(bufferIn);
      expect(paddedMessage.byteLength).to.equal(159);
      expect(new Uint8Array(paddedMessage.slice(0, bufferIn.length))).to.equalBytes(bufferIn);
      expect(paddedMessage[bufferIn.length]).to.equal(128);
      expect(new Uint8Array(paddedMessage.slice(bufferIn.length + 1))).to.equalBytes(new Uint8Array(159 - bufferIn.length - 1));
    });
    it("remove padding", () => {
      const expectedSize = 10;
      const paddedBuffer = new Uint8Array([
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        128,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]);
      const unpaddedMessage = (0, import_BufferPadding.removeMessagePadding)(paddedBuffer);
      expect(unpaddedMessage == null ? void 0 : unpaddedMessage.byteLength).to.equal(expectedSize);
      expect(new Uint8Array(unpaddedMessage)).to.equalBytes(paddedBuffer.slice(0, expectedSize));
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvcGFkZGluZy9QYWRkaW5nX3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHRzbGludDpkaXNhYmxlOiBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXMgbWF4LWZ1bmMtYm9keS1sZW5ndGggbm8tdW51c2VkLWV4cHJlc3Npb25cblxuaW1wb3J0IGNoYWkgZnJvbSAnY2hhaSc7XG5pbXBvcnQgeyBkZXNjcmliZSB9IGZyb20gJ21vY2hhJztcblxuaW1wb3J0IGNoYWlBc1Byb21pc2VkIGZyb20gJ2NoYWktYXMtcHJvbWlzZWQnO1xuaW1wb3J0IHtcbiAgYWRkQXR0YWNobWVudFBhZGRpbmcsXG4gIGFkZE1lc3NhZ2VQYWRkaW5nLFxuICBnZXRVbnBhZGRlZEF0dGFjaG1lbnQsXG4gIHJlbW92ZU1lc3NhZ2VQYWRkaW5nLFxufSBmcm9tICcuLi8uLi8uLi8uLi9zZXNzaW9uL2NyeXB0by9CdWZmZXJQYWRkaW5nJztcbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkIGFzIGFueSk7XG5jaGFpLnNob3VsZCgpO1xuXG5jb25zdCB7IGV4cGVjdCB9ID0gY2hhaTtcblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBtYXgtZnVuYy1ib2R5LWxlbmd0aFxuZGVzY3JpYmUoJ1BhZGRpbmcnLCAoKSA9PiB7XG4gIGRlc2NyaWJlKCdBdHRhY2htZW50IHBhZGRpbmcnLCAoKSA9PiB7XG4gICAgaXQoJ2FkZCBwYWRkaW5nJywgKCkgPT4ge1xuICAgICAgY29uc3QgYnVmZmVySW4gPSBuZXcgVWludDhBcnJheShbMCwgMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOV0pO1xuXG4gICAgICBjb25zdCBwYWRkZWRCdWZmZXIgPSBhZGRBdHRhY2htZW50UGFkZGluZyhidWZmZXJJbik7XG4gICAgICBleHBlY3QocGFkZGVkQnVmZmVyLmJ5dGVMZW5ndGgpLnRvLmVxdWFsKDU0MSk7XG4gICAgICBleHBlY3QobmV3IFVpbnQ4QXJyYXkocGFkZGVkQnVmZmVyLnNsaWNlKDAsIGJ1ZmZlckluLmxlbmd0aCkpKS50by5lcXVhbEJ5dGVzKGJ1ZmZlckluKTtcbiAgICAgIC8vIHRoaXMgbWFrZXMgc3VyZSB0aGF0IHRoZSBwYWRkaW5nIGlzIGp1c3QgdGhlIDAgYnl0ZXNcbiAgICAgIGV4cGVjdChuZXcgVWludDhBcnJheShwYWRkZWRCdWZmZXIuc2xpY2UoYnVmZmVySW4ubGVuZ3RoKSkpLnRvLmVxdWFsQnl0ZXMoXG4gICAgICAgIG5ldyBVaW50OEFycmF5KDU0MSAtIGJ1ZmZlckluLmxlbmd0aClcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpdCgncmVtb3ZlIHBhZGRpbmcnLCAoKSA9PiB7XG4gICAgICAvLyBwYWRkaW5nIGNhbiBiZSBhbnl0aGluZyBhZnRlciB0aGUgZXhwZWN0ZWQgc2l6ZVxuICAgICAgY29uc3QgZXhwZWN0ZWRTaXplID0gMTA7XG4gICAgICBjb25zdCBwYWRkZWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShbMCwgMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOSwgMCwgMSwgMiwgMywgNCwgNSwgNV0pO1xuXG4gICAgICBjb25zdCBwYWRkaW5nUmVtb3ZlQnVmZmVyID0gZ2V0VW5wYWRkZWRBdHRhY2htZW50KHBhZGRlZEJ1ZmZlciwgZXhwZWN0ZWRTaXplKTtcblxuICAgICAgZXhwZWN0KHBhZGRpbmdSZW1vdmVCdWZmZXI/LmJ5dGVMZW5ndGgpLnRvLmVxdWFsKGV4cGVjdGVkU2l6ZSk7XG4gICAgICBleHBlY3QocGFkZGluZ1JlbW92ZUJ1ZmZlcikudG8uZXF1YWxCeXRlcyhwYWRkZWRCdWZmZXIuc2xpY2UoMCwgZXhwZWN0ZWRTaXplKSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdNZXNzYWdlIHBhZGRpbmcnLCAoKSA9PiB7XG4gICAgaXQoJ2FkZCBwYWRkaW5nJywgKCkgPT4ge1xuICAgICAgY29uc3QgYnVmZmVySW4gPSBuZXcgVWludDhBcnJheShbMCwgMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOV0pO1xuXG4gICAgICBjb25zdCBwYWRkZWRNZXNzYWdlID0gYWRkTWVzc2FnZVBhZGRpbmcoYnVmZmVySW4pO1xuICAgICAgZXhwZWN0KHBhZGRlZE1lc3NhZ2UuYnl0ZUxlbmd0aCkudG8uZXF1YWwoMTU5KTtcbiAgICAgIC8vIGZvciBtZXNzYWdlIHBhZGRpbmcsIHdlIGhhdmUgW2J1ZmZlckluLCAweDgwLCAweDAwLCAweDAwLCAweDAwLCAuLi5dXG4gICAgICBleHBlY3QobmV3IFVpbnQ4QXJyYXkocGFkZGVkTWVzc2FnZS5zbGljZSgwLCBidWZmZXJJbi5sZW5ndGgpKSkudG8uZXF1YWxCeXRlcyhidWZmZXJJbik7XG4gICAgICBleHBlY3QocGFkZGVkTWVzc2FnZVtidWZmZXJJbi5sZW5ndGhdKS50by5lcXVhbCgweDgwKTtcbiAgICAgIC8vIHRoaXMgbWFrZXMgc3VyZSB0aGF0IHRoZSBwYWRkaW5nIGlzIGp1c3QgdGhlIDAgYnl0ZXNcbiAgICAgIGV4cGVjdChuZXcgVWludDhBcnJheShwYWRkZWRNZXNzYWdlLnNsaWNlKGJ1ZmZlckluLmxlbmd0aCArIDEpKSkudG8uZXF1YWxCeXRlcyhcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoMTU5IC0gYnVmZmVySW4ubGVuZ3RoIC0gMSlcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpdCgncmVtb3ZlIHBhZGRpbmcnLCAoKSA9PiB7XG4gICAgICBjb25zdCBleHBlY3RlZFNpemUgPSAxMDtcbiAgICAgIGNvbnN0IHBhZGRlZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMCxcbiAgICAgICAgMSxcbiAgICAgICAgMixcbiAgICAgICAgMyxcbiAgICAgICAgNCxcbiAgICAgICAgNSxcbiAgICAgICAgNixcbiAgICAgICAgNyxcbiAgICAgICAgOCxcbiAgICAgICAgOSxcbiAgICAgICAgMTI4LFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgICAwLFxuICAgICAgXSk7XG5cbiAgICAgIGNvbnN0IHVucGFkZGVkTWVzc2FnZSA9IHJlbW92ZU1lc3NhZ2VQYWRkaW5nKHBhZGRlZEJ1ZmZlcik7XG4gICAgICAvLyBmb3IgbWVzc2FnZSBwYWRkaW5nLCB3ZSBoYXZlIFtwYWRkZWRCdWZmZXIsIDB4ODAsIDB4MDAsIDB4MDAsIDB4MDAsIC4uLl1cbiAgICAgIGV4cGVjdCh1bnBhZGRlZE1lc3NhZ2U/LmJ5dGVMZW5ndGgpLnRvLmVxdWFsKGV4cGVjdGVkU2l6ZSk7XG4gICAgICBleHBlY3QobmV3IFVpbnQ4QXJyYXkodW5wYWRkZWRNZXNzYWdlKSkudG8uZXF1YWxCeXRlcyhwYWRkZWRCdWZmZXIuc2xpY2UoMCwgZXhwZWN0ZWRTaXplKSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7QUFFQSxrQkFBaUI7QUFDakIsbUJBQXlCO0FBRXpCLDhCQUEyQjtBQUMzQiwyQkFLTztBQUNQLG9CQUFLLElBQUksK0JBQXFCO0FBQzlCLG9CQUFLLE9BQU87QUFFWixNQUFNLEVBQUUsV0FBVztBQUduQiwyQkFBUyxXQUFXLE1BQU07QUFDeEIsNkJBQVMsc0JBQXNCLE1BQU07QUFDbkMsT0FBRyxlQUFlLE1BQU07QUFDdEIsWUFBTSxXQUFXLElBQUksV0FBVyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUU5RCxZQUFNLGVBQWUsK0NBQXFCLFFBQVE7QUFDbEQsYUFBTyxhQUFhLFVBQVUsRUFBRSxHQUFHLE1BQU0sR0FBRztBQUM1QyxhQUFPLElBQUksV0FBVyxhQUFhLE1BQU0sR0FBRyxTQUFTLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxXQUFXLFFBQVE7QUFFckYsYUFBTyxJQUFJLFdBQVcsYUFBYSxNQUFNLFNBQVMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLFdBQzdELElBQUksV0FBVyxNQUFNLFNBQVMsTUFBTSxDQUN0QztBQUFBLElBQ0YsQ0FBQztBQUVELE9BQUcsa0JBQWtCLE1BQU07QUFFekIsWUFBTSxlQUFlO0FBQ3JCLFlBQU0sZUFBZSxJQUFJLFdBQVcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUV2RixZQUFNLHNCQUFzQixnREFBc0IsY0FBYyxZQUFZO0FBRTVFLGFBQU8sMkRBQXFCLFVBQVUsRUFBRSxHQUFHLE1BQU0sWUFBWTtBQUM3RCxhQUFPLG1CQUFtQixFQUFFLEdBQUcsV0FBVyxhQUFhLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxJQUMvRSxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsNkJBQVMsbUJBQW1CLE1BQU07QUFDaEMsT0FBRyxlQUFlLE1BQU07QUFDdEIsWUFBTSxXQUFXLElBQUksV0FBVyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUU5RCxZQUFNLGdCQUFnQiw0Q0FBa0IsUUFBUTtBQUNoRCxhQUFPLGNBQWMsVUFBVSxFQUFFLEdBQUcsTUFBTSxHQUFHO0FBRTdDLGFBQU8sSUFBSSxXQUFXLGNBQWMsTUFBTSxHQUFHLFNBQVMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLFdBQVcsUUFBUTtBQUN0RixhQUFPLGNBQWMsU0FBUyxPQUFPLEVBQUUsR0FBRyxNQUFNLEdBQUk7QUFFcEQsYUFBTyxJQUFJLFdBQVcsY0FBYyxNQUFNLFNBQVMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsV0FDbEUsSUFBSSxXQUFXLE1BQU0sU0FBUyxTQUFTLENBQUMsQ0FDMUM7QUFBQSxJQUNGLENBQUM7QUFFRCxPQUFHLGtCQUFrQixNQUFNO0FBQ3pCLFlBQU0sZUFBZTtBQUNyQixZQUFNLGVBQWUsSUFBSSxXQUFXO0FBQUEsUUFDbEM7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGLENBQUM7QUFFRCxZQUFNLGtCQUFrQiwrQ0FBcUIsWUFBWTtBQUV6RCxhQUFPLG1EQUFpQixVQUFVLEVBQUUsR0FBRyxNQUFNLFlBQVk7QUFDekQsYUFBTyxJQUFJLFdBQVcsZUFBZSxDQUFDLEVBQUUsR0FBRyxXQUFXLGFBQWEsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLElBQzNGLENBQUM7QUFBQSxFQUNILENBQUM7QUFDSCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
