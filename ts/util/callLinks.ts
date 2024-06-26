// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CallLinkState as RingRTCCallLinkState } from '@signalapp/ringrtc';
import {
  CallLinkRootKey,
  CallLinkRestrictions as RingRTCCallLinkRestrictions,
} from '@signalapp/ringrtc';
import { Aci } from '@signalapp/libsignal-client';
import { z } from 'zod';
import * as RemoteConfig from '../RemoteConfig';
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
  CallLinkStateType,
} from '../types/CallLink';
import {
  callLinkRecordSchema,
  CallLinkRestrictions,
  toCallLinkRestrictions,
} from '../types/CallLink';
import type { LocalizerType } from '../types/Util';
import { isTestOrMockEnvironment } from '../environment';
import { AvatarColors } from '../types/Colors';

export const CALL_LINK_DEFAULT_STATE = {
  name: '',
  restrictions: CallLinkRestrictions.Unknown,
  revoked: false,
  expiration: null,
};

export function isCallLinksCreateEnabled(): boolean {
  if (isTestOrMockEnvironment()) {
    return true;
  }
  return RemoteConfig.getValue('desktop.calling.adhoc.create') === 'TRUE';
}

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
  const { roomId, name, rootKey } = callLink;
  return {
    id: roomId,
    type: 'callLink',
    color: getColorForCallLink(rootKey),
    isMe: false,
    title: name || i18n('icu:calling__call-link-default-title'),
    sharedGroupNames: [],
    acceptedMessageRequest: true,
    badges: [],
  };
}
// See https://github.com/signalapp/ringrtc/blob/49b4b8a16f997c7fa9a429e96aa83f80b2065c63/src/rust/src/lite/call_links/base16.rs#L8
const BASE_16_CONSONANT_ALPHABET = 'bcdfghkmnpqrstxz';

// See https://github.com/signalapp/ringrtc/blob/49b4b8a16f997c7fa9a429e96aa83f80b2065c63/src/rust/src/lite/call_links/base16.rs#L127-L139
export function getColorForCallLink(rootKey: string): string {
  const rootKeyStart = rootKey.slice(0, 2);

  const upper = BASE_16_CONSONANT_ALPHABET.indexOf(rootKeyStart[0]) || 0 * 16;
  const lower = BASE_16_CONSONANT_ALPHABET.indexOf(rootKeyStart[1]) || 0;
  const firstByte = upper + lower;

  const index = firstByte % 12;

  return AvatarColors[index];
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

export function toAdminKeyBytes(adminKey: string): Buffer {
  return Buffer.from(adminKey, 'base64');
}

export function fromAdminKeyBytes(adminKey: Uint8Array): string {
  return Bytes.toBase64(adminKey);
}

/**
 * RingRTC conversions
 */

export function callLinkStateFromRingRTC(
  state: RingRTCCallLinkState
): CallLinkStateType {
  return {
    name: state.name,
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
  return RingRTCCallLinkRestrictionsSchema.parse(restrictions);
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
