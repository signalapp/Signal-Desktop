// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import { isEmpty } from 'lodash';
import { isRecord } from '../util/isRecord';
import { isNormalNumber } from '../util/isNormalNumber';
import * as log from '../logging/log';
import type { BadgeType, BadgeImageType } from './types';
import { parseBadgeCategory } from './BadgeCategory';
import { BadgeImageTheme, parseBadgeImageTheme } from './BadgeImageTheme';
import { safeParseUnknown } from '../util/schemas';

const MAX_BADGES = 1000;

const badgeFromServerSchema = z.object({
  category: z.string(),
  description: z.string(),
  id: z.string(),
  name: z.string(),
  svg: z.string(),
  svgs: z.array(z.record(z.string())).length(3),
  expiration: z.number().optional(),
  visible: z.boolean().optional(),
});

// GET /v1/subscription/configuration
const boostBadgesFromServerSchema = z.object({
  levels: z.record(
    z
      .object({
        badge: z.unknown(),
      })
      .or(z.undefined())
  ),
});

export function parseBoostBadgeListFromServer(
  value: unknown,
  updatesUrl: string
): Record<string, BadgeType> {
  const result: Record<string, BadgeType> = {};

  const parseResult = safeParseUnknown(boostBadgesFromServerSchema, value);
  if (!parseResult.success) {
    log.warn(
      'parseBoostBadgeListFromServer: server response was invalid:',
      parseResult.error.format()
    );
    throw new Error(
      'parseBoostBadgeListFromServer: Failed to parse server response'
    );
  }

  const boostBadges = parseResult.data;
  Object.keys(boostBadges.levels).forEach(level => {
    const item = boostBadges.levels[level];
    if (!item) {
      log.warn(`parseBoostBadgeListFromServer: level ${level} had no badge`);
      return;
    }

    const parsed = parseBadgeFromServer(item.badge, updatesUrl);

    if (parsed) {
      result[level] = parsed;
    }
  });

  return result;
}

export function parseBadgeFromServer(
  value: unknown,
  updatesUrl: string
): BadgeType | undefined {
  const parseResult = safeParseUnknown(badgeFromServerSchema, value);
  if (!parseResult.success) {
    log.warn(
      'parseBadgeFromServer: badge was invalid:',
      parseResult.error.format()
    );
    return undefined;
  }

  const {
    category,
    description: descriptionTemplate,
    expiration,
    id,
    name,
    svg,
    svgs,
    visible,
  } = parseResult.data;
  const images = parseImages(svgs, svg, updatesUrl);
  if (images.length !== 4) {
    log.warn('Got invalid number of SVGs from the server');
    return undefined;
  }

  return {
    id,
    category: parseBadgeCategory(category),
    name,
    descriptionTemplate,
    images,
    ...(isNormalNumber(expiration) && typeof visible === 'boolean'
      ? {
          expiresAt: expiration * 1000,
          isVisible: visible,
        }
      : {}),
  };
}

export function parseBadgesFromServer(
  value: unknown,
  updatesUrl: string
): Array<BadgeType> {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: Array<BadgeType> = [];

  const numberOfBadgesToParse = Math.min(value.length, MAX_BADGES);
  for (let i = 0; i < numberOfBadgesToParse; i += 1) {
    const item = value[i];
    const parsed = parseBadgeFromServer(item, updatesUrl);

    if (!parsed) {
      continue;
    }

    result.push(parsed);
  }

  return result;
}

const parseImages = (
  rawSvgs: ReadonlyArray<Record<string, string>>,
  rawSvg: string,
  updatesUrl: string
): Array<BadgeImageType> => {
  const result: Array<BadgeImageType> = [];

  for (const item of rawSvgs) {
    if (!isRecord(item)) {
      log.warn('Got invalid SVG from the server');
      continue;
    }

    const image: BadgeImageType = {};
    for (const [rawTheme, filename] of Object.entries(item)) {
      if (typeof filename !== 'string') {
        log.warn('Got an SVG from the server that lacked a valid filename');
        continue;
      }
      const theme = parseBadgeImageTheme(rawTheme);
      image[theme] = { url: parseImageFilename(filename, updatesUrl) };
    }

    if (isEmpty(image)) {
      log.warn('Got an SVG from the server that lacked valid values');
    } else {
      result.push(image);
    }
  }

  result.push({
    [BadgeImageTheme.Transparent]: {
      url: parseImageFilename(rawSvg, updatesUrl),
    },
  });

  return result;
};

const parseImageFilename = (filename: string, updatesUrl: string): string =>
  new URL(`/static/badges/${filename}`, updatesUrl).toString();
