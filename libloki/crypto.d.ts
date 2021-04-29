export interface CryptoInterface {
  DHDecrypt: any;
  DHEncrypt: any;
  DecryptAESGCM: (symmetricKey: ArrayBuffer, ivAndCiphertext: ArrayBuffer) => Promise<ArrayBuffer>; // AES-GCM
  deriveSymmetricKey: (pubkey: ArrayBuffer, seckey: ArrayBuffer) => Promise<ArrayBuffer>;
  EncryptAESGCM: any; // AES-GCM
  _decodeSnodeAddressToPubKey: any;
  decryptToken: any;
  encryptForPubkey: (
    publicKey: string,
    data: Uint8Array
  ) => Promise<{ ciphertext: Uint8Array; symmetricKey: ArrayBuffer; ephemeralKey: ArrayBuffer }>;
  generateEphemeralKeyPair: any;
  sha512: any;
}
