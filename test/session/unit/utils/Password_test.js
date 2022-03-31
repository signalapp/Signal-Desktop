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
var import_chai = require("chai");
var PasswordUtil = __toESM(require("../../../../util/passwordUtils"));
describe("Password Util", () => {
  describe("hash generation", () => {
    it("generates the same hash for the same phrase", () => {
      const first = PasswordUtil.generateHash("phrase");
      const second = PasswordUtil.generateHash("phrase");
      import_chai.assert.strictEqual(first, second);
    });
    it("generates different hashes for different phrases", () => {
      const first = PasswordUtil.generateHash("0");
      const second = PasswordUtil.generateHash("1");
      import_chai.assert.notStrictEqual(first, second);
    });
  });
  describe("hash matching", () => {
    it("returns true for the same hash", () => {
      const phrase = "phrase";
      const hash = PasswordUtil.generateHash(phrase);
      import_chai.assert.isTrue(PasswordUtil.matchesHash(phrase, hash));
    });
    it("returns false for different hashes", () => {
      const hash = PasswordUtil.generateHash("phrase");
      import_chai.assert.isFalse(PasswordUtil.matchesHash("phrase2", hash));
    });
  });
  describe("password validation", () => {
    it("should return nothing if password is valid", () => {
      const valid = [
        "123456",
        "1a5b3C6g",
        ")CZcy@ccHa",
        "C$D--M;Xv+",
        "X8-;!47IW|",
        "Oi74ZpoSx,p",
        ">]K1*g^swHW0]F6}{",
        "TiJf@lk^jsO^z8MUn%)[Sd~UPQ)ci9CGS@jb<^",
        "$u&%{r]apg#G@3dQdCkB_p8)gxhNFr=K&yfM_M8O&2Z.vQyvx",
        "bf^OMnYku*iX;{Piw_0zvz",
        "@@@@/???\\4545",
        "#".repeat(50)
      ];
      valid.forEach((pass) => {
        import_chai.assert.isNull(PasswordUtil.validatePassword(pass));
      });
    });
    it("should return an error if password is not a string", () => {
      const invalid = [0, 123456, [], {}, null, void 0];
      invalid.forEach((pass) => {
        import_chai.assert.strictEqual(PasswordUtil.validatePassword(pass), "Password must be a string");
      });
    });
    it("should return an error if password is not between 6 and 64 characters", () => {
      const invalid = ["a", "abcde", "#".repeat(65), "#".repeat(100)];
      invalid.forEach((pass) => {
        import_chai.assert.strictEqual(PasswordUtil.validatePassword(pass), "Password must be between 6 and 64 characters long");
      });
    });
    it("should return an error if password has invalid characters", () => {
      const invalid = [
        "\u028D\u02AA\u05813W\u036A\u074Cb\u0389f",
        ")\xC9{b)\u034E\xD4\u0229\u049C\u0663",
        "\u07D3\u0711\u02FFG\u0596=3\xA4)P",
        "\u0774`\u051Af\u012C8\u04DDrH(",
        "e\u0339\u03C9\u037B\u073A\u022C\u06FA#d\u04C4",
        "\u8C00\uB93C\u7B4E\u7B1F\uA145\uF9DA\u5855\uCE74\uAB74\uEBC0",
        "\u4FC8\uA6F7\u0FE9\u8FED\u4C21\u9491\uB7ED\u46E9\u929B\uB919",
        "\uBD1F\u325F\u24D3\u0F2D\uAF6B\u32A1\u4DB7\uC4A8\u2EEF\u98B0",
        "<@\u0226\u0198\u0389\u0648\u06C9a\u048B<"
      ];
      invalid.forEach((pass) => {
        import_chai.assert.strictEqual(PasswordUtil.validatePassword(pass), "Password must only contain letters, numbers and symbols");
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvdXRpbHMvUGFzc3dvcmRfdGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSAnY2hhaSc7XG5pbXBvcnQgKiBhcyBQYXNzd29yZFV0aWwgZnJvbSAnLi4vLi4vLi4vLi4vdXRpbC9wYXNzd29yZFV0aWxzJztcblxuZGVzY3JpYmUoJ1Bhc3N3b3JkIFV0aWwnLCAoKSA9PiB7XG4gIGRlc2NyaWJlKCdoYXNoIGdlbmVyYXRpb24nLCAoKSA9PiB7XG4gICAgaXQoJ2dlbmVyYXRlcyB0aGUgc2FtZSBoYXNoIGZvciB0aGUgc2FtZSBwaHJhc2UnLCAoKSA9PiB7XG4gICAgICBjb25zdCBmaXJzdCA9IFBhc3N3b3JkVXRpbC5nZW5lcmF0ZUhhc2goJ3BocmFzZScpO1xuICAgICAgY29uc3Qgc2Vjb25kID0gUGFzc3dvcmRVdGlsLmdlbmVyYXRlSGFzaCgncGhyYXNlJyk7XG4gICAgICBhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QsIHNlY29uZCk7XG4gICAgfSk7XG4gICAgaXQoJ2dlbmVyYXRlcyBkaWZmZXJlbnQgaGFzaGVzIGZvciBkaWZmZXJlbnQgcGhyYXNlcycsICgpID0+IHtcbiAgICAgIGNvbnN0IGZpcnN0ID0gUGFzc3dvcmRVdGlsLmdlbmVyYXRlSGFzaCgnMCcpO1xuICAgICAgY29uc3Qgc2Vjb25kID0gUGFzc3dvcmRVdGlsLmdlbmVyYXRlSGFzaCgnMScpO1xuICAgICAgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpcnN0LCBzZWNvbmQpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnaGFzaCBtYXRjaGluZycsICgpID0+IHtcbiAgICBpdCgncmV0dXJucyB0cnVlIGZvciB0aGUgc2FtZSBoYXNoJywgKCkgPT4ge1xuICAgICAgY29uc3QgcGhyYXNlID0gJ3BocmFzZSc7XG4gICAgICBjb25zdCBoYXNoID0gUGFzc3dvcmRVdGlsLmdlbmVyYXRlSGFzaChwaHJhc2UpO1xuICAgICAgYXNzZXJ0LmlzVHJ1ZShQYXNzd29yZFV0aWwubWF0Y2hlc0hhc2gocGhyYXNlLCBoYXNoKSk7XG4gICAgfSk7XG4gICAgaXQoJ3JldHVybnMgZmFsc2UgZm9yIGRpZmZlcmVudCBoYXNoZXMnLCAoKSA9PiB7XG4gICAgICBjb25zdCBoYXNoID0gUGFzc3dvcmRVdGlsLmdlbmVyYXRlSGFzaCgncGhyYXNlJyk7XG4gICAgICBhc3NlcnQuaXNGYWxzZShQYXNzd29yZFV0aWwubWF0Y2hlc0hhc2goJ3BocmFzZTInLCBoYXNoKSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdwYXNzd29yZCB2YWxpZGF0aW9uJywgKCkgPT4ge1xuICAgIGl0KCdzaG91bGQgcmV0dXJuIG5vdGhpbmcgaWYgcGFzc3dvcmQgaXMgdmFsaWQnLCAoKSA9PiB7XG4gICAgICBjb25zdCB2YWxpZCA9IFtcbiAgICAgICAgJzEyMzQ1NicsXG4gICAgICAgICcxYTViM0M2ZycsXG4gICAgICAgICcpQ1pjeUBjY0hhJyxcbiAgICAgICAgJ0MkRC0tTTtYdisnLFxuICAgICAgICAnWDgtOyE0N0lXfCcsXG4gICAgICAgICdPaTc0WnBvU3gscCcsXG4gICAgICAgICc+XUsxKmdec3dIVzBdRjZ9eycsXG4gICAgICAgICdUaUpmQGxrXmpzT156OE1VbiUpW1NkflVQUSljaTlDR1NAamI8XicsXG4gICAgICAgICckdSYle3JdYXBnI0dAM2RRZENrQl9wOClneGhORnI9SyZ5Zk1fTThPJjJaLnZReXZ4JyxcbiAgICAgICAgJ2JmXk9NbllrdSppWDt7UGl3XzB6dnonLFxuICAgICAgICAnQEBAQC8/Pz9cXFxcNDU0NScsXG4gICAgICAgICcjJy5yZXBlYXQoNTApLFxuICAgICAgXTtcbiAgICAgIHZhbGlkLmZvckVhY2gocGFzcyA9PiB7XG4gICAgICAgIGFzc2VydC5pc051bGwoUGFzc3dvcmRVdGlsLnZhbGlkYXRlUGFzc3dvcmQocGFzcykpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBhbiBlcnJvciBpZiBwYXNzd29yZCBpcyBub3QgYSBzdHJpbmcnLCAoKSA9PiB7XG4gICAgICBjb25zdCBpbnZhbGlkID0gWzAsIDEyMzQ1NiwgW10sIHt9LCBudWxsLCB1bmRlZmluZWRdIGFzIGFueTtcbiAgICAgIGludmFsaWQuZm9yRWFjaCgocGFzczogYW55KSA9PiB7XG4gICAgICAgIGFzc2VydC5zdHJpY3RFcXVhbChQYXNzd29yZFV0aWwudmFsaWRhdGVQYXNzd29yZChwYXNzKSwgJ1Bhc3N3b3JkIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gYW4gZXJyb3IgaWYgcGFzc3dvcmQgaXMgbm90IGJldHdlZW4gNiBhbmQgNjQgY2hhcmFjdGVycycsICgpID0+IHtcbiAgICAgIGNvbnN0IGludmFsaWQgPSBbJ2EnLCAnYWJjZGUnLCAnIycucmVwZWF0KDY1KSwgJyMnLnJlcGVhdCgxMDApXTtcbiAgICAgIGludmFsaWQuZm9yRWFjaChwYXNzID0+IHtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKFxuICAgICAgICAgIFBhc3N3b3JkVXRpbC52YWxpZGF0ZVBhc3N3b3JkKHBhc3MpLFxuICAgICAgICAgICdQYXNzd29yZCBtdXN0IGJlIGJldHdlZW4gNiBhbmQgNjQgY2hhcmFjdGVycyBsb25nJ1xuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2hvdWxkIHJldHVybiBhbiBlcnJvciBpZiBwYXNzd29yZCBoYXMgaW52YWxpZCBjaGFyYWN0ZXJzJywgKCkgPT4ge1xuICAgICAgY29uc3QgaW52YWxpZCA9IFtcbiAgICAgICAgJ1x1MDI4RFx1MDJBQVx1MDU4MTNXXHUwMzZBXHUwNzRDYlx1MDM4OWYnLFxuICAgICAgICAnKVx1MDBDOXtiKVx1MDM0RVx1MDBENFx1MDIyOVx1MDQ5Q1x1MDY2MycsXG4gICAgICAgICdcdTA3RDNcdTA3MTFcdTAyRkZHXHUwNTk2PTNcdTAwQTQpUCcsXG4gICAgICAgICdcdTA3NzRgXHUwNTFBZlx1MDEyQzhcdTA0RERySCgnLFxuICAgICAgICAnZVx1MDMzOVx1MDNDOVx1MDM3Qlx1MDczQVx1MDIyQ1x1MDZGQSNkXHUwNEM0JyxcbiAgICAgICAgJ1x1OEMwMFx1QjkzQ1x1N0I0RVx1N0IxRlx1QTE0NVx1RjlEQVx1NTg1NVx1Q0U3NFx1QUI3NFx1RUJDMCcsXG4gICAgICAgICdcdTRGQzhcdUE2RjdcdTBGRTlcdThGRURcdTRDMjFcdTk0OTFcdUI3RURcdTQ2RTlcdTkyOUJcdUI5MTknLFxuICAgICAgICAnXHVCRDFGXHUzMjVGXHUyNEQzXHUwRjJEXHVBRjZCXHUzMkExXHU0REI3XHVDNEE4XHUyRUVGXHU5OEIwJyxcbiAgICAgICAgJzxAXHUwMjI2XHUwMTk4XHUwMzg5XHUwNjQ4XHUwNkM5YVx1MDQ4QjwnLFxuICAgICAgXTtcbiAgICAgIGludmFsaWQuZm9yRWFjaChwYXNzID0+IHtcbiAgICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKFxuICAgICAgICAgIFBhc3N3b3JkVXRpbC52YWxpZGF0ZVBhc3N3b3JkKHBhc3MpLFxuICAgICAgICAgICdQYXNzd29yZCBtdXN0IG9ubHkgY29udGFpbiBsZXR0ZXJzLCBudW1iZXJzIGFuZCBzeW1ib2xzJ1xuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSxrQkFBdUI7QUFDdkIsbUJBQThCO0FBRTlCLFNBQVMsaUJBQWlCLE1BQU07QUFDOUIsV0FBUyxtQkFBbUIsTUFBTTtBQUNoQyxPQUFHLCtDQUErQyxNQUFNO0FBQ3RELFlBQU0sUUFBUSxhQUFhLGFBQWEsUUFBUTtBQUNoRCxZQUFNLFNBQVMsYUFBYSxhQUFhLFFBQVE7QUFDakQseUJBQU8sWUFBWSxPQUFPLE1BQU07QUFBQSxJQUNsQyxDQUFDO0FBQ0QsT0FBRyxvREFBb0QsTUFBTTtBQUMzRCxZQUFNLFFBQVEsYUFBYSxhQUFhLEdBQUc7QUFDM0MsWUFBTSxTQUFTLGFBQWEsYUFBYSxHQUFHO0FBQzVDLHlCQUFPLGVBQWUsT0FBTyxNQUFNO0FBQUEsSUFDckMsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUVELFdBQVMsaUJBQWlCLE1BQU07QUFDOUIsT0FBRyxrQ0FBa0MsTUFBTTtBQUN6QyxZQUFNLFNBQVM7QUFDZixZQUFNLE9BQU8sYUFBYSxhQUFhLE1BQU07QUFDN0MseUJBQU8sT0FBTyxhQUFhLFlBQVksUUFBUSxJQUFJLENBQUM7QUFBQSxJQUN0RCxDQUFDO0FBQ0QsT0FBRyxzQ0FBc0MsTUFBTTtBQUM3QyxZQUFNLE9BQU8sYUFBYSxhQUFhLFFBQVE7QUFDL0MseUJBQU8sUUFBUSxhQUFhLFlBQVksV0FBVyxJQUFJLENBQUM7QUFBQSxJQUMxRCxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsV0FBUyx1QkFBdUIsTUFBTTtBQUNwQyxPQUFHLDhDQUE4QyxNQUFNO0FBQ3JELFlBQU0sUUFBUTtBQUFBLFFBQ1o7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxJQUFJLE9BQU8sRUFBRTtBQUFBLE1BQ2Y7QUFDQSxZQUFNLFFBQVEsVUFBUTtBQUNwQiwyQkFBTyxPQUFPLGFBQWEsaUJBQWlCLElBQUksQ0FBQztBQUFBLE1BQ25ELENBQUM7QUFBQSxJQUNILENBQUM7QUFFRCxPQUFHLHNEQUFzRCxNQUFNO0FBQzdELFlBQU0sVUFBVSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sTUFBUztBQUNuRCxjQUFRLFFBQVEsQ0FBQyxTQUFjO0FBQzdCLDJCQUFPLFlBQVksYUFBYSxpQkFBaUIsSUFBSSxHQUFHLDJCQUEyQjtBQUFBLE1BQ3JGLENBQUM7QUFBQSxJQUNILENBQUM7QUFFRCxPQUFHLHlFQUF5RSxNQUFNO0FBQ2hGLFlBQU0sVUFBVSxDQUFDLEtBQUssU0FBUyxJQUFJLE9BQU8sRUFBRSxHQUFHLElBQUksT0FBTyxHQUFHLENBQUM7QUFDOUQsY0FBUSxRQUFRLFVBQVE7QUFDdEIsMkJBQU8sWUFDTCxhQUFhLGlCQUFpQixJQUFJLEdBQ2xDLG1EQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBRUQsT0FBRyw2REFBNkQsTUFBTTtBQUNwRSxZQUFNLFVBQVU7QUFBQSxRQUNkO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQ0EsY0FBUSxRQUFRLFVBQVE7QUFDdEIsMkJBQU8sWUFDTCxhQUFhLGlCQUFpQixJQUFJLEdBQ2xDLHlEQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBQ0gsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
