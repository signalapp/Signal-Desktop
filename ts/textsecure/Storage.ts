// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  StorageAccessType as Access,
  StorageInterface,
} from '../types/Storage.d';
import { User } from './storage/User';
import { Blocked } from './storage/Blocked';

import { assertDev } from '../util/assert';
import { DataReader, DataWriter } from '../sql/Client';
import type { SignalProtocolStore } from '../SignalProtocolStore';
import * as log from '../logging/log';

export class Storage implements StorageInterface {
  public readonly user: User;

  public readonly blocked: Blocked;

  #ready = false;
  #readyCallbacks: Array<() => void> = [];
  #items: Partial<Access> = Object.create(null);
  #privProtocol: SignalProtocolStore | undefined;

  constructor() {
    this.user = new User(this);
    this.blocked = new Blocked(this);

    window.storage = this;
  }

  get protocol(): SignalProtocolStore {
    assertDev(
      this.#privProtocol !== undefined,
      'SignalProtocolStore not initialized'
    );
    return this.#privProtocol;
  }

  set protocol(value: SignalProtocolStore) {
    this.#privProtocol = value;
  }

  // `StorageInterface` implementation

  public get<K extends keyof Access, V extends Access[K]>(
    key: K
  ): V | undefined;

  public get<K extends keyof Access, V extends Access[K]>(
    key: K,
    defaultValue: V
  ): V;

  public get<K extends keyof Access>(
    key: K,
    defaultValue?: Access[K]
  ): Access[K] | undefined {
    if (!this.#ready) {
      log.warn('Called storage.get before storage is ready. key:', key);
    }

    const item = this.#items[key];
    if (item === undefined) {
      return defaultValue;
    }

    return item;
  }

  public async put<K extends keyof Access>(
    key: K,
    value: Access[K]
  ): Promise<void> {
    if (!this.#ready) {
      log.warn('Called storage.put before storage is ready. key:', key);
    }

    this.#items[key] = value;
    await DataWriter.createOrUpdateItem({ id: key, value });

    window.reduxActions?.items.putItemExternal(key, value);
  }

  public async remove<K extends keyof Access>(key: K): Promise<void> {
    if (!this.#ready) {
      log.warn('Called storage.remove before storage is ready. key:', key);
    }

    delete this.#items[key];
    await DataWriter.removeItemById(key);

    window.reduxActions?.items.removeItemExternal(key);
  }

  // Regular methods

  public onready(callback: () => void): void {
    if (this.#ready) {
      callback();
    } else {
      this.#readyCallbacks.push(callback);
    }
  }

  public async fetch(): Promise<void> {
    this.reset();

    Object.assign(this.#items, await DataReader.getAllItems());

    this.#ready = true;
    this.#callListeners();
  }

  public reset(): void {
    this.#ready = false;
    this.#items = Object.create(null);
  }

  public getItemsState(): Partial<Access> {
    if (!this.#ready) {
      log.warn('Called getItemsState before storage is ready');
    }

    log.info('Storage/getItemsState: now preparing copy of items...');

    const state = Object.create(null);

    const items = this.#items;
    const allKeys = Object.keys(items) as Array<keyof typeof items>;

    for (const key of allKeys) {
      state[key] = items[key];
    }

    return state;
  }

  #callListeners(): void {
    if (!this.#ready) {
      return;
    }
    const callbacks = this.#readyCallbacks;
    this.#readyCallbacks = [];
    callbacks.forEach(callback => callback());
  }
}
