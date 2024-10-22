// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  CallLinkRestrictions as RingRTCCallLinkRestrictions,
  CallLinkRootKey,
} from '@signalapp/ringrtc';
import type { CallLinkState as RingRTCCallLinkState } from '@signalapp/ringrtc';
import { z } from 'zod';
import { Aci } from '@signalapp/libsignal-client';
import type {
  CallLinkRecord,
  CallLinkRestrictions,
  CallLinkType,
  DefunctCallLinkRecord,
  DefunctCallLinkType,
} from '../types/CallLink';
import {
  type CallLinkStateType,
  CallLinkNameMaxByteLength,
  callLinkRecordSchema,
  defunctCallLinkRecordSchema,
  toCallLinkRestrictions,
} from '../types/CallLink';
import { unicodeSlice } from './unicodeSlice';
import type { CallLinkAuthCredentialPresentation } from './zkgroup';
import {
  CallLinkAuthCredential,
  CallLinkSecretParams,
  GenericServerPublicParams,
} from './zkgroup';
import { getCheckedCallLinkAuthCredentialsForToday } from '../services/groupCredentialFetcher';
import * as durations from './durations';
import {
  fromAdminKeyBytes,
  getKeyFromCallLink,
  toAdminKeyBytes,
} from './callLinks';
import { parseStrict } from './schemas';

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
  return rootKey.deriveRoomId().toString('hex');
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

export async function getCallLinkAuthCredentialPresentation(
  callLinkRootKey: CallLinkRootKey
): Promise<CallLinkAuthCredentialPresentation> {
  const credentials = getCheckedCallLinkAuthCredentialsForToday(
    'getCallLinkAuthCredentialPresentation'
  );
  const todaysCredentials = credentials.today.credential;
  const credential = new CallLinkAuthCredential(
    Buffer.from(todaysCredentials, 'base64')
  );

  const genericServerPublicParamsBase64 = window.getGenericServerPublicParams();
  const genericServerPublicParams = new GenericServerPublicParams(
    Buffer.from(genericServerPublicParamsBase64, 'base64')
  );

  const ourAci = window.textsecure.storage.user.getAci();
  if (ourAci == null) {
    throw new Error('Failed to get our ACI');
  }
  const userId = Aci.fromUuid(ourAci);

  const callLinkSecretParams = CallLinkSecretParams.deriveFromRootKey(
    callLinkRootKey.bytes
  );
  const presentation = credential.present(
    userId,
    credentials.today.redemptionTime / durations.SECOND,
    genericServerPublicParams,
    callLinkSecretParams
  );
  return presentation;
}

export function toRootKeyBytes(rootKey: string): Uint8Array {
  return CallLinkRootKey.parse(rootKey).bytes;
}

export function fromRootKeyBytes(rootKey: Uint8Array): string {
  return CallLinkRootKey.fromBytes(rootKey as Buffer).toString();
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
  const adminKey = record.adminKey ? fromAdminKeyBytes(record.adminKey) : null;
  return {
    roomId: record.roomId,
    rootKey,
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
  const adminKey = callLink.adminKey
    ? toAdminKeyBytes(callLink.adminKey)
    : null;
  return parseStrict(callLinkRecordSchema, {
    roomId: callLink.roomId,
    rootKey,
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
  return {
    roomId: record.roomId,
    rootKey,
    adminKey,
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
  const adminKey = defunctCallLink.adminKey
    ? toAdminKeyBytes(defunctCallLink.adminKey)
    : null;
  return parseStrict(defunctCallLinkRecordSchema, {
    roomId: defunctCallLink.roomId,
    rootKey,
    adminKey,
    storageID: defunctCallLink.storageID || null,
    storageVersion: defunctCallLink.storageVersion || null,
    storageUnknownFields: defunctCallLink.storageUnknownFields || null,
    storageNeedsSync: defunctCallLink.storageNeedsSync ? 1 : 0,
  });
}
