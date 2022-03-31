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
var pubkey_exports = {};
__export(pubkey_exports, {
  generateFakeECKeyPair: () => generateFakeECKeyPair,
  generateFakePubKey: () => generateFakePubKey,
  generateFakePubKeyStr: () => generateFakePubKeyStr,
  generateFakePubKeys: () => generateFakePubKeys,
  generateFakeSnode: () => generateFakeSnode,
  generateFakeSnodeWithEdKey: () => generateFakeSnodeWithEdKey,
  generateFakeSnodes: () => generateFakeSnodes
});
module.exports = __toCommonJS(pubkey_exports);
var crypto = __toESM(require("crypto"));
var import_lodash = __toESM(require("lodash"));
var import_keypairs = require("../../../receiver/keypairs");
var import_types = require("../../../session/types");
function generateFakePubKey() {
  const numBytes = import_types.PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString("hex");
  const pubkeyString = `05${hexBuffer}`;
  return new import_types.PubKey(pubkeyString);
}
function generateFakePubKeyStr() {
  const numBytes = import_types.PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString("hex");
  const pubkeyString = `05${hexBuffer}`;
  return pubkeyString;
}
function generateFakeECKeyPair() {
  const pubkey = generateFakePubKey().toArray();
  const privKey = new Uint8Array(crypto.randomBytes(64));
  return new import_keypairs.ECKeyPair(pubkey, privKey);
}
function generateFakePubKeys(amount) {
  const numPubKeys = amount > 0 ? Math.floor(amount) : 0;
  return new Array(numPubKeys).fill(0).map(() => generateFakePubKey());
}
function generateFakeSnode() {
  return {
    ip: `136.243.${Math.random() * 255}.${Math.random() * 255}`,
    port: 22116,
    pubkey_x25519: generateFakePubKeyStr(),
    pubkey_ed25519: generateFakePubKeyStr()
  };
}
function generateFakeSnodeWithEdKey(ed25519Pubkey) {
  return {
    ip: `136.243.${Math.random() * 255}.${Math.random() * 255}`,
    port: 22116,
    pubkey_x25519: generateFakePubKeyStr(),
    pubkey_ed25519: ed25519Pubkey
  };
}
function generateFakeSnodes(amount) {
  const ar = import_lodash.default.times(amount, generateFakeSnode);
  return ar;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateFakeECKeyPair,
  generateFakePubKey,
  generateFakePubKeyStr,
  generateFakePubKeys,
  generateFakeSnode,
  generateFakeSnodeWithEdKey,
  generateFakeSnodes
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vdHMvdGVzdC90ZXN0LXV0aWxzL3V0aWxzL3B1YmtleS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgU25vZGUgfSBmcm9tICcuLi8uLi8uLi9kYXRhL2RhdGEnO1xuaW1wb3J0IHsgRUNLZXlQYWlyIH0gZnJvbSAnLi4vLi4vLi4vcmVjZWl2ZXIva2V5cGFpcnMnO1xuaW1wb3J0IHsgUHViS2V5IH0gZnJvbSAnLi4vLi4vLi4vc2Vzc2lvbi90eXBlcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUZha2VQdWJLZXkoKTogUHViS2V5IHtcbiAgLy8gR2VuZXJhdGVzIGEgbW9jayBwdWJrZXkgZm9yIHRlc3RpbmdcbiAgY29uc3QgbnVtQnl0ZXMgPSBQdWJLZXkuUFVCS0VZX0xFTiAvIDIgLSAxO1xuICBjb25zdCBoZXhCdWZmZXIgPSBjcnlwdG8ucmFuZG9tQnl0ZXMobnVtQnl0ZXMpLnRvU3RyaW5nKCdoZXgnKTtcbiAgY29uc3QgcHVia2V5U3RyaW5nID0gYDA1JHtoZXhCdWZmZXJ9YDtcblxuICByZXR1cm4gbmV3IFB1YktleShwdWJrZXlTdHJpbmcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVGYWtlUHViS2V5U3RyKCk6IHN0cmluZyB7XG4gIC8vIEdlbmVyYXRlcyBhIG1vY2sgcHVia2V5IGZvciB0ZXN0aW5nXG4gIGNvbnN0IG51bUJ5dGVzID0gUHViS2V5LlBVQktFWV9MRU4gLyAyIC0gMTtcbiAgY29uc3QgaGV4QnVmZmVyID0gY3J5cHRvLnJhbmRvbUJ5dGVzKG51bUJ5dGVzKS50b1N0cmluZygnaGV4Jyk7XG4gIGNvbnN0IHB1YmtleVN0cmluZyA9IGAwNSR7aGV4QnVmZmVyfWA7XG5cbiAgcmV0dXJuIHB1YmtleVN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRmFrZUVDS2V5UGFpcigpOiBFQ0tleVBhaXIge1xuICBjb25zdCBwdWJrZXkgPSBnZW5lcmF0ZUZha2VQdWJLZXkoKS50b0FycmF5KCk7XG4gIGNvbnN0IHByaXZLZXkgPSBuZXcgVWludDhBcnJheShjcnlwdG8ucmFuZG9tQnl0ZXMoNjQpKTtcbiAgcmV0dXJuIG5ldyBFQ0tleVBhaXIocHVia2V5LCBwcml2S2V5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRmFrZVB1YktleXMoYW1vdW50OiBudW1iZXIpOiBBcnJheTxQdWJLZXk+IHtcbiAgY29uc3QgbnVtUHViS2V5cyA9IGFtb3VudCA+IDAgPyBNYXRoLmZsb29yKGFtb3VudCkgOiAwO1xuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8tdW5uZWNlc3NhcnktY2FsbGJhY2std3JhcHBlclxuICByZXR1cm4gbmV3IEFycmF5KG51bVB1YktleXMpLmZpbGwoMCkubWFwKCgpID0+IGdlbmVyYXRlRmFrZVB1YktleSgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRmFrZVNub2RlKCk6IFNub2RlIHtcbiAgcmV0dXJuIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZTogaW5zZWN1cmUtcmFuZG9tXG4gICAgaXA6IGAxMzYuMjQzLiR7TWF0aC5yYW5kb20oKSAqIDI1NX0uJHtNYXRoLnJhbmRvbSgpICogMjU1fWAsXG4gICAgcG9ydDogMjIxMTYsXG4gICAgcHVia2V5X3gyNTUxOTogZ2VuZXJhdGVGYWtlUHViS2V5U3RyKCksXG4gICAgcHVia2V5X2VkMjU1MTk6IGdlbmVyYXRlRmFrZVB1YktleVN0cigpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVGYWtlU25vZGVXaXRoRWRLZXkoZWQyNTUxOVB1YmtleTogc3RyaW5nKTogU25vZGUge1xuICByZXR1cm4ge1xuICAgIGlwOiBgMTM2LjI0My4ke01hdGgucmFuZG9tKCkgKiAyNTV9LiR7TWF0aC5yYW5kb20oKSAqIDI1NX1gLFxuICAgIHBvcnQ6IDIyMTE2LFxuICAgIHB1YmtleV94MjU1MTk6IGdlbmVyYXRlRmFrZVB1YktleVN0cigpLFxuICAgIHB1YmtleV9lZDI1NTE5OiBlZDI1NTE5UHVia2V5LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVGYWtlU25vZGVzKGFtb3VudDogbnVtYmVyKTogQXJyYXk8U25vZGU+IHtcbiAgY29uc3QgYXI6IEFycmF5PFNub2RlPiA9IF8udGltZXMoYW1vdW50LCBnZW5lcmF0ZUZha2VTbm9kZSk7XG4gIHJldHVybiBhcjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUF3QjtBQUN4QixvQkFBYztBQUVkLHNCQUEwQjtBQUMxQixtQkFBdUI7QUFFaEIsOEJBQXNDO0FBRTNDLFFBQU0sV0FBVyxvQkFBTyxhQUFhLElBQUk7QUFDekMsUUFBTSxZQUFZLE9BQU8sWUFBWSxRQUFRLEVBQUUsU0FBUyxLQUFLO0FBQzdELFFBQU0sZUFBZSxLQUFLO0FBRTFCLFNBQU8sSUFBSSxvQkFBTyxZQUFZO0FBQ2hDO0FBUGdCLEFBU1QsaUNBQXlDO0FBRTlDLFFBQU0sV0FBVyxvQkFBTyxhQUFhLElBQUk7QUFDekMsUUFBTSxZQUFZLE9BQU8sWUFBWSxRQUFRLEVBQUUsU0FBUyxLQUFLO0FBQzdELFFBQU0sZUFBZSxLQUFLO0FBRTFCLFNBQU87QUFDVDtBQVBnQixBQVNULGlDQUE0QztBQUNqRCxRQUFNLFNBQVMsbUJBQW1CLEVBQUUsUUFBUTtBQUM1QyxRQUFNLFVBQVUsSUFBSSxXQUFXLE9BQU8sWUFBWSxFQUFFLENBQUM7QUFDckQsU0FBTyxJQUFJLDBCQUFVLFFBQVEsT0FBTztBQUN0QztBQUpnQixBQU1ULDZCQUE2QixRQUErQjtBQUNqRSxRQUFNLGFBQWEsU0FBUyxJQUFJLEtBQUssTUFBTSxNQUFNLElBQUk7QUFHckQsU0FBTyxJQUFJLE1BQU0sVUFBVSxFQUFFLEtBQUssQ0FBQyxFQUFFLElBQUksTUFBTSxtQkFBbUIsQ0FBQztBQUNyRTtBQUxnQixBQU9ULDZCQUFvQztBQUN6QyxTQUFPO0FBQUEsSUFFTCxJQUFJLFdBQVcsS0FBSyxPQUFPLElBQUksT0FBTyxLQUFLLE9BQU8sSUFBSTtBQUFBLElBQ3RELE1BQU07QUFBQSxJQUNOLGVBQWUsc0JBQXNCO0FBQUEsSUFDckMsZ0JBQWdCLHNCQUFzQjtBQUFBLEVBQ3hDO0FBQ0Y7QUFSZ0IsQUFVVCxvQ0FBb0MsZUFBOEI7QUFDdkUsU0FBTztBQUFBLElBQ0wsSUFBSSxXQUFXLEtBQUssT0FBTyxJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUk7QUFBQSxJQUN0RCxNQUFNO0FBQUEsSUFDTixlQUFlLHNCQUFzQjtBQUFBLElBQ3JDLGdCQUFnQjtBQUFBLEVBQ2xCO0FBQ0Y7QUFQZ0IsQUFTVCw0QkFBNEIsUUFBOEI7QUFDL0QsUUFBTSxLQUFtQixzQkFBRSxNQUFNLFFBQVEsaUJBQWlCO0FBQzFELFNBQU87QUFDVDtBQUhnQiIsCiAgIm5hbWVzIjogW10KfQo=
