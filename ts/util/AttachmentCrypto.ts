// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { IV_LENGTH, ATTACHMENT_MAC_LENGTH } from '../types/Crypto.js';
import { MediaTier } from '../types/AttachmentDownload.js';
import { logPadSize } from './logPadSize.js';
import { missingCaseError } from './missingCaseError.js';

export function getCiphertextSize(plaintextLength: number): number {
  const paddedPlaintextSize = logPadSize(plaintextLength);

  return (
    IV_LENGTH +
    getAesCbcCiphertextSize(paddedPlaintextSize) +
    ATTACHMENT_MAC_LENGTH
  );
}

export function getAesCbcCiphertextSize(plaintextLength: number): number {
  const AES_CBC_BLOCK_SIZE = 16;
  return (
    (1 + Math.floor(plaintextLength / AES_CBC_BLOCK_SIZE)) * AES_CBC_BLOCK_SIZE
  );
}

export function getAttachmentCiphertextSize({
  unpaddedPlaintextSize,
  mediaTier,
}: {
  unpaddedPlaintextSize: number;
  mediaTier: MediaTier;
}): number {
  const paddedSize = logPadSize(unpaddedPlaintextSize);

  switch (mediaTier) {
    case MediaTier.STANDARD:
      return getCiphertextSize(paddedSize);
    case MediaTier.BACKUP:
      // objects on backup tier are doubly encrypted!
      return getCiphertextSize(getCiphertextSize(paddedSize));
    default:
      throw missingCaseError(mediaTier);
  }
}
