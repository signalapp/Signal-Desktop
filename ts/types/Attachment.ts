/**
 * @prettier
 */
import is from '@sindresorhus/is';
import moment from 'moment';

import * as GoogleChrome from '../util/GoogleChrome';
import { arrayBufferToObjectURL } from '../util/arrayBufferToObjectURL';
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

const SAVE_CONTENT_TYPE = 'application/octet-stream' as MIMEType;

export const isVisualMedia = (attachment: Attachment): boolean => {
  const { contentType } = attachment;

  if (is.undefined(contentType)) {
    return false;
  }

  const isSupportedImageType = GoogleChrome.isImageTypeSupported(contentType);
  const isSupportedVideoType = GoogleChrome.isVideoTypeSupported(contentType);
  return isSupportedImageType || isSupportedVideoType;
};

export const save = ({
  attachment,
  timestamp,
}: {
  attachment: Attachment;
  timestamp?: number;
}): void => {
  const url = arrayBufferToObjectURL({
    data: attachment.data,
    type: SAVE_CONTENT_TYPE,
  });
  const anchorElement = document.createElement('a');
  anchorElement.href = url;
  anchorElement.download = getSuggestedFilename({ attachment, timestamp });
  anchorElement.click();
  URL.revokeObjectURL(url);
};

export const getSuggestedFilename = ({
  attachment,
  timestamp,
}: {
  attachment: Attachment;
  timestamp?: number | Date;
}): string => {
  if (attachment.fileName) {
    return attachment.fileName;
  }

  const prefix = 'signal-attachment';
  const suffix = timestamp
    ? moment(timestamp).format('-YYYY-MM-DD-HHmmss')
    : '';
  const fileType = getFileExtension(attachment);
  const extension = fileType ? `.${fileType}` : '';
  return `${prefix}${suffix}${extension}`;
};

export const getFileExtension = (attachment: Attachment): string | null => {
  if (!attachment.contentType) {
    return null;
  }

  switch (attachment.contentType) {
    case 'video/quicktime':
      return 'mov';
    default:
      // TODO: Use better MIME --> file extension mapping:
      return attachment.contentType.split('/')[1];
  }
};
