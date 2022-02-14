// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUIDStringType } from '../types/UUID';
import { isValidUuid } from '../types/UUID';
import type { LoggerType } from '../types/Logging';
import * as log from '../logging/log';

export function normalizeUuid(
  uuid: string,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): UUIDStringType {
  const result = uuid.toLowerCase();

  if (!isValidUuid(uuid) || !isValidUuid(result)) {
    logger.warn(
      `Normalizing invalid uuid: ${uuid} to ${result} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as unknown as UUIDStringType;
  }

  return result;
}
