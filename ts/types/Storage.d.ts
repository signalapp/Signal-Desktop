// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageAccessType } from './StorageKeys.std.js';

export type { StorageAccessType } from './StorageKeys.std.js';

export type StorageInterface = {
  onready(callback: () => void): void;

  get<K extends keyof StorageAccessType, V extends StorageAccessType[K]>(
    key: K
  ): V | undefined;

  get<K extends keyof StorageAccessType, V extends StorageAccessType[K]>(
    key: K,
    defaultValue: V
  ): V;

  put<K extends keyof StorageAccessType>(
    key: K,
    value: StorageAccessType[K]
  ): Promise<void>;

  remove<K extends keyof StorageAccessType>(key: K): Promise<void>;
};
