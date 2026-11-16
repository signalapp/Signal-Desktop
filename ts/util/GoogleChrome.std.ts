// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type * as MIME from '../types/MIME.std.ts';

type MIMETypeSupportMap = Record<string, boolean>;

// See: https://en.wikipedia.org/wiki/Comparison_of_web_browsers#Image_format_support
const SUPPORTED_IMAGE_MIME_TYPES: MIMETypeSupportMap = {
  'image/avif': true,
  'image/bmp': true,
  'image/gif': true,
  'image/jpeg': true,
  // No need to support SVG
  'image/svg+xml': false,
  'image/webp': true,
  'image/x-xbitmap': true,
  // ICO
  'image/vnd.microsoft.icon': true,
  'image/ico': true,
  'image/icon': true,
  'image/x-icon': true,
  // PNG
  'image/apng': true,
  'image/png': true,
};

export const isImageTypeSupported = (mimeType: MIME.MIMEType): boolean =>
  SUPPORTED_IMAGE_MIME_TYPES[mimeType] === true;

const PLAYABLE_VIDEO_MIME_TYPES = {
  'video/mp4': true,
  'video/ogg': true,
  'video/webm': true,
} as const satisfies MIMETypeSupportMap;

const TRANSCODABLE_VIDEO_MIME_TYPES = {
  ...PLAYABLE_VIDEO_MIME_TYPES,
  'video/quicktime': true,
} as const satisfies MIMETypeSupportMap;

export type TranscodableVideoMIMEType =
  keyof typeof TRANSCODABLE_VIDEO_MIME_TYPES;

const isMIMETypeSupported = (
  map: MIMETypeSupportMap,
  mimeType: MIME.MIMEType
): boolean => map[mimeType] === true;

// See: https://www.chromium.org/audio-video
export const isVideoTypePlayable = (mimeType: MIME.MIMEType): boolean =>
  isMIMETypeSupported(PLAYABLE_VIDEO_MIME_TYPES, mimeType);

export const isVideoTypeTranscodable = (mimeType: MIME.MIMEType): boolean =>
  isMIMETypeSupported(TRANSCODABLE_VIDEO_MIME_TYPES, mimeType);

export const getSupportedImageTypes = (): Array<MIME.MIMEType> => {
  const keys = Object.keys(SUPPORTED_IMAGE_MIME_TYPES) as Array<MIME.MIMEType>;
  return keys.filter(contentType => SUPPORTED_IMAGE_MIME_TYPES[contentType]);
};

export const getTranscodableVideoTypes = (): Array<MIME.MIMEType> => {
  const keys = Object.keys(
    TRANSCODABLE_VIDEO_MIME_TYPES
  ) as Array<MIME.MIMEType>;
  return keys.filter(contentType => isVideoTypeTranscodable(contentType));
};

export const TRANSCODABLE_VIDEO_EXTENSIONS = [
  // On Linux .mov extension is not respected through video/quicktime "accept"
  // attribute of <input/>
  '.mov',
];
