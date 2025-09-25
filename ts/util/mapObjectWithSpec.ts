// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable @typescript-eslint/no-explicit-any */

import lodash from 'lodash';

const { cloneDeep, get, set } = lodash;

export type ObjectMappingSpecType =
  | string
  | ReadonlyArray<ObjectMappingSpecType>
  | Readonly<{
      key: string;
      valueSpec: ObjectMappingSpecType;
    }>
  | Readonly<{
      isMap: true;
      valueSpec: ObjectMappingSpecType;
    }>;

export function mapObjectWithSpec<Input, Output>(
  spec: ObjectMappingSpecType,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  data: any,
  map: (value: Input) => Output,
  target = cloneDeep(data)
): any {
  if (!data) {
    return target;
  }

  if (typeof spec === 'string') {
    const value = get(data, spec);

    if (value) {
      set(target, spec, map(value));
    }
    return target;
  }

  if ('isMap' in spec) {
    for (const key of Object.keys(data)) {
      // eslint-disable-next-line no-param-reassign
      target[key] = mapObjectWithSpec(
        spec.valueSpec,
        data[key],
        map,
        target[key]
      );
    }
    return target;
  }

  if ('key' in spec) {
    // eslint-disable-next-line no-param-reassign
    target[spec.key] = mapObjectWithSpec(
      spec.valueSpec,
      data[spec.key],
      map,
      target[spec.key]
    );
    return target;
  }

  for (const key of spec) {
    mapObjectWithSpec(key, data, map, target);
  }

  return target;
}
