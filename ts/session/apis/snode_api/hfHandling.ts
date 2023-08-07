import { isNumber } from 'lodash';
import { Data } from '../../../data/data';
import { Storage } from '../../../util/storage';

let hasSeenHardfork190: boolean | undefined;
let hasSeenHardfork191: boolean | undefined;

const hasSeenHardfork190ItemId = 'hasSeenHardfork190';
const hasSeenHardfork191ItemId = 'hasSeenHardfork191';

/**
 * this is only intended for testing. Do not call this in production.
 */
export function resetHardForkCachedValues() {
  hasSeenHardfork190 = undefined;
  hasSeenHardfork191 = undefined;
}

/**
 * Not used anymore, but keeping those here in case we ever need to do hardfork enabling of features again
 */
export async function getHasSeenHF190() {
  if (hasSeenHardfork190 === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldHhasSeenHardfork190 = (await Data.getItemById(hasSeenHardfork190ItemId))?.value;
    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldHhasSeenHardfork190 === undefined) {
      await Storage.put(hasSeenHardfork190ItemId, false);
      hasSeenHardfork190 = false;
    } else {
      hasSeenHardfork190 = oldHhasSeenHardfork190;
    }
  }
  return hasSeenHardfork190;
}

/**
 * Not used anymore, but keeping those here in case we ever need to do hardfork enabling of features again
 */
export async function getHasSeenHF191() {
  if (hasSeenHardfork191 === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldHhasSeenHardfork191 = (await Data.getItemById(hasSeenHardfork191ItemId))?.value;

    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldHhasSeenHardfork191 === undefined) {
      await Storage.put(hasSeenHardfork191ItemId, false);
      hasSeenHardfork191 = false;
    } else {
      hasSeenHardfork191 = oldHhasSeenHardfork191;
    }
  }
  return hasSeenHardfork191;
}

export async function handleHardforkResult(json: Record<string, any>) {
  if (hasSeenHardfork190 === undefined || hasSeenHardfork191 === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldHhasSeenHardfork190 = (await Data.getItemById(hasSeenHardfork190ItemId))?.value;
    const oldHasSeenHardfork191 = (await Data.getItemById(hasSeenHardfork191ItemId))?.value;

    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldHhasSeenHardfork190 === undefined) {
      await Storage.put(hasSeenHardfork190ItemId, false);
      hasSeenHardfork190 = false;
    } else {
      hasSeenHardfork190 = oldHhasSeenHardfork190;
    }
    if (oldHasSeenHardfork191 === undefined) {
      await Storage.put(hasSeenHardfork191ItemId, false);
      hasSeenHardfork191 = false;
    } else {
      hasSeenHardfork191 = oldHasSeenHardfork191;
    }
  }

  if (hasSeenHardfork191 && hasSeenHardfork190) {
    // no need to do any of this if we already know both forks happened
    // window.log.info('hardfork 19.1 already happened. No need to go any further');
    return;
  }

  // json.hf is an array of 2 number if it is set. Make sure this is the case before doing anything else
  if (
    json?.hf &&
    Array.isArray(json.hf) &&
    json.hf.length === 2 &&
    isNumber(json.hf[0]) &&
    isNumber(json.hf[1])
  ) {
    if (!hasSeenHardfork190 && json.hf[0] >= 19 && json.hf[1] >= 0) {
      await Storage.put(hasSeenHardfork190ItemId, true);
      hasSeenHardfork190 = true;
    }
    if (!hasSeenHardfork191 && json.hf[0] >= 19 && json.hf[1] >= 1) {
      await Storage.put(hasSeenHardfork191ItemId, true);
      hasSeenHardfork191 = true;
    }
  }
}
