/**
 * @prettier
 */

// IndexedDB doesn’t support boolean indexes so we map `true` to 1 and `false`
// to `0`.
// N.B. Using `undefined` allows excluding an entry from an index. Useful
// when index size is a consideration or one only needs to query for `true`.
export type IndexableBoolean = 1 | 0;

export const toIndexableBoolean = (value: boolean): IndexableBoolean =>
  value ? 1 : 0;
