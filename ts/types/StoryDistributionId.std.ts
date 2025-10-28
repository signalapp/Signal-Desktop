// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import { isValidUuid } from '../util/isValidUuid.std.js';
import { createLogger } from '../logging/log.std.js';
import type { LoggerType } from './Logging.std.js';

const log = createLogger('StoryDistributionId');

export type StoryDistributionIdString = string & {
  __story_distribution_id: never;
};

export function isStoryDistributionId(
  value?: string
): value is StoryDistributionIdString {
  return isValidUuid(value);
}

export function generateStoryDistributionId(): StoryDistributionIdString {
  return generateUuid() as StoryDistributionIdString;
}

export function normalizeStoryDistributionId(
  distributionId: string,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): StoryDistributionIdString {
  const result = distributionId.toLowerCase();

  if (!isStoryDistributionId(result)) {
    logger.warn(
      'Normalizing invalid story distribution id: ' +
        `${distributionId} to ${result} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as unknown as StoryDistributionIdString;
  }

  return result;
}
