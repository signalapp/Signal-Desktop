// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { waitForAll } from './waitForAll.std.ts';
import {
  type AciString,
  type ServiceIdString,
} from '../types/ServiceId.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import { QualifiedAddress } from '../types/QualifiedAddress.std.ts';
import { Address } from '../types/Address.std.ts';
import type { MismatchedDevicesError } from '../textsecure/Errors.std.ts';

export async function handleMismatchedDevicesError(
  error: MismatchedDevicesError,
  {
    fetchKeysForServiceId,
    log,
    ourAci,
  }: {
    fetchKeysForServiceId: (
      serviceId: ServiceIdString,
      devices: Array<number> | null
    ) => Promise<void>;
    log: LoggerType;
    ourAci: AciString;
  }
): Promise<void> {
  log.warn(
    `libsignal threw MismatchedDevices, with ${error.entries?.length} entries`
  );

  await waitForAll({
    maxConcurrency: 3,
    tasks: error.entries.map(entry => async () => {
      const serviceId = entry.serviceId;
      const isEmpty =
        entry.missingDevices.length === 0 &&
        entry.extraDevices.length === 0 &&
        entry.staleDevices.length === 0;

      if (isEmpty) {
        log.warn(
          `MismatchedDevices: Entry for ${serviceId} was empty - fetching all keys`
        );
        await fetchKeysForServiceId(serviceId, null);
      }

      // Start sessions for missing devices
      if (entry.missingDevices.length > 0) {
        await fetchKeysForServiceId(serviceId, entry.missingDevices);
      }

      // Archive sessions for extra devices
      await waitForAll({
        tasks: entry.extraDevices.map(deviceId => async () => {
          await signalProtocolStore.archiveSession(
            new QualifiedAddress(ourAci, Address.create(serviceId, deviceId))
          );
        }),
      });

      // Archive sessions for stale devices
      await waitForAll({
        tasks: entry.staleDevices.map(device => async () => {
          await signalProtocolStore.archiveSession(
            new QualifiedAddress(ourAci, Address.create(serviceId, device))
          );
        }),
      });

      // And start new sessions for the new (fresh-not-stale) devices
      if (entry.staleDevices.length > 0) {
        // Start new sessions; previous session was stale
        await fetchKeysForServiceId(serviceId, entry.staleDevices);
      }
    }),
  });
}
