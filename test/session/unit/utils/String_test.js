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
var import_chai = __toESM(require("chai"));
var import_bytebuffer = __toESM(require("bytebuffer"));
var import_utils = require("../../../../session/utils");
var import_chai_as_promised = __toESM(require("chai-as-promised"));
import_chai.default.use(import_chai_as_promised.default);
const { expect } = import_chai.default;
describe("String Utils", () => {
  describe("encode", () => {
    it("can encode to base64", () => {
      const testString = "AAAAAAAAAA";
      const encoded = import_utils.StringUtils.encode(testString, "base64");
      expect(encoded instanceof ArrayBuffer).to.equal(true, "a buffer was not returned from `encode`");
      expect(encoded.byteLength).to.be.greaterThan(0);
    });
    it("can encode to hex", () => {
      const testString = "AAAAAAAAAA";
      const encoded = import_utils.StringUtils.encode(testString, "hex");
      expect(encoded instanceof ArrayBuffer).to.equal(true, "a buffer was not returned from `encode`");
      expect(encoded.byteLength).to.be.greaterThan(0);
    });
    it("wont encode invalid hex", () => {
      const testString = "ZZZZZZZZZZ";
      const encoded = import_utils.StringUtils.encode(testString, "hex");
      expect(encoded.byteLength).to.equal(0);
    });
    it("can encode to binary", () => {
      const testString = "AAAAAAAAAA";
      const encoded = import_utils.StringUtils.encode(testString, "binary");
      expect(encoded instanceof ArrayBuffer).to.equal(true, "a buffer was not returned from `encode`");
      expect(encoded.byteLength).to.be.greaterThan(0);
    });
    it("can encode to utf8", () => {
      const testString = "AAAAAAAAAA";
      const encoded = import_utils.StringUtils.encode(testString, "binary");
      expect(encoded instanceof ArrayBuffer).to.equal(true, "a buffer was not returned from `encode`");
      expect(encoded.byteLength).to.be.greaterThan(0);
    });
    it("can encode empty string", () => {
      const testString = "";
      expect(testString).to.have.length(0);
      const allEncodedings = ["base64", "hex", "binary", "utf8"].map((e) => import_utils.StringUtils.encode(testString, e));
      allEncodedings.forEach((encoded) => {
        expect(encoded instanceof ArrayBuffer).to.equal(true, "a buffer was not returned from `encode`");
        expect(encoded.byteLength).to.equal(0);
      });
    });
    it("can encode huge string", () => {
      const stringSize = Math.pow(2, 16);
      const testString = Array(stringSize).fill("0").join("");
      const allEncodedings = ["base64", "hex", "binary", "utf8"].map((e) => import_utils.StringUtils.encode(testString, e));
      allEncodedings.forEach((encoded) => {
        expect(encoded instanceof ArrayBuffer).to.equal(true, "a buffer was not returned from `encode`");
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });
    it("won't encode illegal string length in hex", () => {
      const testString = "A";
      const encode = /* @__PURE__ */ __name(() => import_utils.StringUtils.encode(testString, "hex"), "encode");
      expect(testString.length % 2).to.equal(1);
      expect(encode).to.throw("Illegal str: Length not a multiple of 2");
    });
    it("can encode obscure string", () => {
      const testString = "\u2193\u2190\xB6\u1D91\u1D76\u2151\u23D5\u2192\u2153\u200E\u1D79\u2159\u1D70\u1D8E\u2154\u2157\u2194\u200C\u1D88\u215E\u206F\u2E1C\u1D8A\u206C\u1D74\u1D89\u2189\u206D\xA5\u1D96\u1D8B\u1D83\u1D93\u23E6\u1D7E\u1D82\u1D86\u2195\u2E1D\u1D94\u1D90\u23D4\xA3\u23D9\u2150\u2152\u1D8C\u2041\u1D98\u1D84\u1D92\u206A\u1DB8\u2158\u200F\u206E\u215A\u215B\u1D99\u1D87\u1D95\u1D80\u2191\u1D7F\u23E0\u1D8D\u1D6F\u23D6\u23D7\u215C\u1D9A\u1D8F\u204A\u200D\u1D81\u1D97\u1D7D\u206B\u1D7C\u215D\u23D8\u2156\u2155\u23E1";
      const encodings = ["base64", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const encoded = import_utils.StringUtils.encode(testString, encoding);
        expect(encoded instanceof ArrayBuffer).to.equal(true, `a buffer was not returned using encoding: '${encoding}'`);
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });
  });
  describe("decode", () => {
    it("can decode empty buffer", () => {
      const buffer = new import_bytebuffer.default(0);
      const encodings = ["base64", "hex", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const decoded = import_utils.StringUtils.decode(buffer, encoding);
        expect(decoded).to.exist;
        expect(typeof decoded === String.name.toLowerCase());
        expect(decoded).to.have.length(0);
      });
    });
    it("can decode huge buffer", () => {
      const bytes = Math.pow(2, 16);
      const bufferString = Array(bytes).fill("A").join("");
      const buffer = import_bytebuffer.default.fromUTF8(bufferString);
      const encodings = ["base64", "hex", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const decoded = import_utils.StringUtils.decode(buffer, encoding);
        expect(decoded).to.exist;
        expect(typeof decoded === String.name.toLowerCase());
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
    it("can decode from ByteBuffer", () => {
      const buffer = import_bytebuffer.default.fromUTF8("AAAAAAAAAA");
      const encodings = ["base64", "hex", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const decoded = import_utils.StringUtils.decode(buffer, encoding);
        expect(decoded).to.exist;
        expect(typeof decoded === String.name.toLowerCase());
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
    it("can decode from Buffer", () => {
      const arrayBuffer = new ArrayBuffer(10);
      const buffer = Buffer.from(arrayBuffer);
      buffer.writeUInt8(0, 0);
      const encodings = ["base64", "hex", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const decoded = import_utils.StringUtils.decode(buffer, encoding);
        expect(decoded).to.exist;
        expect(typeof decoded === String.name.toLowerCase());
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
    it("can decode from ArrayBuffer", () => {
      const buffer = new ArrayBuffer(10);
      const encodings = ["base64", "hex", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const decoded = import_utils.StringUtils.decode(buffer, encoding);
        expect(decoded).to.exist;
        expect(typeof decoded === String.name.toLowerCase());
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
    it("can decode from Uint8Array", () => {
      const buffer = new Uint8Array(10);
      const encodings = ["base64", "hex", "binary", "utf8"];
      encodings.forEach((encoding) => {
        const decoded = import_utils.StringUtils.decode(buffer, encoding);
        expect(decoded).to.exist;
        expect(typeof decoded === String.name.toLowerCase());
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vdHMvdGVzdC9zZXNzaW9uL3VuaXQvdXRpbHMvU3RyaW5nX3Rlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHRzbGludDpkaXNhYmxlOiBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXMgbWF4LWZ1bmMtYm9keS1sZW5ndGggbm8tdW51c2VkLWV4cHJlc3Npb25cbmltcG9ydCBjaGFpIGZyb20gJ2NoYWknO1xuaW1wb3J0IEJ5dGVCdWZmZXIgZnJvbSAnYnl0ZWJ1ZmZlcic7XG5cbi8vIENhbid0IGltcG9ydCB0eXBlIGFzIFN0cmluZ1V0aWxzLkVuY29kaW5nXG5pbXBvcnQgeyBFbmNvZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3Nlc3Npb24vdXRpbHMvU3RyaW5nJztcbmltcG9ydCB7IFN0cmluZ1V0aWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2Vzc2lvbi91dGlscyc7XG5cbmltcG9ydCBjaGFpQXNQcm9taXNlZCBmcm9tICdjaGFpLWFzLXByb21pc2VkJztcbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkIGFzIGFueSk7XG5cbmNvbnN0IHsgZXhwZWN0IH0gPSBjaGFpO1xuXG5kZXNjcmliZSgnU3RyaW5nIFV0aWxzJywgKCkgPT4ge1xuICBkZXNjcmliZSgnZW5jb2RlJywgKCkgPT4ge1xuICAgIGl0KCdjYW4gZW5jb2RlIHRvIGJhc2U2NCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHRlc3RTdHJpbmcgPSAnQUFBQUFBQUFBQSc7XG4gICAgICBjb25zdCBlbmNvZGVkID0gU3RyaW5nVXRpbHMuZW5jb2RlKHRlc3RTdHJpbmcsICdiYXNlNjQnKTtcblxuICAgICAgZXhwZWN0KGVuY29kZWQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikudG8uZXF1YWwoXG4gICAgICAgIHRydWUsXG4gICAgICAgICdhIGJ1ZmZlciB3YXMgbm90IHJldHVybmVkIGZyb20gYGVuY29kZWAnXG4gICAgICApO1xuICAgICAgZXhwZWN0KGVuY29kZWQuYnl0ZUxlbmd0aCkudG8uYmUuZ3JlYXRlclRoYW4oMCk7XG4gICAgfSk7XG5cbiAgICBpdCgnY2FuIGVuY29kZSB0byBoZXgnLCAoKSA9PiB7XG4gICAgICBjb25zdCB0ZXN0U3RyaW5nID0gJ0FBQUFBQUFBQUEnO1xuICAgICAgY29uc3QgZW5jb2RlZCA9IFN0cmluZ1V0aWxzLmVuY29kZSh0ZXN0U3RyaW5nLCAnaGV4Jyk7XG5cbiAgICAgIGV4cGVjdChlbmNvZGVkIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpLnRvLmVxdWFsKFxuICAgICAgICB0cnVlLFxuICAgICAgICAnYSBidWZmZXIgd2FzIG5vdCByZXR1cm5lZCBmcm9tIGBlbmNvZGVgJ1xuICAgICAgKTtcbiAgICAgIGV4cGVjdChlbmNvZGVkLmJ5dGVMZW5ndGgpLnRvLmJlLmdyZWF0ZXJUaGFuKDApO1xuICAgIH0pO1xuXG4gICAgaXQoJ3dvbnQgZW5jb2RlIGludmFsaWQgaGV4JywgKCkgPT4ge1xuICAgICAgY29uc3QgdGVzdFN0cmluZyA9ICdaWlpaWlpaWlpaJztcbiAgICAgIGNvbnN0IGVuY29kZWQgPSBTdHJpbmdVdGlscy5lbmNvZGUodGVzdFN0cmluZywgJ2hleCcpO1xuXG4gICAgICBleHBlY3QoZW5jb2RlZC5ieXRlTGVuZ3RoKS50by5lcXVhbCgwKTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gZW5jb2RlIHRvIGJpbmFyeScsICgpID0+IHtcbiAgICAgIGNvbnN0IHRlc3RTdHJpbmcgPSAnQUFBQUFBQUFBQSc7XG4gICAgICBjb25zdCBlbmNvZGVkID0gU3RyaW5nVXRpbHMuZW5jb2RlKHRlc3RTdHJpbmcsICdiaW5hcnknKTtcblxuICAgICAgZXhwZWN0KGVuY29kZWQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikudG8uZXF1YWwoXG4gICAgICAgIHRydWUsXG4gICAgICAgICdhIGJ1ZmZlciB3YXMgbm90IHJldHVybmVkIGZyb20gYGVuY29kZWAnXG4gICAgICApO1xuICAgICAgZXhwZWN0KGVuY29kZWQuYnl0ZUxlbmd0aCkudG8uYmUuZ3JlYXRlclRoYW4oMCk7XG4gICAgfSk7XG5cbiAgICBpdCgnY2FuIGVuY29kZSB0byB1dGY4JywgKCkgPT4ge1xuICAgICAgY29uc3QgdGVzdFN0cmluZyA9ICdBQUFBQUFBQUFBJztcbiAgICAgIGNvbnN0IGVuY29kZWQgPSBTdHJpbmdVdGlscy5lbmNvZGUodGVzdFN0cmluZywgJ2JpbmFyeScpO1xuXG4gICAgICBleHBlY3QoZW5jb2RlZCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKS50by5lcXVhbChcbiAgICAgICAgdHJ1ZSxcbiAgICAgICAgJ2EgYnVmZmVyIHdhcyBub3QgcmV0dXJuZWQgZnJvbSBgZW5jb2RlYCdcbiAgICAgICk7XG4gICAgICBleHBlY3QoZW5jb2RlZC5ieXRlTGVuZ3RoKS50by5iZS5ncmVhdGVyVGhhbigwKTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gZW5jb2RlIGVtcHR5IHN0cmluZycsICgpID0+IHtcbiAgICAgIGNvbnN0IHRlc3RTdHJpbmcgPSAnJztcbiAgICAgIGV4cGVjdCh0ZXN0U3RyaW5nKS50by5oYXZlLmxlbmd0aCgwKTtcblxuICAgICAgY29uc3QgYWxsRW5jb2RlZGluZ3MgPSAoWydiYXNlNjQnLCAnaGV4JywgJ2JpbmFyeScsICd1dGY4J10gYXMgQXJyYXk8RW5jb2Rpbmc+KS5tYXAoZSA9PlxuICAgICAgICBTdHJpbmdVdGlscy5lbmNvZGUodGVzdFN0cmluZywgZSlcbiAgICAgICk7XG5cbiAgICAgIGFsbEVuY29kZWRpbmdzLmZvckVhY2goZW5jb2RlZCA9PiB7XG4gICAgICAgIGV4cGVjdChlbmNvZGVkIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpLnRvLmVxdWFsKFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICAgJ2EgYnVmZmVyIHdhcyBub3QgcmV0dXJuZWQgZnJvbSBgZW5jb2RlYCdcbiAgICAgICAgKTtcbiAgICAgICAgZXhwZWN0KGVuY29kZWQuYnl0ZUxlbmd0aCkudG8uZXF1YWwoMCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gZW5jb2RlIGh1Z2Ugc3RyaW5nJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RyaW5nU2l6ZSA9IE1hdGgucG93KDIsIDE2KTtcbiAgICAgIGNvbnN0IHRlc3RTdHJpbmcgPSBBcnJheShzdHJpbmdTaXplKVxuICAgICAgICAuZmlsbCgnMCcpXG4gICAgICAgIC5qb2luKCcnKTtcblxuICAgICAgY29uc3QgYWxsRW5jb2RlZGluZ3MgPSAoWydiYXNlNjQnLCAnaGV4JywgJ2JpbmFyeScsICd1dGY4J10gYXMgQXJyYXk8RW5jb2Rpbmc+KS5tYXAoZSA9PlxuICAgICAgICBTdHJpbmdVdGlscy5lbmNvZGUodGVzdFN0cmluZywgZSlcbiAgICAgICk7XG5cbiAgICAgIGFsbEVuY29kZWRpbmdzLmZvckVhY2goZW5jb2RlZCA9PiB7XG4gICAgICAgIGV4cGVjdChlbmNvZGVkIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpLnRvLmVxdWFsKFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICAgJ2EgYnVmZmVyIHdhcyBub3QgcmV0dXJuZWQgZnJvbSBgZW5jb2RlYCdcbiAgICAgICAgKTtcbiAgICAgICAgZXhwZWN0KGVuY29kZWQuYnl0ZUxlbmd0aCkudG8uYmUuZ3JlYXRlclRoYW4oMCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGl0KFwid29uJ3QgZW5jb2RlIGlsbGVnYWwgc3RyaW5nIGxlbmd0aCBpbiBoZXhcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGVzdFN0cmluZyA9ICdBJztcbiAgICAgIGNvbnN0IGVuY29kZSA9ICgpID0+IFN0cmluZ1V0aWxzLmVuY29kZSh0ZXN0U3RyaW5nLCAnaGV4Jyk7XG5cbiAgICAgIC8vIEVuc3VyZSBzdHJpbmcgaXMgb2RkIGxlbmd0aFxuICAgICAgZXhwZWN0KHRlc3RTdHJpbmcubGVuZ3RoICUgMikudG8uZXF1YWwoMSk7XG4gICAgICBleHBlY3QoZW5jb2RlKS50by50aHJvdygnSWxsZWdhbCBzdHI6IExlbmd0aCBub3QgYSBtdWx0aXBsZSBvZiAyJyk7XG4gICAgfSk7XG5cbiAgICBpdCgnY2FuIGVuY29kZSBvYnNjdXJlIHN0cmluZycsICgpID0+IHtcbiAgICAgIGNvbnN0IHRlc3RTdHJpbmcgPVxuICAgICAgICAnXHUyMTkzXHUyMTkwXHUwMEI2XHUxRDkxXHUxRDc2XHUyMTUxXHUyM0Q1XHUyMTkyXHUyMTUzXHUyMDBFXHUxRDc5XHUyMTU5XHUxRDcwXHUxRDhFXHUyMTU0XHUyMTU3XHUyMTk0XHUyMDBDXHUxRDg4XHUyMTVFXHUyMDZGXHUyRTFDXHUxRDhBXHUyMDZDXHUxRDc0XHUxRDg5XHUyMTg5XHUyMDZEXHUwMEE1XHUxRDk2XHUxRDhCXHUxRDgzXHUxRDkzXHUyM0U2XHUxRDdFXHUxRDgyXHUxRDg2XHUyMTk1XHUyRTFEXHUxRDk0XHUxRDkwXHUyM0Q0XHUwMEEzXHUyM0Q5XHUyMTUwXHUyMTUyXHUxRDhDXHUyMDQxXHUxRDk4XHUxRDg0XHUxRDkyXHUyMDZBXHUxREI4XHUyMTU4XHUyMDBGXHUyMDZFXHUyMTVBXHUyMTVCXHUxRDk5XHUxRDg3XHUxRDk1XHUxRDgwXHUyMTkxXHUxRDdGXHUyM0UwXHUxRDhEXHUxRDZGXHUyM0Q2XHUyM0Q3XHUyMTVDXHUxRDlBXHUxRDhGXHUyMDRBXHUyMDBEXHUxRDgxXHUxRDk3XHUxRDdEXHUyMDZCXHUxRDdDXHUyMTVEXHUyM0Q4XHUyMTU2XHUyMTU1XHUyM0UxJztcblxuICAgICAgLy8gTm90IHZhbGlkIGhleCBmb3JtYXQ7IHRyeSB0ZXN0IHRoZSBvdGhlcnNcbiAgICAgIGNvbnN0IGVuY29kaW5ncyA9IFsnYmFzZTY0JywgJ2JpbmFyeScsICd1dGY4J10gYXMgQXJyYXk8RW5jb2Rpbmc+O1xuXG4gICAgICBlbmNvZGluZ3MuZm9yRWFjaChlbmNvZGluZyA9PiB7XG4gICAgICAgIGNvbnN0IGVuY29kZWQgPSBTdHJpbmdVdGlscy5lbmNvZGUodGVzdFN0cmluZywgZW5jb2RpbmcpO1xuICAgICAgICBleHBlY3QoZW5jb2RlZCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKS50by5lcXVhbChcbiAgICAgICAgICB0cnVlLFxuICAgICAgICAgIGBhIGJ1ZmZlciB3YXMgbm90IHJldHVybmVkIHVzaW5nIGVuY29kaW5nOiAnJHtlbmNvZGluZ30nYFxuICAgICAgICApO1xuICAgICAgICBleHBlY3QoZW5jb2RlZC5ieXRlTGVuZ3RoKS50by5iZS5ncmVhdGVyVGhhbigwKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnZGVjb2RlJywgKCkgPT4ge1xuICAgIGl0KCdjYW4gZGVjb2RlIGVtcHR5IGJ1ZmZlcicsICgpID0+IHtcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBCeXRlQnVmZmVyKDApO1xuXG4gICAgICBjb25zdCBlbmNvZGluZ3MgPSBbJ2Jhc2U2NCcsICdoZXgnLCAnYmluYXJ5JywgJ3V0ZjgnXSBhcyBBcnJheTxFbmNvZGluZz47XG5cbiAgICAgIC8vIEVhY2ggZW5jb2Rpbmcgc2hvdWxkIGJlIHZhbGlkXG4gICAgICBlbmNvZGluZ3MuZm9yRWFjaChlbmNvZGluZyA9PiB7XG4gICAgICAgIGNvbnN0IGRlY29kZWQgPSBTdHJpbmdVdGlscy5kZWNvZGUoYnVmZmVyLCBlbmNvZGluZyk7XG5cbiAgICAgICAgZXhwZWN0KGRlY29kZWQpLnRvLmV4aXN0O1xuICAgICAgICBleHBlY3QodHlwZW9mIGRlY29kZWQgPT09IFN0cmluZy5uYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICBleHBlY3QoZGVjb2RlZCkudG8uaGF2ZS5sZW5ndGgoMCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gZGVjb2RlIGh1Z2UgYnVmZmVyJywgKCkgPT4ge1xuICAgICAgY29uc3QgYnl0ZXMgPSBNYXRoLnBvdygyLCAxNik7XG4gICAgICBjb25zdCBidWZmZXJTdHJpbmcgPSBBcnJheShieXRlcylcbiAgICAgICAgLmZpbGwoJ0EnKVxuICAgICAgICAuam9pbignJyk7XG4gICAgICBjb25zdCBidWZmZXIgPSBCeXRlQnVmZmVyLmZyb21VVEY4KGJ1ZmZlclN0cmluZyk7XG5cbiAgICAgIGNvbnN0IGVuY29kaW5ncyA9IFsnYmFzZTY0JywgJ2hleCcsICdiaW5hcnknLCAndXRmOCddIGFzIEFycmF5PEVuY29kaW5nPjtcblxuICAgICAgLy8gRWFjaCBlbmNvZGluZyBzaG91bGQgYmUgdmFsaWRcbiAgICAgIGVuY29kaW5ncy5mb3JFYWNoKGVuY29kaW5nID0+IHtcbiAgICAgICAgY29uc3QgZGVjb2RlZCA9IFN0cmluZ1V0aWxzLmRlY29kZShidWZmZXIsIGVuY29kaW5nKTtcblxuICAgICAgICBleHBlY3QoZGVjb2RlZCkudG8uZXhpc3Q7XG4gICAgICAgIGV4cGVjdCh0eXBlb2YgZGVjb2RlZCA9PT0gU3RyaW5nLm5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGV4cGVjdChkZWNvZGVkKS50by5oYXZlLmxlbmd0aC5ncmVhdGVyVGhhbigwKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaXQoJ2NhbiBkZWNvZGUgZnJvbSBCeXRlQnVmZmVyJywgKCkgPT4ge1xuICAgICAgY29uc3QgYnVmZmVyID0gQnl0ZUJ1ZmZlci5mcm9tVVRGOCgnQUFBQUFBQUFBQScpO1xuXG4gICAgICBjb25zdCBlbmNvZGluZ3MgPSBbJ2Jhc2U2NCcsICdoZXgnLCAnYmluYXJ5JywgJ3V0ZjgnXSBhcyBBcnJheTxFbmNvZGluZz47XG5cbiAgICAgIC8vIEVhY2ggZW5jb2Rpbmcgc2hvdWxkIGJlIHZhbGlkXG4gICAgICBlbmNvZGluZ3MuZm9yRWFjaChlbmNvZGluZyA9PiB7XG4gICAgICAgIGNvbnN0IGRlY29kZWQgPSBTdHJpbmdVdGlscy5kZWNvZGUoYnVmZmVyLCBlbmNvZGluZyk7XG5cbiAgICAgICAgZXhwZWN0KGRlY29kZWQpLnRvLmV4aXN0O1xuICAgICAgICBleHBlY3QodHlwZW9mIGRlY29kZWQgPT09IFN0cmluZy5uYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICBleHBlY3QoZGVjb2RlZCkudG8uaGF2ZS5sZW5ndGguZ3JlYXRlclRoYW4oMCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGl0KCdjYW4gZGVjb2RlIGZyb20gQnVmZmVyJywgKCkgPT4ge1xuICAgICAgY29uc3QgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMTApO1xuICAgICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmZyb20oYXJyYXlCdWZmZXIpO1xuICAgICAgYnVmZmVyLndyaXRlVUludDgoMCwgMCk7XG5cbiAgICAgIGNvbnN0IGVuY29kaW5ncyA9IFsnYmFzZTY0JywgJ2hleCcsICdiaW5hcnknLCAndXRmOCddIGFzIEFycmF5PEVuY29kaW5nPjtcblxuICAgICAgLy8gRWFjaCBlbmNvZGluZyBzaG91bGQgYmUgdmFsaWRcbiAgICAgIGVuY29kaW5ncy5mb3JFYWNoKGVuY29kaW5nID0+IHtcbiAgICAgICAgY29uc3QgZGVjb2RlZCA9IFN0cmluZ1V0aWxzLmRlY29kZShidWZmZXIsIGVuY29kaW5nKTtcblxuICAgICAgICBleHBlY3QoZGVjb2RlZCkudG8uZXhpc3Q7XG4gICAgICAgIGV4cGVjdCh0eXBlb2YgZGVjb2RlZCA9PT0gU3RyaW5nLm5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGV4cGVjdChkZWNvZGVkKS50by5oYXZlLmxlbmd0aC5ncmVhdGVyVGhhbigwKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaXQoJ2NhbiBkZWNvZGUgZnJvbSBBcnJheUJ1ZmZlcicsICgpID0+IHtcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcigxMCk7XG5cbiAgICAgIGNvbnN0IGVuY29kaW5ncyA9IFsnYmFzZTY0JywgJ2hleCcsICdiaW5hcnknLCAndXRmOCddIGFzIEFycmF5PEVuY29kaW5nPjtcblxuICAgICAgLy8gRWFjaCBlbmNvZGluZyBzaG91bGQgYmUgdmFsaWRcbiAgICAgIGVuY29kaW5ncy5mb3JFYWNoKGVuY29kaW5nID0+IHtcbiAgICAgICAgY29uc3QgZGVjb2RlZCA9IFN0cmluZ1V0aWxzLmRlY29kZShidWZmZXIsIGVuY29kaW5nKTtcblxuICAgICAgICBleHBlY3QoZGVjb2RlZCkudG8uZXhpc3Q7XG4gICAgICAgIGV4cGVjdCh0eXBlb2YgZGVjb2RlZCA9PT0gU3RyaW5nLm5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGV4cGVjdChkZWNvZGVkKS50by5oYXZlLmxlbmd0aC5ncmVhdGVyVGhhbigwKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaXQoJ2NhbiBkZWNvZGUgZnJvbSBVaW50OEFycmF5JywgKCkgPT4ge1xuICAgICAgY29uc3QgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoMTApO1xuXG4gICAgICBjb25zdCBlbmNvZGluZ3MgPSBbJ2Jhc2U2NCcsICdoZXgnLCAnYmluYXJ5JywgJ3V0ZjgnXSBhcyBBcnJheTxFbmNvZGluZz47XG5cbiAgICAgIC8vIEVhY2ggZW5jb2Rpbmcgc2hvdWxkIGJlIHZhbGlkXG4gICAgICBlbmNvZGluZ3MuZm9yRWFjaChlbmNvZGluZyA9PiB7XG4gICAgICAgIGNvbnN0IGRlY29kZWQgPSBTdHJpbmdVdGlscy5kZWNvZGUoYnVmZmVyLCBlbmNvZGluZyk7XG5cbiAgICAgICAgZXhwZWN0KGRlY29kZWQpLnRvLmV4aXN0O1xuICAgICAgICBleHBlY3QodHlwZW9mIGRlY29kZWQgPT09IFN0cmluZy5uYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICBleHBlY3QoZGVjb2RlZCkudG8uaGF2ZS5sZW5ndGguZ3JlYXRlclRoYW4oMCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxrQkFBaUI7QUFDakIsd0JBQXVCO0FBSXZCLG1CQUE0QjtBQUU1Qiw4QkFBMkI7QUFDM0Isb0JBQUssSUFBSSwrQkFBcUI7QUFFOUIsTUFBTSxFQUFFLFdBQVc7QUFFbkIsU0FBUyxnQkFBZ0IsTUFBTTtBQUM3QixXQUFTLFVBQVUsTUFBTTtBQUN2QixPQUFH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
