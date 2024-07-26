import { isBoolean } from 'lodash';
import { SessionKeyPair } from '../receiver/keypairs';
import { DEFAULT_RECENT_REACTS } from '../session/constants';
import { deleteSettingsBoolValue, updateSettingsBoolValue } from '../state/ducks/settings';
import { ReleasedFeatures } from './releaseFeature';
import { Data } from '../data/data';

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
    window.log.warn('Called storage.remove before storage is ready. key:', key);
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

function getBoolOrFalse(settingsKey: string): boolean {
  const got = Storage.get(settingsKey, false);
  if (isBoolean(got)) {
    return got;
  }
  return false;
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

/** this is a loading state to prevent config sync jobs while we are trying to sign in through link a device. It should be set to false after the linking is complete */
export async function setSignInByLinking(isLinking: boolean) {
  await put('is_sign_in_by_linking', isLinking);
}

/** if we sign in with an existing recovery password, then we don't need to show any of the onboarding ui once we login
 */
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

export function getPasswordHash() {
  return Storage.get('passHash') as string;
}

export const Storage = { fetch, put, get, getBoolOrFalse, remove, onready, reset };
