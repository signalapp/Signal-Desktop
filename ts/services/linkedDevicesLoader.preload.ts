// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import { strictAssert } from '../util/assert.std.ts';

import type { LinkedDevice } from '../sql/Interface.std.ts';
import type { LinkedDevicesStateType } from '../state/ducks/linkedDevices.preload.ts';

let devices: ReadonlyArray<LinkedDevice> | undefined;

export async function loadLinkedDevices(): Promise<void> {
  devices = await DataReader.getAllLinkedDevices();
}

export function getLinkedDevicesStateForRedux(): LinkedDevicesStateType {
  strictAssert(devices, 'devices have not been fetched!');
  return {
    workflow: undefined,
    devices,
  };
}
