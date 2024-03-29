// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';
import { z } from 'zod';
import type { ServiceId, Aci, Pni } from '@signalapp/libsignal-client';

import { isValidUuid } from '../util/isValidUuid';
import * as log from '../logging/log';
import type { LoggerType } from './Logging';
import { isAciString } from '../util/isAciString';

export enum ServiceIdKind {
  ACI = 'ACI',
  PNI = 'PNI',
  Unknown = 'Unknown',
}

export type PniString = string & { __pni: never };
export type UntaggedPniString = string & { __untagged_pni: never };
export type AciString = string & { __aci: never };
export type ServiceIdString = PniString | AciString;

export function isServiceIdString(
  value?: string | null
): value is ServiceIdString {
  return isAciString(value) || isPniString(value);
}

export function isPniString(value?: string | null): value is PniString {
  if (value == null) {
    return false;
  }

  if (value.startsWith('PNI:')) {
    return true;
  }

  return false;
}

export function isUntaggedPniString(
  value?: string | null
): value is UntaggedPniString {
  return isValidUuid(value);
}

export function toTaggedPni(untagged: UntaggedPniString): PniString {
  return `PNI:${untagged}` as PniString;
}

export function toUntaggedPni(pni: PniString): UntaggedPniString {
  return pni.replace(/^PNI:/i, '') as UntaggedPniString;
}

const INVALID_SERVICE_ID_PATTERN = /^.*(.{3})/;

function redactInvalidServiceId(input: string): string {
  return input.replace(INVALID_SERVICE_ID_PATTERN, '[REDACTED]$1');
}

export function normalizeServiceId(
  rawServiceId: string,
  context: string,
  logger?: Pick<LoggerType, 'warn'>
): ServiceIdString;

export function normalizeServiceId(
  rawServiceId: string | undefined | null,
  context: string,
  logger?: Pick<LoggerType, 'warn'>
): ServiceIdString | undefined;

export function normalizeServiceId(
  rawServiceId: string | undefined | null,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): ServiceIdString | undefined {
  if (rawServiceId == null) {
    return undefined;
  }

  const result = rawServiceId.toLowerCase().replace(/^pni:/, 'PNI:');

  if (!isAciString(result) && !isPniString(result)) {
    const before = redactInvalidServiceId(rawServiceId);
    const after = redactInvalidServiceId(result);
    logger.warn(
      `Normalizing invalid serviceId: ${before} to ${after} in context "${context}"`
    );

    // Cast anyway we don't want to throw here
    return result as ServiceIdString;
  }

  return result;
}

export function normalizePni(
  rawPni: string,
  context: string,
  logger?: Pick<LoggerType, 'warn'>
): PniString;

export function normalizePni(
  rawPni: string | undefined | null,
  context: string,
  logger?: Pick<LoggerType, 'warn'>
): PniString | undefined;

export function normalizePni(
  rawPni: string | undefined | null,
  context: string,
  logger: Pick<LoggerType, 'warn'> = log
): PniString | undefined {
  if (rawPni == null) {
    return undefined;
  }

  const result = rawPni.toLowerCase().replace(/^pni:/, 'PNI:');
  if (!isPniString(result)) {
    logger.warn(
      `Normalizing invalid pni: ${rawPni} to ${result} in context "${context}"`
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

export const aciSchema = z
  .string()
  .refine(isAciString)
  .transform(x => {
    if (!isAciString(x)) {
      throw new Error('Refine did not throw!');
    }
    return x;
  });

export const untaggedPniSchema = z
  .string()
  .refine(isUntaggedPniString)
  .transform(x => {
    if (!isUntaggedPniString(x)) {
      throw new Error('Refine did not throw!');
    }
    return x;
  });

export const serviceIdSchema = z
  .string()
  .refine(isServiceIdString)
  .transform(x => {
    if (!isServiceIdString(x)) {
      throw new Error('Refine did not throw!');
    }
    return x;
  });

// Note: getServiceIdString() returns normalized string so we can cast it
//   without normalizing.
export function fromServiceIdObject(obj: ServiceId): ServiceIdString {
  return obj.getServiceIdString() as ServiceIdString;
}

export function fromAciObject(obj: Aci): AciString {
  return obj.getServiceIdString() as AciString;
}

export function fromPniObject(obj: Pni): PniString {
  return obj.getServiceIdString() as PniString;
}
