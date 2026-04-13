// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { parseIntOrThrow } from '../util/parseIntOrThrow.std.ts';
import type * as RemoteConfig from '../RemoteConfig.dom.ts';
import { getAttachmentCiphertextSize } from '../util/AttachmentCrypto.std.ts';
import { MediaTier } from './AttachmentDownload.std.ts';
import type { MIMEType } from './MIME.std.ts';
import { isVideoAttachment } from '../util/Attachment.std.ts';

const log = createLogger('AttachmentSize');

export const KIBIBYTE = 1024;
export const MEBIBYTE = 1024 * 1024;

export const getMaximumOutgoingVideoSize = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return parseIntOrThrow(
      getValue('global.videoAttachments.transcodeTargetBytes'),
      'getMaximumOutgoingVideoSize'
    );
  } catch (error) {
    log.warn(
      'Failed to parse integer out of global.videoAttachments.transcodeTargetBytes feature flag'
    );
    return 100 * MEBIBYTE;
  }
};

const getMaximumOutgoingAttachmentSize = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return parseIntOrThrow(
      getValue('global.attachments.maxBytes'),
      'getMaximumOutgoingAttachmentSize'
    );
  } catch (error) {
    log.warn(
      'Failed to parse integer out of global.attachments.maxBytes feature flag'
    );
    return 100 * MEBIBYTE;
  }
};

export const getMaximumIncomingAttachmentSize = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return parseIntOrThrow(
      getValue('global.attachments.maxReceiveBytes'),
      'getMaximumIncomingAttachmentSize'
    );
  } catch (_error) {
    // TODO: DESKTOP-5913. We're not gonna log until the new flag is fully deployed
    return getMaximumOutgoingAttachmentSize(getValue) * 1.25;
  }
};

export function getRenderDetailsForLimit(limitBytes: number): {
  limit: number;
  units: string;
} {
  const units = ['kB', 'MB', 'GB'];
  let u = -1;
  let limit = limitBytes;
  do {
    limit /= KIBIBYTE;
    u += 1;
  } while (limit >= KIBIBYTE && u < units.length - 1);

  return {
    limit: Math.trunc(limit),
    // oxlint-disable-next-line typescript/no-non-null-assertion
    units: units[u]!,
  };
}

export function getAttachmentSizeLimit({
  contentType,
  getRemoteConfigValue,
}: {
  contentType: MIMEType;
  getRemoteConfigValue: typeof RemoteConfig.getValue;
}): number {
  const isVideo = isVideoAttachment({ contentType });
  return isVideo
    ? getMaximumOutgoingVideoSize(getRemoteConfigValue)
    : getMaximumOutgoingAttachmentSize(getRemoteConfigValue);
}

export function isAttachmentTooLargeToSend({
  plaintextSize,
  limit,
}: {
  plaintextSize: number;
  limit: number;
}): boolean {
  const paddedAndEncryptedSize = getAttachmentCiphertextSize({
    unpaddedPlaintextSize: plaintextSize,
    mediaTier: MediaTier.STANDARD,
  });

  return paddedAndEncryptedSize > limit;
}
