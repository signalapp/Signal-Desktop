export interface CryptoInterface {
  DHDecrypt: any;
  DHEncrypt: any;
  DecryptAESGCM: (symmetricKey: ArrayBuffer, ivAndCiphertext: ArrayBuffer) => Promise<ArrayBuffer>; // AES-GCM
  deriveSymmetricKey: (pubkey: ArrayBuffer, seckey: ArrayBuffer) => Promise<ArrayBuffer>;
  EncryptAESGCM: any; // AES-GCM
  _decodeSnodeAddressToPubKey: any;
  decryptToken: any;
  encryptForPubkey: any;
  generateEphemeralKeyPair: any;
  sha512: any;
}
