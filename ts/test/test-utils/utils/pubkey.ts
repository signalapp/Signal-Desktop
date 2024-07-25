import * as crypto from 'crypto';
import _ from 'lodash';
import { Snode } from '../../../data/types';
import { ECKeyPair } from '../../../receiver/keypairs';
import { PubKey } from '../../../session/types';

export function generateFakePubKey(): PubKey {
  // Generates a mock pubkey for testing
  const numBytes = PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
  const pubkeyString = `05${hexBuffer}`;

  return new PubKey(pubkeyString);
}

export function generateFakePubKeyStr(): string {
  // Generates a mock pubkey for testing
  const numBytes = PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
  const pubkeyString = `05${hexBuffer}`;

  return pubkeyString;
}

export function generateFakeClosedGroupV3PkStr(): string {
  // Generates a mock pubkey for testing
  const numBytes = PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
  const pubkeyString = `03${hexBuffer}`;

  return pubkeyString;
}

export function generateFakeECKeyPair(): ECKeyPair {
  const pubkey = generateFakePubKey().toArray();
  const privKey = new Uint8Array(crypto.randomBytes(64));
  return new ECKeyPair(pubkey, privKey);
}

export function generateFakePubKeys(amount: number): Array<PubKey> {
  const numPubKeys = amount > 0 ? Math.floor(amount) : 0;

  return new Array(numPubKeys).fill(0).map(() => generateFakePubKey());
}

export function generateFakeSnode(): Snode {
  return {
    // NOTE: make sure this is random, but not a valid ip (otherwise we will try to hit that ip during testing!)
    ip: `${ipv4Section()}.${ipv4Section()}.${ipv4Section()}.${ipv4Section()}.${ipv4Section()}.${ipv4Section()}`,
    port: 22116,
    pubkey_x25519: generateFakePubKeyStr(),
    pubkey_ed25519: generateFakePubKeyStr(),
    storage_server_version: [2, 8, 0],
  };
}

function ipv4Section() {
  return Math.floor(Math.random() * 255);
}

export function generateFakeSnodeWithEdKey(ed25519Pubkey: string): Snode {
  return {
    // NOTE: make sure this is random, but not a valid ip (otherwise we will try to hit that ip during testing!)
    ip: `${ipv4Section()}.${ipv4Section()}.${ipv4Section()}.${ipv4Section()}.${ipv4Section()}.${ipv4Section()}`,
    port: 22116,
    pubkey_x25519: generateFakePubKeyStr(),
    pubkey_ed25519: ed25519Pubkey,
    storage_server_version: [2, 8, 0],
  };
}

export function generateFakeSnodes(amount: number): Array<Snode> {
  const ar: Array<Snode> = _.times(amount, generateFakeSnode);
  return ar;
}
