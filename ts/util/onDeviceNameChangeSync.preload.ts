// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import type { DeviceNameChangeSyncEvent } from '../textsecure/messageReceiverEvents.std.js';
import { getDevices } from '../textsecure/WebAPI.preload.js';
import { MINUTE } from './durations/index.std.js';
import { strictAssert } from './assert.std.js';
import { parseIntOrThrow } from './parseIntOrThrow.std.js';
import { createLogger } from '../logging/log.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { drop } from './drop.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { accountManager } from '../textsecure/AccountManager.preload.js';

const log = createLogger('onDeviceNameChangeSync');

const deviceNameFetchQueue = new PQueue({
  concurrency: 1,
  timeout: 5 * MINUTE,
  throwOnTimeout: true,
});

export async function onDeviceNameChangeSync(
  event: DeviceNameChangeSyncEvent
): Promise<void> {
  const { confirm } = event;

  const maybeQueueAndThenConfirm = async () => {
    await maybeQueueDeviceNameFetch();
    confirm();
  };

  drop(maybeQueueAndThenConfirm());
}

export async function maybeQueueDeviceNameFetch(): Promise<void> {
  if (deviceNameFetchQueue.size >= 1) {
    log.info('maybeQueueDeviceNameFetch: skipping; fetch already queued');
  }

  try {
    await deviceNameFetchQueue.add(fetchAndUpdateDeviceName);
  } catch (e) {
    log.error(
      'maybeQueueDeviceNameFetch: error when fetching device name',
      toLogFormat(e)
    );
  }
}

async function fetchAndUpdateDeviceName() {
  const { devices } = await getDevices();
  const localDeviceId = parseIntOrThrow(
    itemStorage.user.getDeviceId(),
    'fetchAndUpdateDeviceName: localDeviceId'
  );
  const ourDevice = devices.find(device => device.id === localDeviceId);
  strictAssert(ourDevice, 'ourDevice must be returned from devices endpoint');

  const newNameEncrypted = ourDevice.name;

  if (!newNameEncrypted) {
    log.error('fetchAndUpdateDeviceName: device had empty name');
    return;
  }

  let newName: string;
  try {
    newName = await accountManager.decryptDeviceName(newNameEncrypted);
  } catch (e) {
    const deviceNameWasEncrypted = itemStorage.user.getDeviceNameEncrypted();
    log.error(
      `fetchAndUpdateDeviceName: failed to decrypt device name. Was encrypted local state: ${deviceNameWasEncrypted}`
    );
    return;
  }

  const existingName = itemStorage.user.getDeviceName();
  if (newName === existingName) {
    log.info('fetchAndUpdateDeviceName: new name matches existing name');
    return;
  }

  await itemStorage.user.setDeviceName(newName);
  window.Whisper.events.emit('deviceNameChanged');
  log.info(
    'fetchAndUpdateDeviceName: successfully updated new device name locally'
  );
}
