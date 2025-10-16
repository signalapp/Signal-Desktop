// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import type {
  CustomError,
  ReadonlyMessageAttributesType,
  QuotedAttachmentType,
} from '../model-types.d.ts';
import type { AciString } from '../types/ServiceId.std.js';

export function isIncoming(
  message: Pick<ReadonlyMessageAttributesType, 'type'>
): boolean {
  return message.type === 'incoming';
}

export function isOutgoing(
  message: Pick<ReadonlyMessageAttributesType, 'type'>
): boolean {
  return message.type === 'outgoing';
}

export function isStory(
  message: Pick<ReadonlyMessageAttributesType, 'type'>
): boolean {
  return message.type === 'story';
}

function isFromUs(
  message: Pick<ReadonlyMessageAttributesType, 'sourceServiceId'>,
  ourAci: AciString
) {
  return message.sourceServiceId === ourAci;
}

export function isOutgoingStory(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'sourceServiceId'>,
  ourAci: AciString
): boolean {
  return isStory(message) && isFromUs(message, ourAci);
}

export function isIncomingStory(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'sourceServiceId'>,
  ourAci: AciString
): boolean {
  return isStory(message) && !isFromUs(message, ourAci);
}

export const isCustomError = (e: unknown): e is CustomError =>
  e instanceof Error;

export const shouldTryToCopyFromQuotedMessage = ({
  referencedMessageNotFound,
  quoteAttachment,
}: {
  referencedMessageNotFound: boolean;
  quoteAttachment: ReadonlyDeep<QuotedAttachmentType> | undefined;
}): boolean => {
  // If we've tried and can't find the message, try again.
  if (referencedMessageNotFound === true) {
    return true;
  }

  // If there's no thumbnail, no need to try to copy anything
  if (!quoteAttachment?.thumbnail) {
    return false;
  }

  // If we already have this file, no need to copy anything
  if (quoteAttachment.thumbnail.path) {
    return false;
  }

  return true;
};
