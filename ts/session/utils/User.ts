import _ from 'lodash';
import { UserUtils } from '.';
import { getItemById } from '../../../js/modules/data';
import { KeyPair } from '../../../libtextsecure/libsignal-protocol';
import { PubKey } from '../types';
import { toHex } from './String';

export async function isUs(
  pubKey: string | PubKey | undefined
): Promise<boolean> {
  if (!pubKey) {
    throw new Error('pubKey is not set');
  }
  const ourNumber = await UserUtils.getCurrentDevicePubKey();
  if (!ourNumber) {
    throw new Error('ourNumber is not set');
  }
  const pubKeyStr = pubKey instanceof PubKey ? pubKey.key : pubKey;
  return pubKeyStr === ourNumber;
}

export type HexKeyPair = {
  pubKey: string;
  privKey: string;
};

/**
 * Returns the public key of this current device as a string
 */
export async function getCurrentDevicePubKey(): Promise<string | undefined> {
  const item = await getItemById('number_id');
  if (!item || !item.value) {
    return undefined;
  }

  return item.value.split('.')[0];
}

export async function getOurNumber(): Promise<PubKey> {
  const ourNumber = await UserUtils.getCurrentDevicePubKey();
  if (!ourNumber) {
    throw new Error('ourNumber is not set');
  }
  return PubKey.cast(ourNumber);
}

/**
 * This return the stored x25519 identity keypair for the current logged in user
 */
export async function getIdentityKeyPair(): Promise<KeyPair | undefined> {
  const item = await getItemById('identityKey');

  return item?.value;
}

export async function getUserED25519KeyPair(): Promise<HexKeyPair | undefined> {
  // 'identityKey' keeps the ed25519KeyPair under a ed25519KeyPair field.
  // it is only set if the user migrated to the ed25519 way of generating a key
  const item = await getItemById('identityKey');
  const ed25519KeyPair = item?.value?.ed25519KeyPair;
  if (ed25519KeyPair?.publicKey && ed25519KeyPair?.privateKey) {
    const pubKeyAsArray = _.map(ed25519KeyPair.publicKey, a => a);
    const privKeyAsArray = _.map(ed25519KeyPair.privateKey, a => a);
    return {
      pubKey: toHex(new Uint8Array(pubKeyAsArray)),
      privKey: toHex(new Uint8Array(privKeyAsArray)),
    };
  }
  return undefined;
}
