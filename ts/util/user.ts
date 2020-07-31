import { getItemById } from '../../js/modules/data';
import { KeyPair } from '../../libtextsecure/libsignal-protocol';
import { PrimaryPubKey } from '../session/types';
import { MultiDeviceProtocol } from '../session/protocols';

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

export async function getIdentityKeyPair(): Promise<KeyPair | undefined> {
  const item = await getItemById('identityKey');

  return item?.value;
}
