import is from '@sindresorhus/is';
import moment from 'moment';
import { padStart } from 'lodash';

import * as MIME from './MIME';
import { arrayBufferToObjectURL } from '../util/arrayBufferToObjectURL';
import { saveURLAsFile } from '../util/saveURLAsFile';
import { SignalService } from '../protobuf';

export type Attachment = {
  fileName?: string | null;
  flags?: SignalService.AttachmentPointer.Flags;
  contentType?: MIME.MIMEType;
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
} & Partial<AttachmentSchemaVersion3>;

interface AttachmentSchemaVersion3 {
  path: string;
}

export const isVisualMedia = (attachment: Attachment): boolean => {
  const { contentType } = attachment;

  if (is.undefined(contentType)) {
    return false;
  }

  if (isVoiceMessage(attachment)) {
    return false;
  }

  return MIME.isImage(contentType) || MIME.isVideo(contentType);
};

export const isFile = (attachment: Attachment): boolean => {
  const { contentType } = attachment;

  if (is.undefined(contentType)) {
    return false;
  }

  if (isVisualMedia(attachment)) {
    return false;
  }

  if (isVoiceMessage(attachment)) {
    return false;
  }

  return true;
};

export const isVoiceMessage = (attachment: Attachment): boolean => {
  const flag = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;
  const hasFlag =
    // tslint:disable-next-line no-bitwise
    !is.undefined(attachment.flags) && (attachment.flags & flag) === flag;
  if (hasFlag) {
    return true;
  }

  const isLegacyAndroidVoiceMessage =
    !is.undefined(attachment.contentType) &&
    MIME.isAudio(attachment.contentType) &&
    attachment.fileName === null;
  if (isLegacyAndroidVoiceMessage) {
    return true;
  }

  return false;
};

export const save = ({
  attachment,
  document,
  index,
  getAbsolutePath,
  timestamp,
}: {
  attachment: Attachment;
  document: Document;
  index: number;
  getAbsolutePath: (relativePath: string) => string;
  timestamp?: number;
}): void => {
  const isObjectURLRequired = is.undefined(attachment.path);
  const url = !is.undefined(attachment.path)
    ? getAbsolutePath(attachment.path)
    : arrayBufferToObjectURL({
        data: attachment.data,
        type: MIME.APPLICATION_OCTET_STREAM,
      });
  const filename = getSuggestedFilename({ attachment, timestamp, index });
  saveURLAsFile({ url, filename, document });
  if (isObjectURLRequired) {
    URL.revokeObjectURL(url);
  }
};

export const getSuggestedFilename = ({
  attachment,
  timestamp,
  index,
}: {
  attachment: Attachment;
  timestamp?: number | Date;
  index?: number;
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
  const indexSuffix = index ? `_${padStart(index.toString(), 3, '0')}` : '';

  return `${prefix}${suffix}${indexSuffix}${extension}`;
};

export const getFileExtension = (attachment: Attachment): string | null => {
  if (!attachment.contentType) {
    return null;
  }

  switch (attachment.contentType) {
    case 'video/quicktime':
      return 'mov';
    default:
      return attachment.contentType.split('/')[1];
  }
};
