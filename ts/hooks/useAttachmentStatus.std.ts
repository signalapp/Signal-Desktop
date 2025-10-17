// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentForUIType } from '../types/Attachment.std.js';
import { getUrl } from '../util/Attachment.std.js';
import { MediaTier } from '../types/AttachmentDownload.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { getAttachmentCiphertextSize } from '../util/AttachmentCrypto.std.js';
import { useDelayedValue } from './useDelayedValue.std.js';

const TRANSITION_DELAY = 200;

type InternalState = 'NeedsDownload' | 'Downloading' | 'ReadyToShow';

export type AttachmentStatusType = Readonly<
  | {
      state: 'NeedsDownload';
    }
  | {
      state: 'Downloading';
      totalDownloaded: number | undefined;
      size: number;
    }
  | {
      state: 'ReadyToShow';
    }
>;

export function useAttachmentStatus(
  attachment: AttachmentForUIType
): AttachmentStatusType {
  const isAttachmentNotAvailable =
    attachment.isPermanentlyUndownloadable && !attachment.wasTooBig;

  const url = getUrl(attachment);

  let nextState: InternalState = 'ReadyToShow';
  if (attachment && isAttachmentNotAvailable) {
    nextState = 'ReadyToShow';
  } else if (attachment && url == null && !attachment.pending) {
    nextState = 'NeedsDownload';
  } else if (attachment && url == null && attachment.pending) {
    nextState = 'Downloading';
  }

  const state = useDelayedValue(nextState, TRANSITION_DELAY);

  // Idle
  if (state === 'NeedsDownload' && nextState === state) {
    return { state: 'NeedsDownload' };
  }

  const { size: unpaddedPlaintextSize, totalDownloaded } = attachment;
  const size = getAttachmentCiphertextSize({
    unpaddedPlaintextSize,
    mediaTier: MediaTier.STANDARD,
  });

  // Transition
  if (state !== nextState) {
    if (nextState === 'NeedsDownload') {
      return { state: 'NeedsDownload' };
    }

    if (nextState === 'Downloading') {
      return { state: 'Downloading', size, totalDownloaded };
    }

    if (nextState === 'ReadyToShow') {
      return { state: 'Downloading', size, totalDownloaded: size };
    }

    throw missingCaseError(nextState);
  }

  if (state === 'NeedsDownload') {
    return { state: 'NeedsDownload' };
  }

  if (state === 'Downloading') {
    return { state: 'Downloading', size, totalDownloaded };
  }

  if (state === 'ReadyToShow') {
    return { state: 'ReadyToShow' };
  }

  throw missingCaseError(state);
}
