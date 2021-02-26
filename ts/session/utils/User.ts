import _ from 'lodash';
import { UserUtils } from '.';
import { getItemById } from '../../../ts/data/data';
import { KeyPair } from '../../../libtextsecure/libsignal-protocol';
import { PubKey } from '../types';
import { toHex } from './String';
import { ConversationController } from '../conversations';

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
  const ourNumber = window.textsecure.storage.user.getNumber();
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

export function isRestoringFromSeed(): boolean {
  return window.textsecure.storage.user.isRestoringFromSeed();
}

export function setRestoringFromSeed(isRestoring: boolean) {
  window.textsecure.storage.user.setRestoringFromSeed(isRestoring);
}

export interface OurLokiProfile {
  displayName: string;
  avatarPointer: string;
  profileKey: Uint8Array | null;
}

/**
 * Returns
 *   displayName: string;
 *   avatarPointer: string;
 *   profileKey: Uint8Array;
 */
export function getOurProfile(
  shareAvatar: boolean
): OurLokiProfile | undefined {
  try {
    // Secondary devices have their profile stored
    // in their primary device's conversation
    const ourNumber = window.storage.get('primaryDevicePubKey');
    const ourConversation = ConversationController.getInstance().get(ourNumber);
    let profileKey = null;
    if (shareAvatar) {
      profileKey = new Uint8Array(window.storage.get('profileKey'));
    }
    const avatarPointer = ourConversation.get('avatarPointer');
    const { displayName } = ourConversation.getLokiProfile();
    return { displayName, avatarPointer, profileKey };
  } catch (e) {
    window.log.error(`Failed to get our profile: ${e}`);
    return undefined;
  }
}
