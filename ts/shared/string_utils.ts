import { compact, uniq } from 'lodash';

/**
 * Returns a compact list of all the items present in all those arrays, once each only.
 */
export function uniqFromListOfList<T extends string>(list: Array<Array<T>>): Array<T> {
  return uniq(compact(list.flat()));
}
