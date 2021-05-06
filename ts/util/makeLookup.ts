import { fromPairs, map } from 'lodash';

export function makeLookup<T>(items: Array<T>, key: string): { [key: string]: T } {
  // Yep, we can't index into item without knowing what it is. True. But we want to.
  // @ts-ignore
  const pairs = map(items, item => [item[key], item]);

  return fromPairs(pairs);
}
