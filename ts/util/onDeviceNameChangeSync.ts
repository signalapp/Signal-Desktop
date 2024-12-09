// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import type { DeviceNameChangeSyncEvent } from '../textsecure/messageReceiverEvents';
import { MINUTE } from './durations';
import { strictAssert } from './assert';
import { parseIntOrThrow } from './parseIntOrThrow';
import * as log from '../logging/log';
import { toLogFormat } from '../types/errors';
import { drop } from './drop';

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
  strictAssert(window.textsecure.server, 'WebAPI must be initialized');
  const { devices } = await window.textsecure.server.getDevices();
  const localDeviceId = parseIntOrThrow(
    window.textsecure.storage.user.getDeviceId(),
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
    newName = await window
      .getAccountManager()
      .decryptDeviceName(newNameEncrypted);
  } catch (e) {
    const deviceNameWasEncrypted =
      window.textsecure.storage.user.getDeviceNameEncrypted();
    log.error(
      `fetchAndUpdateDeviceName: failed to decrypt device name. Was encrypted local state: ${deviceNameWasEncrypted}`
    );
    return;
  }

  const existingName = window.storage.user.getDeviceName();
  if (newName === existingName) {
    log.info('fetchAndUpdateDeviceName: new name matches existing name');
    return;
  }

  await window.storage.user.setDeviceName(newName);
  log.info(
    'fetchAndUpdateDeviceName: successfully updated new device name locally'
  );
}
