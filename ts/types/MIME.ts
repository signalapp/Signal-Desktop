// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type MIMEType = string & { _mimeTypeBrand: never };

export const APPLICATION_OCTET_STREAM = 'application/octet-stream' as MIMEType;
export const APPLICATION_JSON = 'application/json' as MIMEType;
export const AUDIO_AAC = 'audio/aac' as MIMEType;
export const AUDIO_MP3 = 'audio/mp3' as MIMEType;
export const IMAGE_GIF = 'image/gif' as MIMEType;
export const IMAGE_JPEG = 'image/jpeg' as MIMEType;
export const IMAGE_PNG = 'image/png' as MIMEType;
export const IMAGE_WEBP = 'image/webp' as MIMEType;
export const IMAGE_ICO = 'image/x-icon' as MIMEType;
export const IMAGE_BMP = 'image/bmp' as MIMEType;
export const VIDEO_MP4 = 'video/mp4' as MIMEType;
export const VIDEO_QUICKTIME = 'video/quicktime' as MIMEType;
export const LONG_MESSAGE = 'text/x-signal-plain' as MIMEType;

export const isGif = (value: string): value is MIMEType =>
  value === 'image/gif';
export const isJPEG = (value: string): value is MIMEType =>
  value === 'image/jpeg';
export const isImage = (value: string): value is MIMEType =>
  Boolean(value) && value.startsWith('image/');
export const isVideo = (value: string): value is MIMEType =>
  Boolean(value) && value.startsWith('video/');
// As of 2020-04-16 aif files do not play in Electron nor Chrome. We should only
// recognize them as file attachments.
export const isAudio = (value: string): value is MIMEType =>
  Boolean(value) && value.startsWith('audio/') && !value.endsWith('aiff');
export const isLongMessage = (value: unknown): value is MIMEType =>
  value === LONG_MESSAGE;
