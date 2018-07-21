/* global window, StringView */

/* eslint-disable no-bitwise, no-nested-ternary */

// eslint-disable-next-line func-names
(function() {
  window.StringView = {
    /*
      * These functions from the Mozilla Developer Network
      * and have been placed in the public domain.
      * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
      * https://developer.mozilla.org/en-US/docs/MDN/About#Copyrights_and_licenses
      */

    b64ToUint6(nChr) {
      return nChr > 64 && nChr < 91
        ? nChr - 65
        : nChr > 96 && nChr < 123
          ? nChr - 71
          : nChr > 47 && nChr < 58
            ? nChr + 4
            : nChr === 43
              ? 62
              : nChr === 47
                ? 63
                : 0;
    },

    base64ToBytes(sBase64, nBlocksSize) {
      const sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, '');
      const nInLen = sB64Enc.length;
      const nOutLen = nBlocksSize
        ? Math.ceil(((nInLen * 3 + 1) >> 2) / nBlocksSize) * nBlocksSize
        : (nInLen * 3 + 1) >> 2;
      const aBBytes = new ArrayBuffer(nOutLen);
      const taBytes = new Uint8Array(aBBytes);

      let nMod3;
      let nMod4;
      for (
        let nUint24 = 0, nOutIdx = 0, nInIdx = 0;
        nInIdx < nInLen;
        nInIdx += 1
      ) {
        nMod4 = nInIdx & 3;
        nUint24 |=
          StringView.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << (18 - 6 * nMod4);
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
          for (
            nMod3 = 0;
            nMod3 < 3 && nOutIdx < nOutLen;
            nMod3 += 1, nOutIdx += 1
          ) {
            taBytes[nOutIdx] = (nUint24 >>> ((16 >>> nMod3) & 24)) & 255;
          }
          nUint24 = 0;
        }
      }
      return aBBytes;
    },

    uint6ToB64(nUint6) {
      return nUint6 < 26
        ? nUint6 + 65
        : nUint6 < 52
          ? nUint6 + 71
          : nUint6 < 62
            ? nUint6 - 4
            : nUint6 === 62
              ? 43
              : nUint6 === 63
                ? 47
                : 65;
    },

    bytesToBase64(aBytes) {
      let nMod3;
      let sB64Enc = '';
      for (
        let nLen = aBytes.length, nUint24 = 0, nIdx = 0;
        nIdx < nLen;
        nIdx += 1
      ) {
        nMod3 = nIdx % 3;
        if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) {
          sB64Enc += '\r\n';
        }
        nUint24 |= aBytes[nIdx] << ((16 >>> nMod3) & 24);
        if (nMod3 === 2 || aBytes.length - nIdx === 1) {
          sB64Enc += String.fromCharCode(
            StringView.uint6ToB64((nUint24 >>> 18) & 63),
            StringView.uint6ToB64((nUint24 >>> 12) & 63),
            StringView.uint6ToB64((nUint24 >>> 6) & 63),
            StringView.uint6ToB64(nUint24 & 63)
          );
          nUint24 = 0;
        }
      }
      return sB64Enc.replace(/A(?=A$|$)/g, '=');
    },
  };
})();
