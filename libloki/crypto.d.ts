declare enum PairingTypeEnum {
  REQUEST = 1,
  GRANT,
}

export interface CryptoInterface {
  DHDecrypt: any;
  DHEncrypt: any;
  DecryptGCM: any; // AES-GCM
  EncryptGCM: any; // AES-GCM
  PairingType: PairingTypeEnum;
  _decodeSnodeAddressToPubKey: any;
  decryptToken: any;
  encryptForPubkey: any;
  generateEphemeralKeyPair: any;
  sha512: any;
}
