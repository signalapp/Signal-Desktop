import is from '@sindresorhus/is';
import moment from 'moment';
import { padStart } from 'lodash';

import * as MIME from './MIME';
import { arrayBufferToObjectURL } from '../util/arrayBufferToObjectURL';
import { saveURLAsFile } from '../util/saveURLAsFile';
import { SignalService } from '../protobuf';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../util/GoogleChrome';
import { LocalizerType } from './Util';

const MAX_WIDTH = 300;
const MAX_HEIGHT = MAX_WIDTH * 1.5;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 50;

// Used for display

export interface AttachmentType {
  caption?: string;
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage?: boolean;
  /** For messages not already on disk, this will be a data url */
  url: string;
  size?: number;
  fileSize?: string;
  pending?: boolean;
  width?: number;
  height?: number;
  screenshot?: {
    height: number;
    width: number;
    url: string;
    contentType: MIME.MIMEType;
  };
  thumbnail?: {
    height: number;
    width: number;
    url: string;
    contentType: MIME.MIMEType;
  };
}

// UI-focused functions

export function getExtensionForDisplay({
  fileName,
  contentType,
}: {
  fileName: string;
  contentType: MIME.MIMEType;
}): string | undefined {
  if (fileName && fileName.indexOf('.') >= 0) {
    const lastPeriod = fileName.lastIndexOf('.');
    const extension = fileName.slice(lastPeriod + 1);
    if (extension.length) {
      return extension;
    }
  }

  if (!contentType) {
    return;
  }

  const slash = contentType.indexOf('/');
  if (slash >= 0) {
    return contentType.slice(slash + 1);
  }

  return;
}

export function isAudio(attachments?: Array<AttachmentType>) {
  return (
    attachments &&
    attachments[0] &&
    attachments[0].contentType &&
    MIME.isAudio(attachments[0].contentType)
  );
}

export function canDisplayImage(attachments?: Array<AttachmentType>) {
  const { height, width } =
    attachments && attachments[0] ? attachments[0] : { height: 0, width: 0 };

  return (
    height &&
    height > 0 &&
    height <= 4096 &&
    width &&
    width > 0 &&
    width <= 4096
  );
}

export function getThumbnailUrl(attachment: AttachmentType) {
  if (attachment.thumbnail) {
    return attachment.thumbnail.url;
  }

  return getUrl(attachment);
}

export function getUrl(attachment: AttachmentType) {
  if (attachment.screenshot) {
    return attachment.screenshot.url;
  }

  return attachment.url;
}

export function isImage(attachments?: Array<AttachmentType>) {
  return (
    attachments &&
    attachments[0] &&
    attachments[0].contentType &&
    isImageTypeSupported(attachments[0].contentType)
  );
}

export function isImageAttachment(attachment: AttachmentType) {
  return (
    attachment &&
    attachment.contentType &&
    isImageTypeSupported(attachment.contentType)
  );
}
export function hasImage(attachments?: Array<AttachmentType>) {
  return (
    attachments &&
    attachments[0] &&
    (attachments[0].url || attachments[0].pending)
  );
}

export function isVideo(attachments?: Array<AttachmentType>) {
  return attachments && isVideoAttachment(attachments[0]);
}

export function isVideoAttachment(attachment?: AttachmentType) {
  return (
    attachment &&
    attachment.contentType &&
    isVideoTypeSupported(attachment.contentType)
  );
}

export function hasVideoScreenshot(attachments?: Array<AttachmentType>) {
  const firstAttachment = attachments ? attachments[0] : null;

  return (
    firstAttachment &&
    firstAttachment.screenshot &&
    firstAttachment.screenshot.url
  );
}

type DimensionsType = {
  height: number;
  width: number;
};

export function getImageDimensions(attachment: AttachmentType): DimensionsType {
  const { height, width } = attachment;
  if (!height || !width) {
    return {
      height: MIN_HEIGHT,
      width: MIN_WIDTH,
    };
  }

  const aspectRatio = height / width;
  const targetWidth = Math.max(Math.min(MAX_WIDTH, width), MIN_WIDTH);
  const candidateHeight = Math.round(targetWidth * aspectRatio);

  return {
    width: targetWidth,
    height: Math.max(Math.min(MAX_HEIGHT, candidateHeight), MIN_HEIGHT),
  };
}

export function areAllAttachmentsVisual(
  attachments?: Array<AttachmentType>
): boolean {
  if (!attachments) {
    return false;
  }

  const max = attachments.length;
  for (let i = 0; i < max; i += 1) {
    const attachment = attachments[i];
    if (!isImageAttachment(attachment) && !isVideoAttachment(attachment)) {
      return false;
    }
  }

  return true;
}

export function getGridDimensions(
  attachments?: Array<AttachmentType>
): null | DimensionsType {
  if (!attachments || !attachments.length) {
    return null;
  }

  if (!isImage(attachments) && !isVideo(attachments)) {
    return null;
  }

  if (attachments.length === 1) {
    return getImageDimensions(attachments[0]);
  }

  if (attachments.length === 2) {
    return {
      height: 150,
      width: 300,
    };
  }

  if (attachments.length === 4) {
    return {
      height: 300,
      width: 300,
    };
  }

  return {
    height: 200,
    width: 300,
  };
}

export function getAlt(
  attachment: AttachmentType,
  i18n: LocalizerType
): string {
  return isVideoAttachment(attachment)
    ? i18n('videoAttachmentAlt')
    : i18n('imageAttachmentAlt');
}

// Migration-related attachment stuff

export type Attachment = {
  fileName?: string;
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
    !attachment.fileName;
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

  const prefix = 'session-attachment';
  const suffix = timestamp
    ? moment(timestamp).format('-YYYY-MM-DD-HHmmss')
    : '';
  const fileType = getFileExtension(attachment);
  const extension = fileType ? `.${fileType}` : '';
  const indexSuffix = index ? `_${padStart(index.toString(), 3, '0')}` : '';

  return `${prefix}${suffix}${indexSuffix}${extension}`;
};

export const getFileExtension = (
  attachment: Attachment
): string | undefined => {
  if (!attachment.contentType) {
    return;
  }

  switch (attachment.contentType) {
    case 'video/quicktime':
      return 'mov';
    default:
      return attachment.contentType.split('/')[1];
  }
};
