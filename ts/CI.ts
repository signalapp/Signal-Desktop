// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { explodePromise } from './util/explodePromise';
import { SECOND } from './util/durations';
import * as log from './logging/log';
import type { IPCResponse as ChallengeResponseType } from './challenge';

type ResolveType = (data: unknown) => void;

export type CIType = {
  deviceName: string;
  handleEvent: (event: string, data: unknown) => unknown;
  setProvisioningURL: (url: string) => unknown;
  solveChallenge: (response: ChallengeResponseType) => unknown;
  waitForEvent: (event: string, timeout?: number) => unknown;
};

export function getCI(deviceName: string): CIType {
  const eventListeners = new Map<string, Array<ResolveType>>();
  const completedEvents = new Map<string, Array<unknown>>();

  ipcRenderer.on('ci:event', (_, event, data) => {
    handleEvent(event, data);
  });

  function waitForEvent(event: string, timeout = 60 * SECOND) {
    const pendingCompleted = completedEvents.get(event) || [];
    const pending = pendingCompleted.shift();
    if (pending) {
      log.info(`CI: resolving pending result for ${event}`, pending);

      if (pendingCompleted.length === 0) {
        completedEvents.delete(event);
      }

      return pending;
    }

    log.info(`CI: waiting for event ${event}`);
    const { resolve, reject, promise } = explodePromise();

    const timer = setTimeout(() => {
      reject(new Error('Timed out'));
    }, timeout);

    let list = eventListeners.get(event);
    if (!list) {
      list = [];
      eventListeners.set(event, list);
    }

    list.push((value: unknown) => {
      clearTimeout(timer);
      resolve(value);
    });

    return promise;
  }

  function setProvisioningURL(url: string): void {
    handleEvent('provisioning-url', url);
  }

  function handleEvent(event: string, data: unknown): void {
    const list = eventListeners.get(event) || [];
    const resolve = list.shift();

    if (resolve) {
      if (list.length === 0) {
        eventListeners.delete(event);
      }

      log.info(`CI: got event ${event} with data`, data);
      resolve(data);
      return;
    }

    log.info(`CI: postponing event ${event}`);

    let resultList = completedEvents.get(event);
    if (!resultList) {
      resultList = [];
      completedEvents.set(event, resultList);
    }
    resultList.push(data);
  }

  function solveChallenge(response: ChallengeResponseType): void {
    window.Signal.challengeHandler?.onResponse(response);
  }

  return {
    deviceName,
    handleEvent,
    setProvisioningURL,
    solveChallenge,
    waitForEvent,
  };
}
