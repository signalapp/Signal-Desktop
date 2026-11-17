// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { getDevices } from '../textsecure/WebAPI.preload.ts';
import { MINUTE } from './durations/index.std.ts';
import { strictAssert } from './assert.std.ts';
import { parseIntOrThrow } from './parseIntOrThrow.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { drop } from './drop.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import {
  decryptDeviceCreatedAt,
  decryptDeviceName,
} from './decryptDevice.preload.ts';

import type { DeviceNameChangeSyncEvent } from '../textsecure/messageReceiverEvents.std.ts';

const log = createLogger('onDeviceNameChangeSync');

const deviceNameFetchQueue = new PQueue({
  concurrency: 1,
  timeout: 5 * MINUTE,
});

export async function onDeviceNameChangeSync(
  event: DeviceNameChangeSyncEvent
): Promise<void> {
  const { confirm } = event;

  const maybeQueueAndThenConfirm = async () => {
    await maybeQueueDeviceInfoFetch();
    confirm();
  };

  drop(maybeQueueAndThenConfirm());
}

export async function maybeQueueDeviceInfoFetch(): Promise<void> {
  if (window.ConversationController.areWePrimaryDevice()) {
    log.info(
      'maybeQueueDeviceInfoFetch: We are primary device; no need to fetch device name'
    );
    return;
  }

  if (deviceNameFetchQueue.size >= 1) {
    log.info('maybeQueueDeviceInfoFetch: skipping; fetch already queued');
    return;
  }

  try {
    await deviceNameFetchQueue.add(fetchAndUpdateDeviceInfo);
  } catch (e) {
    log.error(
      'maybeQueueDeviceInfoFetch: error when fetching device name',
      toLogFormat(e)
    );
  }
}

async function fetchAndUpdateDeviceInfo() {
  const devices = await getDevices();
  const localDeviceId = parseIntOrThrow(
    itemStorage.user.getDeviceId(),
    'fetchAndUpdateDeviceInfo: localDeviceId'
  );
  const ourDevice = devices.find(device => device.id === localDeviceId);
  strictAssert(ourDevice, 'ourDevice must be returned from devices endpoint');

  await maybeUpdateDeviceCreatedAt(
    ourDevice.createdAtCiphertext,
    localDeviceId
  );

  if (ourDevice.encryptedName.length === 0) {
    log.error('fetchAndUpdateDeviceInfo: device had empty name');
    return;
  }

  let newName: string;
  try {
    newName = await decryptDeviceName(ourDevice.encryptedName);
  } catch (e) {
    const deviceNameWasEncrypted = itemStorage.user.getDeviceNameEncrypted();
    log.error(
      `fetchAndUpdateDeviceInfo: failed to decrypt device name. Was encrypted local state: ${deviceNameWasEncrypted}`
    );
    return;
  }

  const existingName = itemStorage.user.getDeviceName();
  if (newName === existingName) {
    log.info('fetchAndUpdateDeviceInfo: new name matches existing name');
    return;
  }

  await itemStorage.user.setDeviceName(newName);
  window.Whisper.events.emit('deviceNameChanged');
  log.info(
    'fetchAndUpdateDeviceInfo: successfully updated new device name locally'
  );
}

async function maybeUpdateDeviceCreatedAt(
  createdAtCiphertext: Uint8Array<ArrayBuffer>,
  deviceId: number
): Promise<void> {
  const existingCreatedAt = itemStorage.user.getDeviceCreatedAt();
  if (existingCreatedAt) {
    return;
  }

  let createdAt: number | undefined;
  try {
    const ourAci = itemStorage.user.getCheckedAci();
    const registrationId =
      await signalProtocolStore.getLocalRegistrationId(ourAci);
    if (!registrationId) {
      throw new Error('decryptDeviceCreatedAt: No registrationId for our Aci!');
    }

    createdAt = await decryptDeviceCreatedAt(
      createdAtCiphertext,
      registrationId,
      deviceId
    );
  } catch (e) {
    log.error(
      'maybeUpdateDeviceCreatedAt: failed to decrypt device createdAt',
      toLogFormat(e)
    );
  }

  if (createdAt) {
    await itemStorage.user.setDeviceCreatedAt(createdAt);
    log.info('maybeUpdateDeviceCreatedAt: saved createdAt');
  }
}
