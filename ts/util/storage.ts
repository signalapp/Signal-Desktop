import { createOrUpdateItem, getAllItems, removeItemById } from '../data/channelsItem';

let ready = false;

type ValueType = string | number | boolean;
type InsertedValueType = { id: string; value: ValueType };
let items: Record<string, InsertedValueType>;
let callbacks: Array<() => void> = [];

reset();

async function put(key: string, value: ValueType) {
  if (value === undefined) {
    throw new Error('Tried to store undefined');
  }
  if (!ready) {
    window.log.warn('Called storage.put before storage is ready. key:', key);
  }

  const data: InsertedValueType = { id: key, value };

  items[key] = data;
  await createOrUpdateItem(data);
}

function get(key: string, defaultValue?: ValueType) {
  if (!ready) {
    window.log.warn('Called storage.get before storage is ready. key:', key);
  }

  const item = items[key];
  if (!item) {
    return defaultValue;
  }

  return item.value;
}

async function remove(key: string) {
  if (!ready) {
    window.log.warn('Called storage.get before storage is ready. key:', key);
  }

  // tslint:disable-next-line: no-dynamic-delete
  delete items[key];
  await removeItemById(key);
}

function onready(callback: () => void) {
  if (ready) {
    callback();
  } else {
    callbacks.push(callback);
  }
}

function callListeners() {
  if (ready) {
    callbacks.forEach(callback => {
      callback();
    });
    callbacks = [];
  }
}

async function fetch() {
  reset();
  const array = await getAllItems();

  // tslint:disable-next-line: one-variable-per-declaration
  for (let i = 0, max = array.length; i < max; i += 1) {
    const item = array[i];
    const { id } = item;
    items[id] = item;
  }

  ready = true;
  callListeners();
}

function reset() {
  ready = false;
  items = Object.create(null);
}

export async function setLocalPubKey(pubkey: string) {
  await put('number_id', `${pubkey}.1`);
}

export function getNumber() {
  const numberId = get('number_id') as string | undefined;
  if (numberId === undefined) {
    return undefined;
  }
  return numberId.split('.')[0];
}

export function isSignInByLinking() {
  const isByLinking = get('is_sign_in_by_linking');
  if (isByLinking === undefined) {
    return false;
  }
  return isByLinking;
}

export async function setSignInByLinking(isLinking: boolean) {
  await put('is_sign_in_by_linking', isLinking);
}

export function isSignWithRecoveryPhrase() {
  const isRecoveryPhraseUsed = get('is_sign_in_recovery_phrase');
  if (isRecoveryPhraseUsed === undefined) {
    return false;
  }
  return isRecoveryPhraseUsed;
}

export async function setSignWithRecoveryPhrase(isRecoveryPhraseUsed: boolean) {
  await put('is_sign_in_recovery_phrase', isRecoveryPhraseUsed);
}

export function getLastProfileUpdateTimestamp() {
  return get('last_profile_update_timestamp');
}

export async function setLastProfileUpdateTimestamp(lastUpdateTimestamp: number) {
  await put('last_profile_update_timestamp', lastUpdateTimestamp);
}

export function getCurrentRecoveryPhrase() {
  return Storage.get('mnemonic') as string;
}

export async function saveRecoveryPhrase(mnemonic: string) {
  return Storage.put('mnemonic', mnemonic);
}

export const Storage = { fetch, put, get, remove, onready, reset };
