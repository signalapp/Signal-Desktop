// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf/index.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { normalizeStoryDistributionId } from '../types/StoryDistributionId.std.js';
import { fromServiceIdBinaryOrString } from '../util/ServiceId.node.js';
import type { ProcessedSent } from './Types.d.ts';

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

export function processSent(sent: Proto.SyncMessage.Sent): ProcessedSent {
  const {
    destinationServiceId: rawDestinationServiceId,
    destinationServiceIdBinary,
    unidentifiedStatus,
    storyMessageRecipients,
    $unknown,
    ...remaining
  } = sent;

  void $unknown;

  return {
    ...remaining,

    destinationServiceId: fromServiceIdBinaryOrString(
      destinationServiceIdBinary,
      rawDestinationServiceId,
      'processSent'
    ),
    unidentifiedStatus: unidentifiedStatus
      ? unidentifiedStatus
          .map(processProtoWithDestinationServiceId)
          .map(({ unidentified, destinationPniIdentityKey, ...rest }) => {
            return {
              ...rest,
              unidentified: unidentified ?? false,
              destinationPniIdentityKey: destinationPniIdentityKey ?? undefined,
            };
          })
      : undefined,
    storyMessageRecipients: storyMessageRecipients
      ? storyMessageRecipients
          .map(processProtoWithDestinationServiceId)
          .map(recipient => {
            return {
              isAllowedToReply: recipient.isAllowedToReply ?? false,
              destinationServiceId: recipient.destinationServiceId,
              distributionListIds: recipient.distributionListIds.map(id => {
                return normalizeStoryDistributionId(
                  id,
                  'processSent.storyMessageRecipients'
                );
              }),
            };
          })
      : undefined,
  };
}
