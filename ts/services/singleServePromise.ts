// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ExplodePromiseResultType } from '../util/explodePromise';
import type { UUIDStringType } from '../types/UUID';
import { UUID } from '../types/UUID';

// This module provides single serve promises in a pub/sub manner.
// One example usage is if you're calling a redux action creator but need to
// await some result within it, you may pass in this promise and access it in
// other parts of the app via its referencing UUID.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const promises = new Map<UUIDStringType, ExplodePromiseResultType<any>>();

export function set<T>(
  explodedPromise: ExplodePromiseResultType<T>
): UUIDStringType {
  let uuid = UUID.generate().toString();

  while (promises.has(uuid)) {
    uuid = UUID.generate().toString();
  }

  promises.set(uuid, {
    promise: explodedPromise.promise,
    resolve: value => {
      promises.delete(uuid);
      explodedPromise.resolve(value);
    },
    reject: err => {
      promises.delete(uuid);
      explodedPromise.reject(err);
    },
  });

  return uuid;
}

export function get<T>(
  uuid: UUIDStringType
): ExplodePromiseResultType<T> | undefined {
  return promises.get(uuid);
}
