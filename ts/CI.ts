// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { IPCResponse as ChallengeResponseType } from './challenge';
import type { MessageAttributesType } from './model-types.d';
import * as log from './logging/log';
import { explodePromise } from './util/explodePromise';
import { AccessType, ipcInvoke } from './sql/channels';
import { backupsService } from './services/backups';
import { SECOND } from './util/durations';
import { isSignalRoute } from './util/signalRoutes';
import { strictAssert } from './util/assert';

type ResolveType = (data: unknown) => void;

export type CIType = {
  deviceName: string;
  backupData?: Uint8Array;
  getConversationId: (address: string | null) => string | null;
  getMessagesBySentAt(
    sentAt: number
  ): Promise<ReadonlyArray<MessageAttributesType>>;
  handleEvent: (event: string, data: unknown) => unknown;
  setProvisioningURL: (url: string) => unknown;
  solveChallenge: (response: ChallengeResponseType) => unknown;
  waitForEvent: (
    event: string,
    options: {
      timeout?: number;
      ignorePastEvents?: boolean;
    }
  ) => unknown;
  openSignalRoute(url: string): Promise<void>;
  exportBackupToDisk(path: string): Promise<void>;
  unlink: () => void;
};

export type GetCIOptionsType = Readonly<{
  deviceName: string;
  backupData?: Uint8Array;
}>;

export function getCI({ deviceName, backupData }: GetCIOptionsType): CIType {
  const eventListeners = new Map<string, Array<ResolveType>>();
  const completedEvents = new Map<string, Array<unknown>>();

  ipcRenderer.on('ci:event', (_, event, data) => {
    handleEvent(event, data);
  });

  function waitForEvent(
    event: string,
    options: {
      timeout?: number;
      ignorePastEvents?: boolean;
    } = {}
  ) {
    const timeout = options?.timeout ?? 60 * SECOND;

    if (!options?.ignorePastEvents) {
      const pendingCompleted = completedEvents.get(event) || [];
      const pending = pendingCompleted.shift();
      if (pending) {
        log.info(`CI: resolving pending result for ${event}`, pending);

        if (pendingCompleted.length === 0) {
          completedEvents.delete(event);
        }

        return pending;
      }
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

  async function getMessagesBySentAt(sentAt: number) {
    const messages = await ipcInvoke<ReadonlyArray<MessageAttributesType>>(
      AccessType.Read,
      'getMessagesBySentAt',
      [sentAt]
    );
    return messages.map(
      m =>
        window.MessageCache.__DEPRECATED$register(
          m.id,
          m,
          'CI.getMessagesBySentAt'
        ).attributes
    );
  }

  function getConversationId(address: string | null): string | null {
    return window.ConversationController.getConversationId(address);
  }

  async function openSignalRoute(url: string) {
    strictAssert(
      isSignalRoute(url),
      `openSignalRoute: not a valid signal route ${url}`
    );
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function exportBackupToDisk(path: string) {
    await backupsService.exportToDisk(path);
  }

  function unlink() {
    window.Whisper.events.trigger('unlinkAndDisconnect');
  }

  return {
    deviceName,
    backupData,
    getConversationId,
    getMessagesBySentAt,
    handleEvent,
    setProvisioningURL,
    solveChallenge,
    waitForEvent,
    openSignalRoute,
    exportBackupToDisk,
    unlink,
  };
}
