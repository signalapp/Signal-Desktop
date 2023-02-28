// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import type * as RemoteConfig from '../RemoteConfig';

export const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX = 100 * MEBIBYTE;

export const getMaximumAttachmentSizeInKb = (
  getValue: typeof RemoteConfig.getValue
): number => {
  try {
    return (
      parseIntOrThrow(
        getValue('global.attachments.maxBytes'),
        'preProcessAttachment/maxAttachmentSize'
      ) / KIBIBYTE
    );
  } catch (error) {
    log.warn(
      'Failed to parse integer out of global.attachments.maxBytes feature flag'
    );
    return DEFAULT_MAX / KIBIBYTE;
  }
};

export function getRenderDetailsForLimit(limitKb: number): {
  limit: string;
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
    limit: limit.toFixed(0),
    units: units[u],
  };
}
