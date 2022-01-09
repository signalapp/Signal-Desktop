export type MIMEType = string;

export const APPLICATION_OCTET_STREAM = 'application/octet-stream' as MIMEType;
export const APPLICATION_JSON = 'application/json' as MIMEType;
export const AUDIO_AAC = 'audio/aac' as MIMEType;
export const AUDIO_WEBM = 'audio/webm' as MIMEType;
export const AUDIO_MP3 = 'audio/mp3' as MIMEType;
export const AUDIO_OPUS = 'audio/ogg' as MIMEType;
export const IMAGE_GIF = 'image/gif' as MIMEType;
export const IMAGE_JPEG = 'image/jpeg' as MIMEType;
export const IMAGE_BMP = 'image/bmp' as MIMEType;
export const IMAGE_ICO = 'image/x-icon' as MIMEType;
export const IMAGE_WEBP = 'image/webp' as MIMEType;
export const IMAGE_PNG = 'image/png' as MIMEType;
export const IMAGE_TIFF = 'image/tiff' as MIMEType;
export const IMAGE_UNKNOWN = 'image/unknown' as MIMEType;
export const VIDEO_MP4 = 'video/mp4' as MIMEType;
export const VIDEO_QUICKTIME = 'video/quicktime' as MIMEType;
export const ODT = 'application/vnd.oasis.opendocument.spreadsheet' as MIMEType;

export const isJPEG = (value: MIMEType): boolean => value === 'image/jpeg';
export const isImage = (value: MIMEType): boolean =>
  value?.length > 0 && value.startsWith('image/');
export const isVideo = (value: MIMEType): boolean =>
  value?.length > 0 && value.startsWith('video/');
// As of 2020-04-16 aif files do not play in Electron nor Chrome. We should only
// recognize them as file attachments.
export const isAudio = (value: MIMEType): boolean =>
  value?.length > 0 && value.startsWith('audio/') && !value.endsWith('aiff');
