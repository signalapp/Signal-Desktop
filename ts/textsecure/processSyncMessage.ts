// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf';
import { normalizeUuid } from '../util/normalizeUuid';
import type { ProcessedSent, ProcessedSyncMessage } from './Types.d';
import type { TaggedUUIDStringType } from '../types/UUID';

type ProtoUUIDTriple = Readonly<{
  destinationAci?: string | null;
  destinationPni?: string | null;
}>;

function toTaggedUuid({
  destinationAci,
  destinationPni,
}: ProtoUUIDTriple): TaggedUUIDStringType | undefined {
  if (destinationAci) {
    return {
      aci: normalizeUuid(destinationAci, 'syncMessage.sent.destinationAci'),
      pni: undefined,
    };
  }
  if (destinationPni) {
    return {
      aci: undefined,
      pni: normalizeUuid(destinationPni, 'syncMessage.sent.destinationPni'),
    };
  }

  return undefined;
}

function processProtoWithDestinationUuid<Input extends ProtoUUIDTriple>(
  input: Input
): Omit<Input, keyof ProtoUUIDTriple> & {
  destinationUuid?: TaggedUUIDStringType;
} {
  const { destinationAci, destinationPni, ...remaining } = input;

  return {
    ...remaining,

    destinationUuid: toTaggedUuid({
      destinationAci,
      destinationPni,
    }),
  };
}

function processSent(
  sent?: Proto.SyncMessage.ISent | null
): ProcessedSent | undefined {
  if (!sent) {
    return undefined;
  }

  const {
    destinationAci,
    destinationPni,
    unidentifiedStatus,
    storyMessageRecipients,
    ...remaining
  } = sent;

  return {
    ...remaining,

    destinationUuid: toTaggedUuid({
      destinationAci,
      destinationPni,
    }),
    unidentifiedStatus: unidentifiedStatus
      ? unidentifiedStatus.map(processProtoWithDestinationUuid)
      : undefined,
    storyMessageRecipients: storyMessageRecipients
      ? storyMessageRecipients.map(processProtoWithDestinationUuid)
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
