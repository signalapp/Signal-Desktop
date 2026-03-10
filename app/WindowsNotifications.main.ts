// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain as ipc, app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

import { AUMID } from './startup_config.main.js';
import type {
  WindowsNotificationWorkerDataType,
  WindowsNotificationRequestType,
  WindowsNotificationData,
} from '../ts/types/notifications.std.js';
import { WindowsNotificationDataSchema } from '../ts/types/notifications.std.js';
import OS from '../ts/util/os/osMain.node.js';
import { createLogger } from '../ts/logging/log.std.js';

const log = createLogger('WindowsNotifications');

let worker: Worker | undefined;

if (OS.isWindows()) {
  const scriptPath = join(
    app.getAppPath(),
    'app',
    'WindowsNotificationsWorker.node.js'
  );

  worker = new Worker(scriptPath, {
    workerData: {
      AUMID,
    } satisfies WindowsNotificationWorkerDataType,
  });
}

export function sendDummyKeystroke(): void {
  if (worker == null) {
    log.warn('sendDummyKeystroke without worker');
    return;
  }
  worker.postMessage({
    command: 'sendDummyKeystroke',
  } satisfies WindowsNotificationRequestType);
}

export function show(notificationData: WindowsNotificationData): void {
  if (worker == null) {
    log.warn('show without worker');
    return;
  }
  worker.postMessage({
    command: 'show',
    notificationData,
  } satisfies WindowsNotificationRequestType);
}

ipc.handle(
  'windows-notifications:show',
  (_event: IpcMainInvokeEvent, data: unknown) => {
    try {
      const notificationData = WindowsNotificationDataSchema.parse(data);
      show(notificationData);
    } catch (error) {
      log.error('failed to parse notification data', error.stack);
    }
  }
);

ipc.handle('windows-notifications:clear-all', () => {
  if (worker == null) {
    log.warn('clear all without worker');
    return;
  }
  worker.postMessage({
    command: 'clearAll',
  } satisfies WindowsNotificationRequestType);
});
