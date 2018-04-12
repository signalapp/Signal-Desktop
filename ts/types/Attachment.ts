import is from '@sindresorhus/is';

import * as GoogleChrome from '../GoogleChrome';
import { MIMEType } from './MIME';


export interface Attachment {
  fileName?: string;
  contentType?: MIMEType;
  size?: number;
  data: ArrayBuffer;

  // // Omit unused / deprecated keys:
  // schemaVersion?: number;
  // id?: string;
  // width?: number;
  // height?: number;
  // thumbnail?: ArrayBuffer;
  // key?: ArrayBuffer;
  // digest?: ArrayBuffer;
  // flags?: number;
}

export const isVisualMedia = (attachment: Attachment): boolean => {
  const { contentType } = attachment;

  if (is.undefined(contentType)) {
    return false;
  }

  const isSupportedImageType = GoogleChrome.isImageTypeSupported(contentType);
  const isSupportedVideoType = GoogleChrome.isVideoTypeSupported(contentType);
  return isSupportedImageType || isSupportedVideoType;
};
