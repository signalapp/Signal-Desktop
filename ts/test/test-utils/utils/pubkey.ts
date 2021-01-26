import * as crypto from 'crypto';
import { ECKeyPair } from '../../../receiver/keypairs';
import { PubKey } from '../../../session/types';

export function generateFakePubKey(): PubKey {
  // Generates a mock pubkey for testing
  const numBytes = PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
  const pubkeyString = `05${hexBuffer}`;

  return new PubKey(pubkeyString);
}

export function generateFakeECKeyPair(): ECKeyPair {
  const pubkey = generateFakePubKey().toArray();
  const privKey = new Uint8Array(crypto.randomBytes(64));
  return new ECKeyPair(pubkey, privKey);
}

export function generateFakePubKeys(amount: number): Array<PubKey> {
  const numPubKeys = amount > 0 ? Math.floor(amount) : 0;

  // tslint:disable-next-line: no-unnecessary-callback-wrapper
  return new Array(numPubKeys).fill(0).map(() => generateFakePubKey());
}
