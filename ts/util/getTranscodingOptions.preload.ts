// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';
import { TranscodingTargetQuality } from '../types/transcoding.std.ts';
import { getCountryCode } from '../types/PhoneNumber.std.ts';
import { getValue } from '../RemoteConfig.dom.ts';
import { createLogger } from '../logging/log.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { parseUnknown } from './schemas.std.ts';
import { missingCaseError } from './missingCaseError.std.ts';

const log = createLogger('getTranscodingOptions');

const TranscodingConfigSchema = z.object({
  resolution: z.number(),
  videoBitrateMbps: z.number(),
  maxDurationSec: z.number(),
});

const RegionSchema = z.object({
  locales: z.number().array(),
  standard: TranscodingConfigSchema.array().min(1),
  high: TranscodingConfigSchema.array().min(1),
});

const MultiRegionSchema = RegionSchema.array().min(1);

const DEFAULT_OPTIONS = [
  {
    locales: [],
    standard: [
      {
        resolution: 480,
        videoBitrateMbps: 1,
        maxDurationSec: 900,
      },
    ],
    high: [
      {
        resolution: 720,
        videoBitrateMbps: 4,
        maxDurationSec: 360,
      },
    ],
  },
  {
    locales: [1, 61, 81, 82, 65, 31, 47, 41, 32, 385, 971, 974, 49, 33],
    standard: [
      {
        resolution: 720,
        videoBitrateMbps: 2.0,
        maxDurationSec: 600,
      },
      {
        resolution: 720,
        videoBitrateMbps: 1.5,
        maxDurationSec: 900,
      },
    ],
    high: [
      {
        resolution: 720,
        videoBitrateMbps: 4.0,
        maxDurationSec: 360,
      },
    ],
  },
] as const satisfies z.infer<typeof MultiRegionSchema>;

function getRegionConfig(
  quality: TranscodingTargetQuality
): ReadonlyArray<z.infer<typeof TranscodingConfigSchema>> {
  let multi: z.infer<typeof MultiRegionSchema> = DEFAULT_OPTIONS;
  const value = getValue('client.attachments.videoTranscodingConfiguration');
  if (value != null) {
    try {
      const json: unknown = JSON.parse(value);
      multi = parseUnknown(MultiRegionSchema, json);
    } catch (error) {
      log.error('failed to parse json', error);
    }
  }

  const ourE164 = itemStorage.user.getOptionalNumber();
  let countryCode: number | undefined;
  if (ourE164 != null) {
    countryCode = getCountryCode(ourE164);
  }

  let matching: z.infer<typeof RegionSchema> | undefined;
  if (countryCode != null) {
    matching = multi.find(({ locales }) => locales.includes(countryCode));
  }
  if (matching == null) {
    matching = multi.find(({ locales }) => locales.length === 0);
  }

  if (matching == null) {
    log.error('no matching config');
    matching = DEFAULT_OPTIONS[0];
  }

  if (quality === TranscodingTargetQuality.Standard) {
    return matching.standard;
  }
  if (quality === TranscodingTargetQuality.High) {
    return matching.high;
  }
  throw missingCaseError(quality);
}

export function getMaxVideoDuration(quality: TranscodingTargetQuality): number {
  const last = getRegionConfig(quality).at(-1);
  if (last == null) {
    throw new Error('Missing region config!');
  }

  return last.maxDurationSec;
}

export function getTranscodingOptions(
  quality: TranscodingTargetQuality,
  duration: number
): z.infer<typeof TranscodingConfigSchema> {
  const config = getRegionConfig(quality);

  for (const entry of config) {
    if (duration <= entry.maxDurationSec) {
      return entry;
    }
  }

  const last = config.at(-1);
  if (last == null) {
    throw new Error('Missing region config!');
  }
  return last;
}
