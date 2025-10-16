// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { parseIntOrThrow } from '../util/parseIntOrThrow.std.js';
import type * as RemoteConfig from '../RemoteConfig.dom.js';

const log = createLogger('AttachmentSize');

export const KIBIBYTE = 1024;
export const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX = 100 * MEBIBYTE;

export const getMaximumOutgoingAttachmentSizeInKb = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return (
      parseIntOrThrow(
        getValue('global.attachments.maxBytes'),
        'getMaximumOutgoingAttachmentSizeInKb'
      ) / KIBIBYTE
    );
  } catch (error) {
    log.warn(
      'Failed to parse integer out of global.attachments.maxBytes feature flag'
    );
    return DEFAULT_MAX / KIBIBYTE;
  }
};

export const getMaximumIncomingAttachmentSizeInKb = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return (
      parseIntOrThrow(
        getValue('global.attachments.maxReceiveBytes'),
        'getMaximumIncomingAttachmentSizeInKb'
      ) / KIBIBYTE
    );
  } catch (_error) {
    // TODO: DESKTOP-5913. We're not gonna log until the new flag is fully deployed
    return getMaximumOutgoingAttachmentSizeInKb(getValue) * 1.25;
  }
};

export const getMaximumIncomingTextAttachmentSizeInKb = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return (
      parseIntOrThrow(
        getValue('global.textAttachmentLimitBytes'),
        'getMaximumIncomingTextAttachmentSizeInKb'
      ) / KIBIBYTE
    );
  } catch (_error) {
    // TODO: DESKTOP-6314. We're not gonna log until the new flag is fully deployed
    return KIBIBYTE * 5;
  }
};

export function getRenderDetailsForLimit(limitKb: number): {
  limit: number;
  units: string;
} {
  const units = ['kB', 'MB', 'GB'];
  let u = -1;
  let limit = limitKb * KIBIBYTE;
  do {
    limit /= KIBIBYTE;
    u += 1;
  } while (limit >= KIBIBYTE && u < units.length - 1);

  return {
    limit: Math.trunc(limit),
    units: units[u],
  };
}
