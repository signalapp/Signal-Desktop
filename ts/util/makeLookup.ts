import { fromPairs, map } from 'lodash';

export function makeLookup<T>(
  items: Array<T>,
  key: keyof T
): { [key: string]: T } {
  const pairs = map(items, item => [item[key], item]);

  return fromPairs(pairs);
}
