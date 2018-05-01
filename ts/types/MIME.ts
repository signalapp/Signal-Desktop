/**
 * @prettier
 */
export type MIMEType = string & { _mimeTypeBrand: any };

export const isJPEG = (value: MIMEType): boolean => value === 'image/jpeg';

export const isImage = (value: MIMEType): boolean => value.startsWith('image/');

export const isVideo = (value: MIMEType): boolean => value.startsWith('video/');

export const isAudio = (value: MIMEType): boolean => value.startsWith('audio/');
