// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf/index.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import type { ProcessedAttachment } from './Types.d.ts';
import { fromServiceIdBinaryOrString } from '../util/ServiceId.node.ts';
import { toNumber } from '../util/toNumber.std.ts';
import { processAttachment } from './processDataMessage.preload.ts';

export type ProcessedDraftAttachment = Readonly<{
  destinationServiceId?: ServiceIdString;
  attachment?: ProcessedAttachment;
  timestamp?: number;
  clear: boolean;
}>;

export function processDraftAttachment(
  draftAttachment: Proto.SyncMessage.DraftAttachment
): ProcessedDraftAttachment {
  return {
    destinationServiceId: fromServiceIdBinaryOrString(
      undefined,
      draftAttachment.destinationServiceId,
      'processDraftAttachment'
    ),
    attachment: processAttachment(draftAttachment.attachment),
    timestamp:
      draftAttachment.timestamp != null
        ? toNumber(draftAttachment.timestamp)
        : undefined,
    clear: draftAttachment.clear ?? false,
  };
}
