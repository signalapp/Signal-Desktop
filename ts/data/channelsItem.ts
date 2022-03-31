import _ from 'lodash';
import { StorageItem } from '../node/storage_item';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';
import { channels } from './channels';

function keysToArrayBuffer(keys: any, data: any) {
  const updated = _.cloneDeep(data);
  // tslint:disable: one-variable-per-declaration
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = _.get(data, key);

    if (value) {
      _.set(updated, key, fromBase64ToArrayBuffer(value));
    }
  }

  return updated;
}

function keysFromArrayBuffer(keys: any, data: any) {
  const updated = _.cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = _.get(data, key);

    if (value) {
      _.set(updated, key, fromArrayBufferToBase64(value));
    }
  }

  return updated;
}

const ITEM_KEYS: Object = {
  identityKey: ['value.pubKey', 'value.privKey'],
  profileKey: ['value'],
};
export async function createOrUpdateItem(data: StorageItem): Promise<void> {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdateItem: Provided data did not have a truthy id');
  }

  const keys = (ITEM_KEYS as any)[id];
  const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;

  await channels.createOrUpdateItem(updated);
}
export async function getItemById(id: string): Promise<StorageItem | undefined> {
  const keys = (ITEM_KEYS as any)[id];
  const data = await channels.getItemById(id);

  return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}

export async function getAllItems(): Promise<Array<StorageItem>> {
  const items = await channels.getAllItems();
  return _.map(items, item => {
    const { id } = item;
    const keys = (ITEM_KEYS as any)[id];
    return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
  });
}
export async function removeItemById(id: string): Promise<void> {
  await channels.removeItemById(id);
}
