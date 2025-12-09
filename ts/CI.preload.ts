// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { format } from 'node:util';
import { ipcRenderer } from 'electron';

import type { IPCResponse as ChallengeResponseType } from './challenge.dom.js';
import type { MessageAttributesType } from './model-types.d.ts';
import { createLogger } from './logging/log.std.js';
import { explodePromise } from './util/explodePromise.std.js';
import { AccessType, ipcInvoke } from './sql/channels.preload.js';
import { backupsService } from './services/backups/index.preload.js';
import { notificationService } from './services/notifications.preload.js';
import { challengeHandler } from './services/challengeHandler.preload.js';
import { AttachmentBackupManager } from './jobs/AttachmentBackupManager.preload.js';
import { migrateAllMessages } from './messages/migrateMessageData.preload.js';
import { SECOND } from './util/durations/index.std.js';
import { isSignalRoute } from './util/signalRoutes.std.js';
import { strictAssert } from './util/assert.std.js';
import { MessageModel } from './models/messages.preload.js';
import type { SocketStatuses } from './textsecure/SocketManager.preload.js';
import { itemStorage } from './textsecure/Storage.preload.js';
import { BackupLevel } from './services/backups/types.std.js';

const log = createLogger('CI');

type ResolveType = (data: unknown) => void;

export type CIType = {
  deviceName: string;
  getConversationId: (address: string | null) => string | null;
  createNotificationToken: (address: string) => string | undefined;
  getMessagesBySentAt(
    sentAt: number
  ): Promise<ReadonlyArray<MessageAttributesType>>;
  getPendingEventCount: (event: string) => number;
  getSocketStatus: () => SocketStatuses;
  handleEvent: (event: string, data: unknown) => unknown;
  setProvisioningURL: (url: string) => unknown;
  setPreloadCacheHit: (value: boolean) => unknown;
  solveChallenge: (response: ChallengeResponseType) => unknown;
  waitForEvent: (
    event: string,
    options: {
      timeout?: number;
      ignorePastEvents?: boolean;
    }
  ) => unknown;
  openSignalRoute(url: string): Promise<void>;
  migrateAllMessages(): Promise<void>;
  exportLocalBackup(backupsBaseDir: string): Promise<string>;
  stageLocalBackupForImport(snapshotDir: string): Promise<void>;
  uploadBackup(): Promise<void>;
  unlink: () => void;
  print: (...args: ReadonlyArray<unknown>) => void;
  resetReleaseNoteAndMegaphoneFetcher(): void;
  forceUnprocessed: boolean;
  setMediaPermissions(): Promise<void>;
  maybeUpdateMaxAudioLevel: (level: number) => void;
  getAndResetMaxAudioLevel: () => number | undefined;
};

export type GetCIOptionsType = Readonly<{
  deviceName: string;
  forceUnprocessed: boolean;
}>;

export function getCI({
  deviceName,
  forceUnprocessed,
}: GetCIOptionsType): CIType {
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
      if (pendingCompleted.length) {
        const pending = pendingCompleted.shift();
        log.info(`resolving pending result for ${event}`, pending);

        if (pendingCompleted.length === 0) {
          completedEvents.delete(event);
        }

        return pending;
      }
    }

    log.info(`waiting for event ${event}`);
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

  function getPendingEventCount(event: string): number {
    const completed = completedEvents.get(event) || [];
    return completed.length;
  }

  function setProvisioningURL(url: string): void {
    handleEvent('provisioning-url', url);
  }

  function setPreloadCacheHit(value: boolean): void {
    handleEvent('preload-cache-hit', value);
  }

  function handleEvent(event: string, data: unknown): void {
    const list = eventListeners.get(event) || [];
    const resolve = list.shift();

    if (resolve) {
      if (list.length === 0) {
        eventListeners.delete(event);
      }

      log.info(`got event ${event} with data`, data);
      resolve(data);
      return;
    }

    log.info(`postponing event ${event}`);

    let resultList = completedEvents.get(event);
    if (!resultList) {
      resultList = [];
      completedEvents.set(event, resultList);
    }
    resultList.push(data);
  }

  function solveChallenge(response: ChallengeResponseType): void {
    challengeHandler.onResponse(response);
  }

  async function getMessagesBySentAt(sentAt: number) {
    const messages = await ipcInvoke<ReadonlyArray<MessageAttributesType>>(
      AccessType.Read,
      'getMessagesBySentAt',
      [sentAt]
    );
    return messages.map(
      m => window.MessageCache.register(new MessageModel(m)).attributes
    );
  }

  function getConversationId(address: string | null): string | null {
    return window.ConversationController.getConversationId(address);
  }

  function createNotificationToken(address: string): string | undefined {
    const id = window.ConversationController.getConversationId(address);
    if (!id) {
      return undefined;
    }

    return notificationService._createToken({
      conversationId: id,
      messageId: undefined,
      storyId: undefined,
    });
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

  async function exportLocalBackup(backupsBaseDir: string): Promise<string> {
    const { snapshotDir } = await backupsService.exportLocalEncryptedBackup({
      backupsBaseDir,
      onProgress: () => null,
      abortSignal: new AbortController().signal,
    });
    return snapshotDir;
  }

  async function stageLocalBackupForImport(snapshotDir: string): Promise<void> {
    const { error } =
      await backupsService.stageLocalBackupForImport(snapshotDir);
    if (error) {
      throw error;
    }
  }

  async function uploadBackup() {
    await itemStorage.put('backupTier', BackupLevel.Paid);
    await backupsService.upload();
    await AttachmentBackupManager.waitForIdle();

    // Remove the disclaimer from conversation hero for screenshot backup test
    await itemStorage.put('isRestoredFromBackup', true);
  }

  function unlink() {
    window.Whisper.events.emit('unlinkAndDisconnect');
  }

  function print(...args: ReadonlyArray<unknown>) {
    handleEvent('print', format(...args));
  }

  function getSocketStatus() {
    return window.getSocketStatus();
  }

  async function resetReleaseNoteAndMegaphoneFetcher() {
    await Promise.all([
      itemStorage.put('releaseNotesVersionWatermark', '7.0.0-alpha.1'),
      itemStorage.put('releaseNotesPreviousManifestHash', ''),
      itemStorage.put('releaseNotesNextFetchTime', Date.now()),
    ]);
  }

  async function setMediaPermissions() {
    await window.IPC.setMediaPermissions(true);
  }

  let maxAudioLevel: number | undefined;

  function maybeUpdateMaxAudioLevel(level: number) {
    if (maxAudioLevel === undefined || maxAudioLevel < level) {
      maxAudioLevel = level;
    }
  }

  // Tracker for maximum received audio level in a 1:1 call
  // We get and reset because:
  // (a) updates are frequent (every 200ms) and
  // (b) current test use cases want "max since I last asked"
  function getAndResetMaxAudioLevel(): number | undefined {
    const level = maxAudioLevel;
    maxAudioLevel = undefined;
    return level;
  }

  return {
    deviceName,
    getConversationId,
    createNotificationToken,
    getMessagesBySentAt,
    getSocketStatus,
    handleEvent,
    setProvisioningURL,
    setPreloadCacheHit,
    solveChallenge,
    waitForEvent,
    openSignalRoute,
    migrateAllMessages,
    exportLocalBackup,
    stageLocalBackupForImport,
    uploadBackup,
    unlink,
    getPendingEventCount,
    print,
    resetReleaseNoteAndMegaphoneFetcher,
    forceUnprocessed,
    setMediaPermissions,
    maybeUpdateMaxAudioLevel,
    getAndResetMaxAudioLevel,
  };
}
