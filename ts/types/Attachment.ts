import is from '@sindresorhus/is';
import moment from 'moment';
import { isArrayBuffer, padStart } from 'lodash';

import * as MIME from './MIME';
import { saveURLAsFile } from '../util/saveURLAsFile';
import { SignalService } from '../protobuf';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../util/GoogleChrome';
import { LocalizerType } from './Util';
import { fromHexToArray, toHex } from '../session/utils/String';
import { getSodium } from '../session/crypto';
import { fromHex } from 'bytebuffer';

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
  videoUrl?: string;
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

export function isImageAttachment(attachment: AttachmentType): boolean {
  return Boolean(
    attachment &&
      attachment.contentType &&
      isImageTypeSupported(attachment.contentType)
  );
}
export function hasImage(attachments?: Array<AttachmentType>): boolean {
  return Boolean(
    attachments &&
      attachments[0] &&
      (attachments[0].url || attachments[0].pending)
  );
}

export function isVideo(attachments?: Array<AttachmentType>): boolean {
  return Boolean(attachments && isVideoAttachment(attachments[0]));
}

export function isVideoAttachment(attachment?: AttachmentType): boolean {
  return Boolean(
    !!attachment &&
      !!attachment.contentType &&
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

export async function arrayBufferFromFile(file: any): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const FR = new FileReader();
    FR.onload = (e: any) => {
      resolve(e.target.result);
    };
    FR.onerror = reject;
    FR.onabort = reject;
    FR.readAsArrayBuffer(file);
  });
}

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
  caption?: string;
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
  timestamp,
}: {
  attachment: AttachmentType;
  document: Document;
  index?: number;
  getAbsolutePath: (relativePath: string) => string;
  timestamp?: number;
}): void => {
  const isObjectURLRequired = is.undefined(attachment.fileName);
  const filename = getSuggestedFilename({ attachment, timestamp, index });
  saveURLAsFile({ url: attachment.url, filename, document });
  if (isObjectURLRequired) {
    URL.revokeObjectURL(attachment.url);
  }
};

export const getSuggestedFilename = ({
  attachment,
  timestamp,
  index,
}: {
  attachment: AttachmentType;
  timestamp?: number | Date;
  index?: number;
}): string => {
  const prefix = 'session-attachment';
  const suffix = timestamp
    ? moment(timestamp).format('-YYYY-MM-DD-HHmmss')
    : '';
  const fileType = getFileExtension(attachment);
  const extension = fileType ? `.${fileType}` : '';
  const indexSuffix = index ? `_${padStart(index.toString(), 3, '0')}` : '';

  return `${prefix}${suffix}${indexSuffix}${extension}`;
};

// Used for overriden the sent filename of an attachment, but keeping the file extension the same
export const getSuggestedFilenameSending = ({
  attachment,
  timestamp,
}: {
  attachment: AttachmentType;
  timestamp?: number | Date;
}): string => {
  const prefix = 'session-attachment';
  const suffix = timestamp
    ? moment(timestamp).format('-YYYY-MM-DD-HHmmss')
    : '';
  const fileType = getFileExtension(attachment);
  const extension = fileType ? `.${fileType}` : '';

  return `${prefix}${suffix}${extension}`;
};

export const getFileExtension = (
  attachment: AttachmentType
): string | undefined => {
  // we override textplain to the extension of the file
  if (!attachment.contentType || attachment.contentType === 'text/plain') {
    if (attachment.fileName?.length) {
      const dotLastIndex = attachment.fileName.lastIndexOf('.');
      if (dotLastIndex !== -1) {
        return attachment.fileName.substring(dotLastIndex + 1);
      } else {
        return undefined;
      }
    }
    return undefined;
  }

  switch (attachment.contentType) {
    case 'video/quicktime':
      return 'mov';
    default:
      return attachment.contentType.split('/')[1];
  }
};
let indexEncrypt = 0;

export const encryptAttachmentBuffer = async (bufferIn: ArrayBuffer) => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const ourIndex = indexEncrypt;
  indexEncrypt++;
  console.time(`timer #*. encryptAttachmentBuffer ${ourIndex}`);

  const uintArrayIn = new Uint8Array(bufferIn);
  const sodium = await getSodium();

  /* Shared secret key required to encrypt/decrypt the stream */
  // const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();

  const key = fromHexToArray(
    '0c5f7147b6d3239cbb5a418814cee1bfca2df5c94bffddf22ee37eea3ede972b'
  );
  console.warn('key', toHex(key));

  /* Set up a new stream: initialize the state and create the header */
  const {
    state,
    header,
  } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  /* Now, encrypt the buffer. */
  const bufferOut = sodium.crypto_secretstream_xchacha20poly1305_push(
    state,
    uintArrayIn,
    null,
    sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
  );

  const encryptedBufferWithHeader = new Uint8Array(
    bufferOut.length + header.length
  );
  encryptedBufferWithHeader.set(header);
  encryptedBufferWithHeader.set(bufferOut, header.length);
  console.timeEnd(`timer #*. encryptAttachmentBuffer ${ourIndex}`);

  return { encryptedBufferWithHeader, header, key };
};

let indexDecrypt = 0;

export const decryptAttachmentBuffer = async (
  bufferIn: ArrayBuffer,
  key: string = '0c5f7147b6d3239cbb5a418814cee1bfca2df5c94bffddf22ee37eea3ede972b'
): Promise<Uint8Array> => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const ourIndex = indexDecrypt;
  indexDecrypt++;
  console.time(`timer .*# decryptAttachmentBuffer ${ourIndex}`);
  const sodium = await getSodium();

  const header = new Uint8Array(
    bufferIn.slice(0, sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  );
  const encryptedBuffer = new Uint8Array(
    bufferIn.slice(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  );
  try {
    /* Decrypt the stream: initializes the state, using the key and a header */
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(
      header,
      fromHexToArray(key)
    );
    // what if ^ this call fail (? try to load as a unencrypted attachment?)

    const messageTag = sodium.crypto_secretstream_xchacha20poly1305_pull(
      state,
      encryptedBuffer
    );
    console.timeEnd(`timer .*# decryptAttachmentBuffer ${ourIndex}`);
    // we expect the final tag to be there. If not, we might have an issue with this file
    // maybe not encrypted locally?
    if (
      messageTag.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    ) {
      return messageTag.message;
    }
  } catch (e) {
    console.timeEnd(`timer .*# decryptAttachmentBuffer ${ourIndex}`);

    window.log.warn('Failed to load the file as an encrypted one', e);
  }
  return new Uint8Array();
};
