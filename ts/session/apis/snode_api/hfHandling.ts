import { isNumber } from 'lodash';
import { createOrUpdateItem, getItemById } from '../../../data/channelsItem';

let hasSeenHardfork190: boolean | undefined;
let hasSeenHardfork191: boolean | undefined;

/**
 * this is only intended for testing. Do not call this in production.
 */
export function resetHardForkCachedValues() {
  hasSeenHardfork190 = hasSeenHardfork191 = undefined;
}

export async function getHasSeenHF190() {
  if (hasSeenHardfork190 === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldHhasSeenHardfork190 = (await getItemById('hasSeenHardfork190'))?.value;
    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldHhasSeenHardfork190 === undefined) {
      await createOrUpdateItem({ id: 'hasSeenHardfork190', value: false });
      hasSeenHardfork190 = false;
    } else {
      hasSeenHardfork190 = oldHhasSeenHardfork190;
    }
  }
  return hasSeenHardfork190;
}

export async function getHasSeenHF191() {
  if (hasSeenHardfork191 === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldHhasSeenHardfork191 = (await getItemById('hasSeenHardfork191'))?.value;

    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldHhasSeenHardfork191 === undefined) {
      await createOrUpdateItem({ id: 'hasSeenHardfork191', value: false });
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
    const oldHhasSeenHardfork190 = (await getItemById('hasSeenHardfork190'))?.value;
    const oldHasSeenHardfork191 = (await getItemById('hasSeenHardfork191'))?.value;

    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldHhasSeenHardfork190 === undefined) {
      await createOrUpdateItem({ id: 'hasSeenHardfork190', value: false });
      hasSeenHardfork190 = false;
    } else {
      hasSeenHardfork190 = oldHhasSeenHardfork190;
    }
    if (oldHasSeenHardfork191 === undefined) {
      await createOrUpdateItem({ id: 'hasSeenHardfork191', value: false });
      hasSeenHardfork191 = false;
    } else {
      hasSeenHardfork191 = oldHasSeenHardfork191;
    }
  }

  if (hasSeenHardfork191 && hasSeenHardfork190) {
    // no need to do any of this if we already know both forks happened
    window.log.info('hardfork 19.1 already happened. No need to go any further');
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
      window.log.info('[HF]: We just detected HF 19.0 on "retrieve"');
      await createOrUpdateItem({ id: 'hasSeenHardfork190', value: true });
      hasSeenHardfork190 = true;
    }
    if (!hasSeenHardfork191 && json.hf[0] >= 19 && json.hf[1] >= 1) {
      window.log.info('[HF]: We just detected HF 19.1 on "retrieve"');
      await createOrUpdateItem({ id: 'hasSeenHardfork191', value: true });
      hasSeenHardfork191 = true;
    }
  }
}
