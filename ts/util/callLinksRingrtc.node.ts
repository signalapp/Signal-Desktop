// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  CallLinkRestrictions as RingRTCCallLinkRestrictions,
  CallLinkRootKey,
  CallLinkEpoch,
} from '@signalapp/ringrtc';
import type { CallLinkState as RingRTCCallLinkState } from '@signalapp/ringrtc';
import { z } from 'zod';
import {
  CallLinkNameMaxByteLength,
  callLinkRecordSchema,
  defunctCallLinkRecordSchema,
  toCallLinkRestrictions,
} from '../types/CallLink.std.js';
import type {
  CallLinkRecord,
  CallLinkRestrictions,
  CallLinkType,
  DefunctCallLinkRecord,
  DefunctCallLinkType,
  CallLinkStateType,
} from '../types/CallLink.std.js';
import { unicodeSlice } from './unicodeSlice.std.js';
import {
  fromAdminKeyBytes,
  getKeyFromCallLink,
  toAdminKeyBytes,
} from './callLinks.std.js';
import { parseStrict } from './schemas.std.js';
import * as Bytes from '../Bytes.std.js';

/**
 * RingRTC conversions
 */

export function callLinkStateFromRingRTC(
  state: RingRTCCallLinkState
): CallLinkStateType {
  return {
    name: unicodeSlice(state.name, 0, CallLinkNameMaxByteLength),
    restrictions: toCallLinkRestrictions(state.restrictions),
    revoked: state.revoked,
    expiration: state.expiration.getTime(),
  };
}

const RingRTCCallLinkRestrictionsSchema = z.nativeEnum(
  RingRTCCallLinkRestrictions
);

export function callLinkRestrictionsToRingRTC(
  restrictions: CallLinkRestrictions
): RingRTCCallLinkRestrictions {
  return parseStrict(RingRTCCallLinkRestrictionsSchema, restrictions);
}

export function getRoomIdFromRootKey(rootKey: CallLinkRootKey): string {
  return Bytes.toHex(rootKey.deriveRoomId());
}

export function getRoomIdFromRootKeyString(rootKeyString: string): string {
  const callLinkRootKey = CallLinkRootKey.parse(rootKeyString);
  return getRoomIdFromRootKey(callLinkRootKey);
}

export function getCallLinkRootKeyFromUrlKey(key: string): Uint8Array {
  // Returns `Buffer` which inherits from `Uint8Array`
  return CallLinkRootKey.parse(key).bytes;
}

export function getRoomIdFromCallLink(url: string): string {
  const keyString = getKeyFromCallLink(url);
  const key = CallLinkRootKey.parse(keyString);
  return getRoomIdFromRootKey(key);
}

export function toRootKeyBytes(rootKey: string): Uint8Array {
  return CallLinkRootKey.parse(rootKey).bytes;
}

export function fromRootKeyBytes(rootKey: Uint8Array): string {
  return CallLinkRootKey.fromBytes(rootKey as Buffer).toString();
}

export function toEpochBytes(epoch: string): Uint8Array {
  return CallLinkEpoch.parse(epoch).bytes;
}

export function fromEpochBytes(epoch: Uint8Array): string {
  return CallLinkEpoch.fromBytes(epoch).toString();
}

/**
 * DB record conversions
 */

export function callLinkFromRecord(record: CallLinkRecord): CallLinkType {
  if (record.rootKey == null) {
    throw new Error('CallLink.callLinkFromRecord: rootKey is null');
  }

  // root keys in memory are strings for simplicity
  const rootKey = fromRootKeyBytes(record.rootKey);
  const epoch = record.epoch ? fromEpochBytes(record.epoch) : null;
  const adminKey = record.adminKey ? fromAdminKeyBytes(record.adminKey) : null;
  return {
    roomId: record.roomId,
    rootKey,
    epoch,
    adminKey,
    name: record.name,
    restrictions: toCallLinkRestrictions(record.restrictions),
    revoked: record.revoked === 1,
    expiration: record.expiration,
    storageID: record.storageID || undefined,
    storageVersion: record.storageVersion || undefined,
    storageUnknownFields: record.storageUnknownFields || undefined,
    storageNeedsSync: record.storageNeedsSync === 1,
  };
}

export function callLinkToRecord(callLink: CallLinkType): CallLinkRecord {
  if (callLink.rootKey == null) {
    throw new Error('CallLink.callLinkToRecord: rootKey is null');
  }

  const rootKey = toRootKeyBytes(callLink.rootKey);
  const epoch = callLink.epoch ? toEpochBytes(callLink.epoch) : null;
  const adminKey = callLink.adminKey
    ? toAdminKeyBytes(callLink.adminKey)
    : null;
  return parseStrict(callLinkRecordSchema, {
    roomId: callLink.roomId,
    rootKey,
    epoch,
    adminKey,
    name: callLink.name,
    restrictions: callLink.restrictions,
    revoked: callLink.revoked ? 1 : 0,
    expiration: callLink.expiration,
    storageID: callLink.storageID || null,
    storageVersion: callLink.storageVersion || null,
    storageUnknownFields: callLink.storageUnknownFields || null,
    storageNeedsSync: callLink.storageNeedsSync ? 1 : 0,
  });
}

export function defunctCallLinkFromRecord(
  record: DefunctCallLinkRecord
): DefunctCallLinkType {
  if (record.rootKey == null) {
    throw new Error('CallLink.defunctCallLinkFromRecord: rootKey is null');
  }

  const rootKey = fromRootKeyBytes(record.rootKey);
  const adminKey = record.adminKey ? fromAdminKeyBytes(record.adminKey) : null;
  const epoch = record.epoch ? fromEpochBytes(record.epoch) : null;
  return {
    roomId: record.roomId,
    rootKey,
    adminKey,
    epoch,
    storageID: record.storageID || undefined,
    storageVersion: record.storageVersion || undefined,
    storageUnknownFields: record.storageUnknownFields || undefined,
    storageNeedsSync: record.storageNeedsSync === 1,
  };
}

export function defunctCallLinkToRecord(
  defunctCallLink: DefunctCallLinkType
): DefunctCallLinkRecord {
  if (defunctCallLink.rootKey == null) {
    throw new Error('CallLink.defunctCallLinkToRecord: rootKey is null');
  }

  const rootKey = toRootKeyBytes(defunctCallLink.rootKey);
  const epoch = defunctCallLink.epoch
    ? toEpochBytes(defunctCallLink.epoch)
    : null;
  const adminKey = defunctCallLink.adminKey
    ? toAdminKeyBytes(defunctCallLink.adminKey)
    : null;
  return parseStrict(defunctCallLinkRecordSchema, {
    roomId: defunctCallLink.roomId,
    rootKey,
    epoch,
    adminKey,
    storageID: defunctCallLink.storageID || null,
    storageVersion: defunctCallLink.storageVersion || null,
    storageUnknownFields: defunctCallLink.storageUnknownFields || null,
    storageNeedsSync: defunctCallLink.storageNeedsSync ? 1 : 0,
  });
}
