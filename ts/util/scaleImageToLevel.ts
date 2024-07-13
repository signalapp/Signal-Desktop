// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoadImageResult } from 'blueimp-load-image';
import loadImage from 'blueimp-load-image';

import type { MIMEType } from '../types/MIME';
import { IMAGE_JPEG } from '../types/MIME';
import { canvasToBlob } from './canvasToBlob';
import { getValue } from '../RemoteConfig';
import { parseNumber } from './libphonenumberUtil';

enum MediaQualityLevels {
  One = 1,
  Two = 2,
  Three = 3,
}

const DEFAULT_LEVEL = MediaQualityLevels.One;

const MiB = 1024 * 1024;

const DEFAULT_LEVEL_DATA = {
  maxDimensions: 1600,
  quality: 0.7,
  size: MiB,
  thresholdSize: 0.2 * MiB,
};

const MEDIA_QUALITY_LEVEL_DATA = new Map([
  [MediaQualityLevels.One, DEFAULT_LEVEL_DATA],
  [
    MediaQualityLevels.Two,
    {
      maxDimensions: 2048,
      quality: 0.75,
      size: MiB * 1.5,
      thresholdSize: 0.3 * MiB,
    },
  ],
  [
    MediaQualityLevels.Three,
    {
      maxDimensions: 4096,
      quality: 0.75,
      size: MiB * 3,
      thresholdSize: 0.4 * MiB,
    },
  ],
]);

const SCALABLE_DIMENSIONS = [3072, 2048, 1600, 1024, 768];
const MIN_DIMENSIONS = 512;

function parseCountryValues(values: string): Map<string, MediaQualityLevels> {
  const map = new Map<string, MediaQualityLevels>();
  values.split(',').forEach(value => {
    const [countryCode, level] = value.split(':');
    map.set(
      countryCode,
      Number(level) === 2 ? MediaQualityLevels.Two : MediaQualityLevels.One
    );
  });
  return map;
}

function getMediaQualityLevel(): MediaQualityLevels {
  const values = getValue('desktop.mediaQuality.levels');
  if (!values) {
    return DEFAULT_LEVEL;
  }

  const e164 = window.textsecure.storage.user.getNumber();
  if (!e164) {
    return DEFAULT_LEVEL;
  }

  const parsedPhoneNumber = parseNumber(e164);
  if (!parsedPhoneNumber.isValidNumber) {
    return DEFAULT_LEVEL;
  }

  const countryValues = parseCountryValues(values);

  const level = parsedPhoneNumber.countryCode
    ? countryValues.get(parsedPhoneNumber.countryCode)
    : undefined;
  if (level) {
    return level;
  }

  return countryValues.get('*') || DEFAULT_LEVEL;
}

async function getCanvasBlobAsJPEG(
  image: HTMLCanvasElement,
  dimensions: number,
  quality: number
): Promise<Blob> {
  const canvas = loadImage.scale(image, {
    canvas: true,
    maxHeight: dimensions,
    maxWidth: dimensions,
  });
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('image not a canvas');
  }
  return canvasToBlob(canvas, IMAGE_JPEG, quality);
}

export async function scaleImageToLevel({
  fileOrBlobOrURL,
  contentType,
  size,
  highQuality,
}: {
  fileOrBlobOrURL: File | Blob | string;
  contentType: MIMEType;
  size: number;
  highQuality: boolean | null;
}): Promise<{
  blob: Blob;
  contentType: MIMEType;
}> {
  let data: LoadImageResult;
  try {
    data = await loadImage(fileOrBlobOrURL, {
      canvas: true,
      orientation: true,
      meta: true, // Check if we need to strip EXIF data
    });
    if (!(data.image instanceof HTMLCanvasElement)) {
      throw new Error('image not a canvas');
    }
  } catch (cause) {
    const error = new Error('scaleImageToLevel: Failed to process image', {
      cause,
    });
    throw error;
  }

  const level = highQuality ? MediaQualityLevels.Three : getMediaQualityLevel();
  const {
    maxDimensions,
    quality,
    size: targetSize,
    thresholdSize,
  } = MEDIA_QUALITY_LEVEL_DATA.get(level) || DEFAULT_LEVEL_DATA;
  if (size <= thresholdSize) {
    // Always encode through canvas as a temporary fix for a library bug
    const blob: Blob = await canvasToBlob(data.image, contentType);
    return {
      blob,
      contentType,
    };
  }

  for (let i = 0; i < SCALABLE_DIMENSIONS.length; i += 1) {
    const scalableDimensions = SCALABLE_DIMENSIONS[i];
    if (maxDimensions < scalableDimensions) {
      continue;
    }

    // We need these operations to be in serial
    // eslint-disable-next-line no-await-in-loop
    const blob = await getCanvasBlobAsJPEG(
      data.image,
      scalableDimensions,
      quality
    );
    if (blob.size <= targetSize) {
      return {
        blob,
        contentType: IMAGE_JPEG,
      };
    }
  }

  const blob = await getCanvasBlobAsJPEG(data.image, MIN_DIMENSIONS, quality);
  return {
    blob,
    contentType: IMAGE_JPEG,
  };
}
