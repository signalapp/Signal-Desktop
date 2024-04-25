// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { CallLinkRootKey } from '@signalapp/ringrtc';
import { Aci } from '@signalapp/libsignal-client';
import type { CallLinkAuthCredentialPresentation } from './zkgroup';
import {
  CallLinkAuthCredential,
  CallLinkSecretParams,
  GenericServerPublicParams,
} from './zkgroup';
import { getCheckedCallLinkAuthCredentialsForToday } from '../services/groupCredentialFetcher';
import * as durations from './durations';
import * as Bytes from '../Bytes';
import type {
  CallLinkConversationType,
  CallLinkType,
  CallLinkRecord,
} from '../types/CallLink';
import {
  callLinkRecordSchema,
  CallLinkRestrictions,
  toCallLinkRestrictions,
} from '../types/CallLink';
import type { LocalizerType } from '../types/Util';

export const CALL_LINK_DEFAULT_STATE = {
  name: '',
  restrictions: CallLinkRestrictions.Unknown,
  revoked: false,
  expiration: null,
};

export function getRoomIdFromRootKey(rootKey: CallLinkRootKey): string {
  return rootKey.deriveRoomId().toString('hex');
}

export function getCallLinkRootKeyFromUrlKey(key: string): Uint8Array {
  // Returns `Buffer` which inherits from `Uint8Array`
  return CallLinkRootKey.parse(key).bytes;
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

export function callLinkToConversation(
  callLink: CallLinkType,
  i18n: LocalizerType
): CallLinkConversationType {
  const { roomId, name } = callLink;
  return {
    id: roomId,
    type: 'callLink',
    isMe: false,
    title: name || i18n('icu:calling__call-link-default-title'),
    sharedGroupNames: [],
    acceptedMessageRequest: true,
    badges: [],
  };
}

export function getPlaceholderCallLinkConversation(
  roomId: string,
  i18n: LocalizerType
): CallLinkConversationType {
  return {
    id: roomId,
    type: 'callLink',
    isMe: false,
    title: i18n('icu:calling__call-link-default-title'),
    sharedGroupNames: [],
    acceptedMessageRequest: true,
    badges: [],
  };
}

export function toRootKeyBytes(rootKey: string): Uint8Array {
  return CallLinkRootKey.parse(rootKey).bytes;
}

export function fromRootKeyBytes(rootKey: Uint8Array): string {
  return CallLinkRootKey.fromBytes(rootKey as Buffer).toString();
}

export function toAdminKeyBytes(adminKey: string): Uint8Array {
  return Bytes.fromBase64(adminKey);
}

export function fromAdminKeyBytes(adminKey: Uint8Array): string {
  return Bytes.toBase64(adminKey);
}

/**
 * DB record conversions
 */

export function callLinkToRecord(callLink: CallLinkType): CallLinkRecord {
  if (callLink.rootKey == null) {
    throw new Error('CallLink.callLinkToRecord: rootKey is null');
  }

  const rootKey = toRootKeyBytes(callLink.rootKey);
  const adminKey = callLink.adminKey
    ? toAdminKeyBytes(callLink.adminKey)
    : null;
  return callLinkRecordSchema.parse({
    roomId: callLink.roomId,
    rootKey,
    adminKey,
    name: callLink.name,
    restrictions: callLink.restrictions,
    revoked: callLink.revoked ? 1 : 0,
    expiration: callLink.expiration,
  });
}

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
  };
}
