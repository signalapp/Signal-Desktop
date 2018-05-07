import is from '@sindresorhus/is';
import moment from 'moment';

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
  getAbsolutePath,
  timestamp,
}: {
  attachment: Attachment;
  document: Document;
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
  const filename = getSuggestedFilename({ attachment, timestamp });
  saveURLAsFile({ url, filename, document });
  if (isObjectURLRequired) {
    URL.revokeObjectURL(url);
  }
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
