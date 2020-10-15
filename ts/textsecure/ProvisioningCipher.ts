/* eslint-disable more/no-then */
/* eslint-disable max-classes-per-file */

import { KeyPairType } from '../libsignal.d';
import { ProvisionEnvelopeClass } from '../textsecure.d';

type ProvisionDecryptResult = {
  identityKeyPair: KeyPairType;
  number?: string;
  uuid?: string;
  provisioningCode?: string;
  userAgent?: string;
  readReceipts?: boolean;
  profileKey?: ArrayBuffer;
};

class ProvisioningCipherInner {
  keyPair?: KeyPairType;

  async decrypt(
    provisionEnvelope: ProvisionEnvelopeClass
  ): Promise<ProvisionDecryptResult> {
    const masterEphemeral = provisionEnvelope.publicKey.toArrayBuffer();
    const message = provisionEnvelope.body.toArrayBuffer();
    if (new Uint8Array(message)[0] !== 1) {
      throw new Error('Bad version number on ProvisioningMessage');
    }

    const iv = message.slice(1, 16 + 1);
    const mac = message.slice(message.byteLength - 32, message.byteLength);
    const ivAndCiphertext = message.slice(0, message.byteLength - 32);
    const ciphertext = message.slice(16 + 1, message.byteLength - 32);

    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.decrypt: No keypair!');
    }

    return window.libsignal.Curve.async
      .calculateAgreement(masterEphemeral, this.keyPair.privKey)
      .then(async ecRes =>
        window.libsignal.HKDF.deriveSecrets(
          ecRes,
          new ArrayBuffer(32),
          'TextSecure Provisioning Message'
        )
      )
      .then(async keys =>
        window.libsignal.crypto
          .verifyMAC(ivAndCiphertext, keys[1], mac, 32)
          .then(async () =>
            window.libsignal.crypto.decrypt(keys[0], ciphertext, iv)
          )
      )
      .then(async plaintext => {
        const provisionMessage = window.textsecure.protobuf.ProvisionMessage.decode(
          plaintext
        );
        const privKey = provisionMessage.identityKeyPrivate.toArrayBuffer();

        return window.libsignal.Curve.async
          .createKeyPair(privKey)
          .then(keyPair => {
            const ret: ProvisionDecryptResult = {
              identityKeyPair: keyPair,
              number: provisionMessage.number,
              provisioningCode: provisionMessage.provisioningCode,
              userAgent: provisionMessage.userAgent,
              readReceipts: provisionMessage.readReceipts,
            };
            if (provisionMessage.profileKey) {
              ret.profileKey = provisionMessage.profileKey.toArrayBuffer();
            }
            return ret;
          });
      });
  }

  async getPublicKey(): Promise<ArrayBuffer> {
    return Promise.resolve()
      .then(async () => {
        if (!this.keyPair) {
          return window.libsignal.Curve.async
            .generateKeyPair()
            .then(keyPair => {
              this.keyPair = keyPair;
            });
        }

        return null;
      })
      .then(() => {
        if (!this.keyPair) {
          throw new Error('ProvisioningCipher.decrypt: No keypair!');
        }

        return this.keyPair.pubKey;
      });
  }
}

export default class ProvisioningCipher {
  constructor() {
    const inner = new ProvisioningCipherInner();

    this.decrypt = inner.decrypt.bind(inner);
    this.getPublicKey = inner.getPublicKey.bind(inner);
  }

  decrypt: (
    provisionEnvelope: ProvisionEnvelopeClass
  ) => Promise<ProvisionDecryptResult>;

  getPublicKey: () => Promise<ArrayBuffer>;
}
