/**
 * @prettier
 */
import is from '@sindresorhus/is';
import moment from 'moment';

import * as GoogleChrome from '../util/GoogleChrome';
import { saveURLAsFile } from '../util/saveURLAsFile';
import { arrayBufferToObjectURL } from '../util/arrayBufferToObjectURL';
import { MIMEType } from './MIME';

export type Attachment = {
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
} & Partial<AttachmentSchemaVersion3>;

interface AttachmentSchemaVersion3 {
  path: string;
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
  document,
  getAbsolutePath,
  timestamp,
}: {
  attachment: Attachment;
  document: Document;
  getAbsolutePath: (relativePath: string) => string;
  timestamp?: number;
}): void => {
  const url = !is.undefined(attachment.path)
    ? getAbsolutePath(attachment.path)
    : arrayBufferToObjectURL({
        data: attachment.data,
        type: SAVE_CONTENT_TYPE,
      });
  const filename = getSuggestedFilename({ attachment, timestamp });
  saveURLAsFile({ url, filename, document });
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
