export interface LibTextsecureCryptoInterface {
  encryptAttachment(
    plaintext: ArrayBuffer,
    keys: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<{
    digest: ArrayBuffer;
    ciphertext: ArrayBuffer;
  }>;
  decryptAttachment(
    encryptedBin: ArrayBuffer,
    keys: ArrayBuffer,
    theirDigest: ArrayBuffer
  ): Promise<ArrayBuffer>;
  decryptProfile(data: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer>;
  encryptProfile(data: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer>;
}
