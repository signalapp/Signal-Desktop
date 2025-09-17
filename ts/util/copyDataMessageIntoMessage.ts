// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import type { ProcessedDataMessage } from '../textsecure/Types.d.ts';

export function copyDataMessageIntoMessage(
  dataMessage: ProcessedDataMessage,
  message: MessageAttributesType
): MessageAttributesType {
  return {
    ...message,
    ...dataMessage,
    // TODO: DESKTOP-5278
    // There are type conflicts between MessageAttributesType and the protos
    // that are passed in here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MessageAttributesType;
}
