export type MIMEType = string & { _mimeTypeBrand: any };


export const isVideo = (value: MIMEType): boolean =>
  value.startsWith('video/') && value !== 'video/wmv';

export const isImage = (value: MIMEType): boolean =>
  value.startsWith('image/') && value !== 'image/tiff';

export const isAudio = (value: MIMEType): boolean =>
  value.startsWith('audio/');

export const isJPEG = (value: MIMEType): boolean =>
  value === 'image/jpeg';
