// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { createLogger } from '../logging/log.std.ts';

import { isIterable } from '../util/iterables.std.ts';

import { toNumber } from '../util/toNumber.std.ts';
import { isNonSharedUint8Array } from '../Bytes.std.ts';

const { isPlainObject } = lodash;

const log = createLogger('cleanDataForIpc');

/**
 * IPC arguments are serialized with the [structured clone algorithm][0], but we can only
 * save some data types to disk.
 *
 * This cleans the data so it's roughly JSON-serializable, though it does not handle
 * every case. You can see the expected behavior in the tests. Notably, we try to convert
 * bigint numbers to plain numbers, and we don't touch ArrayBuffers.
 *
 * [0]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
 */
export function cleanDataForIpc(data: unknown): {
  // `any`s are dangerous but it's difficult (impossible?) to type this with generics.
  // oxlint-disable-next-line typescript/no-explicit-any
  cleaned: any;
  pathsChanged: Array<string>;
} {
  const pathsChanged: Array<string> = [];
  const cleaned = cleanDataInner(data, 'root', pathsChanged, 0);
  return { cleaned, pathsChanged };
}

// These type definitions are lifted from [this GitHub comment][1].
//
// [1]: https://github.com/Microsoft/TypeScript/issues/3496#issuecomment-128553540
type CleanedDataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Uint8Array<ArrayBuffer>
  | CleanedObject
  | Array<CleanedDataValue>;

// oxlint-disable-next-line typescript/consistent-type-definitions
interface CleanedObject {
  [x: string]: CleanedDataValue;
}

type CleanedArray = Array<CleanedDataValue>;

function cleanDataInner(
  data: unknown,
  path: string,
  pathsChanged: Array<string>,
  depth: number
): CleanedDataValue {
  if (depth > 10) {
    log.error(
      `cleanDataInner: Reached maximum depth ${depth}; path is ${path}`
    );
    // oxlint-disable-next-line typescript/no-explicit-any
    return { cleaned: data as any, pathsChanged };
  }

  switch (typeof data) {
    case 'undefined':
    case 'boolean':
    case 'number':
    case 'string':
      return data;
    case 'bigint':
      pathsChanged.push(path);
      return data.toString();
    case 'function':
      // For backwards compatibility with previous versions of this function, we clean
      //   functions but don't mark them as cleaned.
      return undefined;
    case 'object': {
      // oxlint-disable-next-line eqeqeq
      if (data === null) {
        return null;
      }

      if (Array.isArray(data)) {
        const result: CleanedArray = [];
        data.forEach((item, index) => {
          const indexPath = `${path}.${index}`;
          if (item == null) {
            pathsChanged.push(indexPath);
          } else {
            result.push(
              cleanDataInner(item, indexPath, pathsChanged, depth + 1)
            );
          }
        });
        return result;
      }

      if (data instanceof Map) {
        const result: CleanedObject = {};
        pathsChanged.push(path);
        data.forEach((value, key) => {
          if (typeof key === 'string') {
            result[key] = cleanDataInner(
              value,
              `${path}.<map value at ${key}>`,
              pathsChanged,
              depth + 1
            );
          } else {
            pathsChanged.push(`${path}.<map key ${String(key)}>`);
          }
        });
        return result;
      }

      if (data instanceof Date) {
        pathsChanged.push(path);
        return Number.isNaN(data.valueOf()) ? undefined : data.toISOString();
      }

      if (data instanceof ArrayBuffer) {
        pathsChanged.push(path);
        return undefined;
      }

      if (isNonSharedUint8Array(data)) {
        return data;
      }

      const dataAsRecord = data as Record<string, unknown>;

      if (typeof dataAsRecord === 'bigint') {
        // We clean this just in case `toNumber` returns something bogus.
        return cleanDataInner(
          toNumber(dataAsRecord),
          path,
          pathsChanged,
          depth + 1
        );
      }

      if (isIterable(dataAsRecord)) {
        const result: CleanedArray = [];
        let index = 0;
        pathsChanged.push(path);
        for (const value of dataAsRecord) {
          result.push(
            cleanDataInner(
              value,
              `${path}.<iterator index ${index}>`,
              pathsChanged,
              depth + 1
            )
          );
          index += 1;
        }
        return result;
      }

      // We'll still try to clean non-plain objects, but we want to mark that they've
      //   changed.
      if (!isPlainObject(data)) {
        pathsChanged.push(path);
      }

      const result: CleanedObject = {};

      // Conveniently, `Object.entries` removes symbol keys.
      Object.entries(dataAsRecord).forEach(([key, value]) => {
        result[key] = cleanDataInner(
          value,
          `${path}.${key}`,
          pathsChanged,
          depth + 1
        );
      });

      return result;
    }
    default: {
      pathsChanged.push(path);
      return undefined;
    }
  }
}
