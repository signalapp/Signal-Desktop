// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import * as Protos from '../../protos/compiled';
import { PRIMARY_DEVICE_ID } from '../constants';
import { unreachable } from '../util';
import type { Device } from './device';

import GrpcDeviceCapability = Protos.org.signal.chat.common.DeviceCapability;

const debug = createDebug('mock:capabilities');

export type DeviceCapability =
  | 'storage'
  | 'transfer'
  | 'attachmentBackfill'
  | 'spqr'
  | 'profiles_v2'
  | 'usernameChangeSyncMessage'
  | 'optionalPhoneNumber';

/** Which devices must have the capability for the account to have it */
export type AccountCapabilityMode =
  | 'primaryDevice'
  | 'anyDevice'
  | 'allDevices';

/** Who can see that the account has the capability */
export type AccountCapabilityVisibility = 'server' | 'self' | 'public';

type DeviceCapabilityConfig = Readonly<{
  grpc: GrpcDeviceCapability;
  accountCapabilityMode: AccountCapabilityMode;
  accountCapabilityVisibility: AccountCapabilityVisibility;
}>;

const DEVICE_CAPABILITIES: Readonly<
  Record<DeviceCapability, DeviceCapabilityConfig>
> = {
  storage: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_STORAGE,
    accountCapabilityMode: 'anyDevice',
    accountCapabilityVisibility: 'server',
  },
  transfer: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_TRANSFER,
    accountCapabilityMode: 'primaryDevice',
    accountCapabilityVisibility: 'server',
  },
  attachmentBackfill: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_ATTACHMENT_BACKFILL,
    accountCapabilityMode: 'primaryDevice',
    accountCapabilityVisibility: 'self',
  },
  spqr: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_SPARSE_POST_QUANTUM_RATCHET,
    accountCapabilityMode: 'allDevices',
    accountCapabilityVisibility: 'public',
  },
  profiles_v2: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_PROFILES_V2,
    accountCapabilityMode: 'allDevices',
    accountCapabilityVisibility: 'self',
  },
  usernameChangeSyncMessage: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_USERNAME_CHANGE_SYNC_MESSAGE,
    accountCapabilityMode: 'allDevices',
    accountCapabilityVisibility: 'self',
  },
  optionalPhoneNumber: {
    grpc: GrpcDeviceCapability.DEVICE_CAPABILITY_OPTIONAL_PHONE_NUMBER,
    accountCapabilityMode: 'allDevices',
    accountCapabilityVisibility: 'server',
  },
};

const ALL_DEVICE_CAPABILITIES = Object.keys(
  DEVICE_CAPABILITIES,
) as ReadonlyArray<DeviceCapability>;

export const SELF_VISIBLE_CAPABILITIES = ALL_DEVICE_CAPABILITIES.filter(
  (capability) => {
    const visibility =
      DEVICE_CAPABILITIES[capability].accountCapabilityVisibility;
    return visibility === 'self' || visibility === 'public';
  },
);

/** The capabilities Desktop sends */
export const DEFAULT_DEVICE_CAPABILITIES: ReadonlySet<DeviceCapability> =
  new Set([
    'attachmentBackfill',
    'spqr',
    'usernameChangeSyncMessage',
    'storage',
  ]);

function isDeviceCapability(name: string): name is DeviceCapability {
  return Object.hasOwn(DEVICE_CAPABILITIES, name);
}

export function capabilitiesFromRecord(
  record: Readonly<Record<string, boolean>>,
): ReadonlySet<DeviceCapability> {
  const capabilities = new Set<DeviceCapability>();
  for (const [name, value] of Object.entries(record)) {
    if (!value) {
      continue;
    }

    if (isDeviceCapability(name)) {
      capabilities.add(name);
    } else {
      debug('ignoring unknown capability %j', name);
    }
  }
  return capabilities;
}

export function capabilitiesFromGrpc(
  list: ReadonlyArray<number>,
): ReadonlySet<DeviceCapability> {
  const capabilities = new Set<DeviceCapability>();
  for (const capability of ALL_DEVICE_CAPABILITIES) {
    if (list.includes(DEVICE_CAPABILITIES[capability].grpc)) {
      capabilities.add(capability);
    }
  }
  return capabilities;
}

export function capabilityToGrpc(
  capability: DeviceCapability,
): GrpcDeviceCapability {
  return DEVICE_CAPABILITIES[capability].grpc;
}

export function hasAccountCapability(
  devices: ReadonlyArray<Device>,
  capability: DeviceCapability,
): boolean {
  const mode = DEVICE_CAPABILITIES[capability].accountCapabilityMode;

  if (mode === 'primaryDevice') {
    return devices.some((device) => {
      return (
        device.deviceId === PRIMARY_DEVICE_ID &&
        device.capabilities.has(capability)
      );
    });
  }

  if (mode === 'anyDevice') {
    return devices.some((device) => device.capabilities.has(capability));
  }

  if (mode === 'allDevices') {
    return (
      devices.length > 0 &&
      devices.every((device) => device.capabilities.has(capability))
    );
  }

  return unreachable(mode);
}

/** v1 profiles show self-visible capabilities to anyone who can fetch them */
export function getLegacyProfileCapabilities(
  devices: ReadonlyArray<Device>,
): Partial<Record<DeviceCapability, boolean>> {
  const capabilities: Partial<Record<DeviceCapability, boolean>> = {};
  for (const capability of SELF_VISIBLE_CAPABILITIES) {
    capabilities[capability] = hasAccountCapability(devices, capability);
  }
  return capabilities;
}
