export interface CryptoInterface {
  DecryptAESGCM: (symmetricKey: ArrayBuffer, ivAndCiphertext: ArrayBuffer) => Promise<ArrayBuffer>; // AES-GCM
  deriveSymmetricKey: (pubkey: ArrayBuffer, seckey: ArrayBuffer) => Promise<ArrayBuffer>;
  encryptForPubkey: (
    publicKey: string,
    data: Uint8Array
  ) => Promise<{ ciphertext: Uint8Array; symmetricKey: ArrayBuffer; ephemeralKey: ArrayBuffer }>;
}
