// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
  // oxlint-disable-next-line typescript/explicit-module-boundary-types, typescript/no-explicit-any
  data: any,
  map: (value: Input) => Output,
  target = cloneDeep(data)
  // oxlint-disable-next-line typescript/no-explicit-any
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
      // oxlint-disable-next-line no-param-reassign
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
    // oxlint-disable-next-line no-param-reassign
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
