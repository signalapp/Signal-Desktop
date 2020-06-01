import { getItemById } from '../../js/modules/data';
import { KeyPair } from '../window/types/libsignal-protocol';

export async function getCurrentDevicePubKey(): Promise<string | undefined> {
  const item = await getItemById('number_id');
  if (!item || !item.value) {
    return undefined;
  }

  return item.value.split('.')[0];
}

export async function getIdentityKeyPair(): Promise<KeyPair | undefined> {
  const item = await getItemById('identityKey');

  return item?.value;
}
