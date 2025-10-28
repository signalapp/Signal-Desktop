// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { v4 as generateUuid } from 'uuid';
import * as Bytes from '../Bytes.std.js';
import type {
  CallLinkConversationType,
  CallLinkType,
} from '../types/CallLink.std.js';
import { CallLinkRestrictions } from '../types/CallLink.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { getColorForCallLink } from './getColorForCallLink.std.js';
import {
  AdhocCallStatus,
  CallDirection,
  CallType,
  type CallHistoryDetails,
  CallMode,
} from '../types/CallDisposition.std.js';

export const CALL_LINK_DEFAULT_STATE: Pick<
  CallLinkType,
  'name' | 'restrictions' | 'revoked' | 'expiration' | 'storageNeedsSync'
> = {
  name: '',
  restrictions: CallLinkRestrictions.Unknown,
  revoked: false,
  expiration: null,
  storageNeedsSync: false,
};

export function getKeyFromCallLink(callLink: string): string {
  const url = new URL(callLink);
  if (url == null) {
    throw new Error('Failed to parse call link URL');
  }

  const hash = url.hash.slice(1);
  const hashParams = new URLSearchParams(hash);

  return hashParams.get('key') || '';
}

export function getKeyAndEpochFromCallLink(callLink: string): {
  key: string;
  epoch: string;
} {
  const url = new URL(callLink);
  if (url == null) {
    throw new Error('Failed to parse call link URL');
  }

  const hash = url.hash.slice(1);
  const hashParams = new URLSearchParams(hash);

  return {
    key: hashParams.get('key') || '',
    epoch: hashParams.get('epoch') || '',
  };
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

export function toAdminKeyBytes(adminKey: string): Uint8Array {
  return Bytes.fromBase64(adminKey);
}

export function fromAdminKeyBytes(adminKey: Uint8Array): string {
  return Bytes.toBase64(adminKey);
}

export function toCallHistoryFromUnusedCallLink(
  callLink: CallLinkType
): CallHistoryDetails {
  return {
    callId: generateUuid(),
    peerId: callLink.roomId,
    ringerId: null,
    startedById: null,
    mode: CallMode.Adhoc,
    type: CallType.Adhoc,
    direction: CallDirection.Incoming,
    timestamp: Date.now(),
    endedTimestamp: null,
    status: AdhocCallStatus.Pending,
  };
}

export function isCallHistoryForUnusedCallLink(
  callHistory: CallHistoryDetails
): boolean {
  const {
    ringerId,
    startedById,
    endedTimestamp,
    mode,
    type,
    direction,
    status,
  } = callHistory;
  return (
    ringerId == null &&
    startedById == null &&
    endedTimestamp == null &&
    mode === CallMode.Adhoc &&
    type === CallType.Adhoc &&
    direction === CallDirection.Incoming &&
    status === AdhocCallStatus.Pending
  );
}
