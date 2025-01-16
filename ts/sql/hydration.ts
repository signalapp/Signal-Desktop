// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadStatus } from '../messages/MessageReadStatus';
import type { SeenStatus } from '../MessageSeenStatus';
import type { ServiceIdString } from '../types/ServiceId';
import { dropNull } from '../util/dropNull';

/* eslint-disable camelcase */

import type {
  MessageTypeUnhydrated,
  MessageType,
  MESSAGE_COLUMNS,
} from './Interface';

function toBoolean(value: number | null): boolean | undefined {
  if (value == null) {
    return undefined;
  }
  return value === 1;
}

export function hydrateMessage(row: MessageTypeUnhydrated): MessageType {
  const {
    json,
    id,
    body,
    conversationId,
    expirationStartTimestamp,
    expireTimer,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    isErased,
    isViewOnce,
    mentionsMe,
    received_at,
    received_at_ms,
    schemaVersion,
    serverGuid,
    sent_at,
    source,
    sourceServiceId,
    sourceDevice,
    storyId,
    type,
    readStatus,
    seenStatus,
    timestamp,
    serverTimestamp,
    unidentifiedDeliveryReceived,
  } = row;

  return {
    ...(JSON.parse(json) as Omit<
      MessageType,
      (typeof MESSAGE_COLUMNS)[number]
    >),

    id,
    body: dropNull(body),
    conversationId: conversationId || '',
    expirationStartTimestamp: dropNull(expirationStartTimestamp),
    expireTimer: dropNull(expireTimer) as MessageType['expireTimer'],
    hasAttachments: toBoolean(hasAttachments),
    hasFileAttachments: toBoolean(hasFileAttachments),
    hasVisualMediaAttachments: toBoolean(hasVisualMediaAttachments),
    isErased: toBoolean(isErased),
    isViewOnce: toBoolean(isViewOnce),
    mentionsMe: toBoolean(mentionsMe),
    received_at: received_at || 0,
    received_at_ms: dropNull(received_at_ms),
    schemaVersion: dropNull(schemaVersion),
    serverGuid: dropNull(serverGuid),
    sent_at: sent_at || 0,
    source: dropNull(source),
    sourceServiceId: dropNull(sourceServiceId) as ServiceIdString | undefined,
    sourceDevice: dropNull(sourceDevice),
    storyId: dropNull(storyId),
    type: type as MessageType['type'],
    readStatus: readStatus == null ? undefined : (readStatus as ReadStatus),
    seenStatus: seenStatus == null ? undefined : (seenStatus as SeenStatus),
    timestamp: timestamp || 0,
    serverTimestamp: dropNull(serverTimestamp),
    unidentifiedDeliveryReceived: toBoolean(unidentifiedDeliveryReceived),
  };
}
