// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { explodePromise } from './util/explodePromise';
import { SECOND } from './util/durations';
import * as log from './logging/log';

type ResolveType = (data: unknown) => void;

export class CI {
  private readonly eventListeners = new Map<string, Array<ResolveType>>();

  private readonly completedEvents = new Map<string, Array<unknown>>();

  constructor(public readonly deviceName: string) {
    ipcRenderer.on('ci:event', (_, event, data) => {
      this.handleEvent(event, data);
    });
  }

  public async waitForEvent(
    event: string,
    timeout = 60 * SECOND
  ): Promise<unknown> {
    const pendingCompleted = this.completedEvents.get(event) || [];
    const pending = pendingCompleted.shift();
    if (pending) {
      log.info(`CI: resolving pending result for ${event}`, pending);

      if (pendingCompleted.length === 0) {
        this.completedEvents.delete(event);
      }

      return pending;
    }

    log.info(`CI: waiting for event ${event}`);
    const { resolve, reject, promise } = explodePromise();

    const timer = setTimeout(() => {
      reject(new Error('Timed out'));
    }, timeout);

    let list = this.eventListeners.get(event);
    if (!list) {
      list = [];
      this.eventListeners.set(event, list);
    }

    list.push((value: unknown) => {
      clearTimeout(timer);
      resolve(value);
    });

    return promise;
  }

  public setProvisioningURL(url: string): void {
    this.handleEvent('provisioning-url', url);
  }

  public handleEvent(event: string, data: unknown): void {
    const list = this.eventListeners.get(event) || [];
    const resolve = list.shift();

    if (resolve) {
      if (list.length === 0) {
        this.eventListeners.delete(event);
      }

      log.info(`CI: got event ${event} with data`, data);
      resolve(data);
      return;
    }

    log.info(`CI: postponing event ${event}`);

    let resultList = this.completedEvents.get(event);
    if (!resultList) {
      resultList = [];
      this.completedEvents.set(event, resultList);
    }
    resultList.push(data);
  }
}
