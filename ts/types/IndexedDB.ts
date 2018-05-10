// IndexedDB doesn’t support boolean indexes so we map `true` to 1 and `false`
// to `0`, i.e. `IndexableBoolean`.
// N.B. Using `undefined` allows excluding an entry from an index. Useful
// when index size is a consideration or one only needs to query for `true`,
// i.e. `IndexablePresence`.
export type IndexableBoolean = IndexableFalse | IndexableTrue;
export type IndexablePresence = undefined | IndexableTrue;

type IndexableFalse = 0;
type IndexableTrue = 1;

export const INDEXABLE_FALSE: IndexableFalse = 0;
export const INDEXABLE_TRUE: IndexableTrue = 1;

export const toIndexableBoolean = (value: boolean): IndexableBoolean =>
  value ? INDEXABLE_TRUE : INDEXABLE_FALSE;

export const toIndexablePresence = (value: boolean): IndexablePresence =>
  value ? INDEXABLE_TRUE : undefined;
