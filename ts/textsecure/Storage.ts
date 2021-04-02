// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */
import utils from './Helpers';

// Default implementation working with localStorage
const localStorageImpl: StorageInterface = {
  put(key: string, value: any) {
    if (value === undefined) {
      throw new Error('Tried to store undefined');
    }
    localStorage.setItem(`${key}`, utils.jsonThing(value));
  },

  get(key: string, defaultValue: any) {
    const value = localStorage.getItem(`${key}`);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value);
  },

  remove(key: string) {
    localStorage.removeItem(`${key}`);
  },
};

export type StorageInterface = {
  put(key: string, value: any): void | Promise<void>;
  get(key: string, defaultValue: any): any;
  remove(key: string): void | Promise<void>;
};

const Storage = {
  impl: localStorageImpl,

  put(key: string, value: unknown): Promise<void> | void {
    return Storage.impl.put(key, value);
  },

  get(key: string, defaultValue: unknown): Promise<unknown> {
    return Storage.impl.get(key, defaultValue);
  },

  remove(key: string): Promise<void> | void {
    return Storage.impl.remove(key);
  },
};

export default Storage;
