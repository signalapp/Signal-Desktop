import { KeyPair } from 'libsodium-wrappers-sumo';
import { fromHexToArray, toHex } from '../session/utils/String';

export type HexKeyPair = {
  publicHex: string;
  privateHex: string;
};

export type SessionKeyPair = {
  /**
   * The curve25519 pubkey with prepended 5
   */
  pubKey: ArrayBufferLike;

  /**
   * The curve25519 secret key
   */
  privKey: ArrayBufferLike;

  ed25519KeyPair: KeyPair;
};

export class ECKeyPair {
  public readonly publicKeyData: Uint8Array;
  public readonly privateKeyData: Uint8Array;

  constructor(publicKeyData: Uint8Array, privateKeyData: Uint8Array) {
    this.publicKeyData = publicKeyData;
    this.privateKeyData = privateKeyData;
  }

  public static fromArrayBuffer(pub: ArrayBuffer, priv: ArrayBuffer) {
    return new ECKeyPair(new Uint8Array(pub), new Uint8Array(priv));
  }

  public static fromKeyPair(pair: SessionKeyPair) {
    return new ECKeyPair(new Uint8Array(pair.pubKey), new Uint8Array(pair.privKey));
  }

  public static fromHexKeyPair(pair: HexKeyPair) {
    return new ECKeyPair(fromHexToArray(pair.publicHex), fromHexToArray(pair.privateHex));
  }

  public toString() {
    const hexKeypair = this.toHexKeyPair();
    return `ECKeyPair: ${hexKeypair.publicHex} ${hexKeypair.privateHex}`;
  }

  public toHexKeyPair(): HexKeyPair {
    const publicHex = toHex(this.publicKeyData);
    const privateHex = toHex(this.privateKeyData);
    return {
      publicHex,
      privateHex,
    };
  }
}
