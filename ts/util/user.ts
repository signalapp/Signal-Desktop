import { getItemById } from '../../js/modules/data';
import { KeyPair } from '../../libtextsecure/libsignal-protocol';
import { PrimaryPubKey } from '../session/types';
import { MultiDeviceProtocol } from '../session/protocols';
import { StringUtils } from '../session/utils';
import _ from 'lodash';

export type HexKeyPair = {
  pubKey: string;
  privKey: string;
};

export async function getCurrentDevicePubKey(): Promise<string | undefined> {
  const item = await getItemById('number_id');
  if (!item || !item.value) {
    return undefined;
  }

  return item.value.split('.')[0];
}

export async function getPrimary(): Promise<PrimaryPubKey> {
  const ourNumber = (await getCurrentDevicePubKey()) as string;
  return MultiDeviceProtocol.getPrimaryDevice(ourNumber);
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
      pubKey: StringUtils.toHex(new Uint8Array(pubKeyAsArray)),
      privKey: StringUtils.toHex(new Uint8Array(privKeyAsArray)),
    };
  }
  return undefined;
}
