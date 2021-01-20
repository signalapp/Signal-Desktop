import { PairingAuthorisation } from '../js/modules/data';

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
  decryptForPubkey: any;
  decryptToken: any;
  encryptForPubkey: any;
  generateEphemeralKeyPair: any;
  generateSignatureForPairing: any;
  sha512: any;
  validateAuthorisation: any;
  verifyAuthorisation(authorisation: PairingAuthorisation): Promise<boolean>;
  verifyPairingSignature: any;
}
