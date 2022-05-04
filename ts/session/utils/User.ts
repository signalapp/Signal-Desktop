import _ from 'lodash';
import { UserUtils } from '.';
import { getItemById } from '../../../ts/data/data';
import { PubKey } from '../types';
import { fromHexToArray, toHex } from './String';
import { getConversationController } from '../conversations';
import { LokiProfile } from '../../types/Message';
import { getNumber, Storage } from '../../util/storage';
import { SessionKeyPair } from '../../receiver/keypairs';

export type HexKeyPair = {
  pubKey: string;
  privKey: string;
};

/**
 * Check if this pubkey is us, using the cache.
 * Throws an error if our pubkey is not set
 */
export function isUsFromCache(pubKey: string | PubKey | undefined): boolean {
  if (!pubKey) {
    throw new Error('pubKey is not set');
  }
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const pubKeyStr = pubKey instanceof PubKey ? pubKey.key : pubKey;
  return pubKeyStr === ourNumber;
}

/**
 * Returns the public key of this current device as a STRING, or throws an error
 */
export function getOurPubKeyStrFromCache(): string {
  const ourNumber = getNumber();
  if (!ourNumber) {
    throw new Error('ourNumber is not set');
  }
  return ourNumber;
}

/**
 * Returns the public key of this current device as a PubKey, or throws an error
 */
export function getOurPubKeyFromCache(): PubKey {
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  if (!ourNumber) {
    throw new Error('ourNumber is not set');
  }
  return PubKey.cast(ourNumber);
}

let cachedIdentityKeyPair: SessionKeyPair | undefined;

/**
 * This return the stored x25519 identity keypair for the current logged in user
 */
export async function getIdentityKeyPair(): Promise<SessionKeyPair | undefined> {
  if (cachedIdentityKeyPair) {
    return cachedIdentityKeyPair;
  }
  const item = await getItemById('identityKey');

  cachedIdentityKeyPair = item?.value;
  return cachedIdentityKeyPair;
}

export async function getUserED25519KeyPair(): Promise<HexKeyPair | undefined> {
  // 'identityKey' keeps the ed25519KeyPair under a ed25519KeyPair field.
  // it is only set if the user migrated to the ed25519 way of generating a key
  const item = await getIdentityKeyPair();
  const ed25519KeyPair = (item as any)?.ed25519KeyPair;
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

export function getOurProfile(): LokiProfile | undefined {
  try {
    // Secondary devices have their profile stored
    // in their primary device's conversation
    const ourNumber = Storage.get('primaryDevicePubKey') as string;
    const ourConversation = getConversationController().get(ourNumber);
    const ourProfileKeyHex = ourConversation.get('profileKey');
    const profileKeyAsBytes = ourProfileKeyHex ? fromHexToArray(ourProfileKeyHex) : null;

    const avatarPointer = ourConversation.get('avatarPointer');
    const { displayName } = ourConversation.getLokiProfile();
    return {
      displayName,
      avatarPointer,
      profileKey: profileKeyAsBytes?.length ? profileKeyAsBytes : null,
    };
  } catch (e) {
    window?.log?.error(`Failed to get our profile: ${e}`);
    return undefined;
  }
}
