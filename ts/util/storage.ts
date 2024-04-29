import { isBoolean } from 'lodash';
import { Data } from '../data/data';
import { SessionKeyPair } from '../receiver/keypairs';
import { DEFAULT_RECENT_REACTS } from '../session/constants';
import { deleteSettingsBoolValue, updateSettingsBoolValue } from '../state/ducks/settings';
import { ReleasedFeatures } from './releaseFeature';

let ready = false;

type ValueType = string | number | boolean | SessionKeyPair | Array<string>;
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
  await Data.createOrUpdateItem(data);

  if (isBoolean(value)) {
    window?.inboxStore?.dispatch(updateSettingsBoolValue({ id: key, value }));
  }
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

  delete items[key];

  window?.inboxStore?.dispatch(deleteSettingsBoolValue(key));

  await Data.removeItemById(key);
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
  const array = await Data.getAllItems();

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

export function getOurPubKeyStrFromStorage() {
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
  if (await ReleasedFeatures.checkIsUserConfigFeatureReleased()) {
    return;
  }
  await put('last_profile_update_timestamp', lastUpdateTimestamp);
}

export function getCurrentRecoveryPhrase() {
  return Storage.get('mnemonic') as string;
}

export async function saveRecoveryPhrase(mnemonic: string) {
  return Storage.put('mnemonic', mnemonic);
}

export function getRecentReactions(): Array<string> {
  const reactions = Storage.get('recent_reactions') as string;
  if (reactions) {
    return reactions.split(' ');
  }
  return DEFAULT_RECENT_REACTS;
}

export async function saveRecentReations(reactions: Array<string>) {
  return Storage.put('recent_reactions', reactions.join(' '));
}

function getBoolOrFalse(settingsKey: string): boolean {
  const got = Storage.get(settingsKey, false);
  if (isBoolean(got)) {
    return got;
  }
  return false;
}

export const Storage = { fetch, put, get, getBoolOrFalse, remove, onready, reset };
