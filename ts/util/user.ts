import { getItemById } from '../../js/modules/data';
import { KeyPair } from '../../libtextsecure/libsignal-protocol';

export async function getCurrentDevicePubKey(): Promise<string | undefined> {
  const item = await getItemById('number_id');
  if (!item || !item.value) {
    return undefined;
  }

  return item.value.split('.')[0];
}

export async function getCurrentPrimaryDevicePubKey(): Promise<string | undefined> {
  const item = await getItemById('primaryDevicePubKey');
  if (!item || !item.value) {
    return undefined;
  }

  return item.value;
}

export async function getIdentityKeyPair(): Promise<KeyPair | undefined> {
  const item = await getItemById('identityKey');

  return item?.value;
}
