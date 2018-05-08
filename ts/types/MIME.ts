export type MIMEType = string & { _mimeTypeBrand: any };

export const APPLICATION_OCTET_STREAM = 'application/octet-stream' as MIMEType;
export const APPLICATION_JSON = 'application/json' as MIMEType;
export const AUDIO_AAC = 'audio/aac' as MIMEType;
export const AUDIO_MP3 = 'audio/mp3' as MIMEType;
export const IMAGE_GIF = 'image/gif' as MIMEType;
export const IMAGE_JPEG = 'image/jpeg' as MIMEType;
export const VIDEO_MP4 = 'video/mp4' as MIMEType;
export const VIDEO_QUICKTIME = 'video/quicktime' as MIMEType;

export const isJPEG = (value: MIMEType): boolean => value === 'image/jpeg';
export const isImage = (value: MIMEType): boolean => value.startsWith('image/');
export const isVideo = (value: MIMEType): boolean => value.startsWith('video/');
export const isAudio = (value: MIMEType): boolean => value.startsWith('audio/');
