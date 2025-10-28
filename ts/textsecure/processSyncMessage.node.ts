// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf/index.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { fromServiceIdBinaryOrString } from '../util/ServiceId.node.js';
import type { ProcessedSent, ProcessedSyncMessage } from './Types.d.ts';

type ProtoServiceId = Readonly<{
  destinationServiceId?: string | null;
  destinationServiceIdBinary?: Uint8Array | null;
}>;

function processProtoWithDestinationServiceId<Input extends ProtoServiceId>(
  input: Input
): Omit<Input, keyof ProtoServiceId> & {
  destinationServiceId?: ServiceIdString;
} {
  const {
    destinationServiceId: rawDestinationServiceId,
    destinationServiceIdBinary,
    ...remaining
  } = input;

  return {
    ...remaining,

    destinationServiceId: fromServiceIdBinaryOrString(
      destinationServiceIdBinary,
      rawDestinationServiceId,
      'processSyncMessage'
    ),
  };
}

function processSent(
  sent?: Proto.SyncMessage.ISent | null
): ProcessedSent | undefined {
  if (!sent) {
    return undefined;
  }

  const {
    destinationServiceId: rawDestinationServiceId,
    destinationServiceIdBinary,
    unidentifiedStatus,
    storyMessageRecipients,
    ...remaining
  } = sent;

  return {
    ...remaining,

    destinationServiceId: fromServiceIdBinaryOrString(
      destinationServiceIdBinary,
      rawDestinationServiceId,
      'processSent'
    ),
    unidentifiedStatus: unidentifiedStatus
      ? unidentifiedStatus.map(processProtoWithDestinationServiceId)
      : undefined,
    storyMessageRecipients: storyMessageRecipients
      ? storyMessageRecipients.map(processProtoWithDestinationServiceId)
      : undefined,
  };
}

export function processSyncMessage(
  syncMessage: Proto.ISyncMessage
): ProcessedSyncMessage {
  return {
    ...syncMessage,
    sent: processSent(syncMessage.sent),
  };
}
