// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import { isValidUuid } from '../util/isValidUuid';
import * as log from '../logging/log';
import type { LoggerType } from './Logging';

export enum ServiceIdKind {
  ACI = 'ACI',
  PNI = 'PNI',
  Unknown = 'Unknown',
}

export type PniString = string & { __pni: never };
export type UntaggedPniString = string & { __pni: never };
export type AciString = string & { __aci: never };
export type ServiceIdString = PniString | AciString;

export function isServiceIdString(value?: string): value is ServiceIdString {
  return isAciString(value) || isPniString(value);
}

export function isAciString(value?: string): value is AciString {
  return isValidUuid(value);
}

export function isPniString(value?: string): value is PniString {
  if (value === undefined) {
    return false;
  }

  if (value.startsWith('PNI:')) {
    return true;
  }

  // Legacy IDs
  return isValidUuid(value);
}

export function isUntaggedPniString(
  value?: string
): value is UntaggedPniString {
  return isValidUuid(value);
}

export function toTaggedPni(untagged: UntaggedPniString): PniString {
  return `PNI:${untagged}` as PniString;
}

export function normalizeServiceId(
  rawServiceId: string,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): ServiceIdString {
  const result = rawServiceId.toLowerCase().replace(/^pni:/, 'PNI:');

  if (!isAciString(result) && !isPniString(result)) {
    logger.warn(
      `Normalizing invalid serviceId: ${rawServiceId} to ${result} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as ServiceIdString;
  }

  return result;
}

export function normalizeAci(
  rawAci: string,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): AciString {
  const result = rawAci.toLowerCase();

  if (!isAciString(result)) {
    logger.warn(
      `Normalizing invalid serviceId: ${rawAci} to ${result} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as AciString;
  }

  return result;
}

export function normalizePni(
  rawPni: string,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): PniString {
  const result = rawPni.toLowerCase().replace(/^pni:/, 'PNI:');

  if (!isPniString(result)) {
    logger.warn(
      `Normalizing invalid serviceId: ${rawPni} to ${result} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as PniString;
  }

  return result;
}

// For tests
export function generateAci(): AciString {
  return generateUuid() as AciString;
}

export function generatePni(): PniString {
  return `PNI:${generateUuid()}` as PniString;
}

export function getAciFromPrefix(prefix: string): AciString {
  let padded = prefix;
  while (padded.length < 8) {
    padded += '0';
  }
  return `${padded}-0000-4000-8000-${'0'.repeat(12)}` as AciString;
}
