import * as MIME from './types/MIME';


interface MIMETypeSupportMap {
  [key: string]: boolean;
}

// See: https://en.wikipedia.org/wiki/Comparison_of_web_browsers#Image_format_support
const SUPPORTED_IMAGE_MIME_TYPES: MIMETypeSupportMap = {
  'image/bmp': true,
  'image/gif': true,
  'image/jpeg': true,
  'image/svg+xml': true,
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

const SUPPORTED_VIDEO_MIME_TYPES: MIMETypeSupportMap = {
  'video/mp4': true,
  'video/ogg': true,
  'video/webm': true,
};

// See: https://www.chromium.org/audio-video
export const isVideoTypeSupported = (mimeType: MIME.MIMEType): boolean =>
   SUPPORTED_VIDEO_MIME_TYPES[mimeType] === true;
