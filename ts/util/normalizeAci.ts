// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { LoggerType } from '../types/Logging';
import * as log from '../logging/log';
import { isAciString } from './isAciString';
import { strictAssert } from './assert';

export function normalizeAci(
  rawAci: string,
  context: string,
  logger?: Pick<LoggerType, 'warn'>
): AciString;

export function normalizeAci(
  rawAci: string | undefined | null,
  context: string,
  logger?: Pick<LoggerType, 'warn'>
): AciString | undefined;

export function normalizeAci(
  rawAci: string | undefined | null,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): AciString | undefined {
  if (rawAci == null) {
    return undefined;
  }

  const result = rawAci.toLowerCase();
  strictAssert(
    !result.startsWith('pni:'),
    `ACI should not start with 'PNI:' in ${context}`
  );

  if (!isAciString(result)) {
    logger.warn(
      `Normalizing invalid aci: ${rawAci} to ${result} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as AciString;
  }

  return result;
}
