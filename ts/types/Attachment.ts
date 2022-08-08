// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import is from '@sindresorhus/is';
import moment from 'moment';
import {
  isNumber,
  padStart,
  isTypedArray,
  isFunction,
  isUndefined,
  omit,
} from 'lodash';
import { blobToArrayBuffer } from 'blob-util';

import type { LoggerType } from './Logging';
import * as MIME from './MIME';
import * as log from '../logging/log';
import { toLogFormat } from './errors';
import { SignalService } from '../protobuf';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../util/GoogleChrome';
import type { LocalizerType } from './Util';
import { ThemeType } from './Util';
import { scaleImageToLevel } from '../util/scaleImageToLevel';
import * as GoogleChrome from '../util/GoogleChrome';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import { getValue } from '../RemoteConfig';
import { isRecord } from '../util/isRecord';

const MAX_WIDTH = 300;
const MAX_HEIGHT = MAX_WIDTH * 1.5;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 50;

// Used for display

export type AttachmentType = {
  error?: boolean;
  blurHash?: string;
  caption?: string;
  contentType: MIME.MIMEType;
  fileName?: string;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage?: boolean;
  /** For messages not already on disk, this will be a data url */
  url?: string;
  size: number;
  fileSize?: string;
  pending?: boolean;
  width?: number;
  height?: number;
  path?: string;
  screenshot?: {
    height: number;
    width: number;
    url?: string;
    contentType: MIME.MIMEType;
    path: string;
    data?: Uint8Array;
  };
  screenshotData?: Uint8Array;
  screenshotPath?: string;
  flags?: number;
  thumbnail?: ThumbnailType;
  isCorrupted?: boolean;
  downloadJobId?: string;
  cdnNumber?: number;
  cdnId?: string;
  cdnKey?: string;
  data?: Uint8Array;
  textAttachment?: TextAttachmentType;

  /** Legacy field. Used only for downloading old attachments */
  id?: number;

  /** Legacy field, used long ago for migrating attachments to disk. */
  schemaVersion?: number;

  /** Removed once we download the attachment */
  digest?: string;
  key?: string;
};

export type AttachmentWithHydratedData = AttachmentType & {
  data: Uint8Array;
};

export enum TextAttachmentStyleType {
  DEFAULT = 0,
  REGULAR = 1,
  BOLD = 2,
  SERIF = 3,
  SCRIPT = 4,
  CONDENSED = 5,
}

export type TextAttachmentType = {
  text?: string | null;
  textStyle?: number | null;
  textForegroundColor?: number | null;
  textBackgroundColor?: number | null;
  preview?: {
    image?: AttachmentType;
    title?: string | null;
    url?: string | null;
  } | null;
  gradient?: {
    startColor?: number | null;
    endColor?: number | null;
    angle?: number | null;
  } | null;
  color?: number | null;
};

export type DownloadedAttachmentType = AttachmentType & {
  data: Uint8Array;
};

export type BaseAttachmentDraftType = {
  blurHash?: string;
  contentType: MIME.MIMEType;
  screenshotContentType?: string;
  screenshotSize?: number;
  size: number;
  flags?: number;
};

// An ephemeral attachment type, used between user's request to add the attachment as
//   a draft and final save on disk and in conversation.draftAttachments.
export type InMemoryAttachmentDraftType =
  | ({
      data: Uint8Array;
      pending: false;
      screenshotData?: Uint8Array;
      fileName?: string;
      path?: string;
    } & BaseAttachmentDraftType)
  | {
      contentType: MIME.MIMEType;
      fileName?: string;
      path?: string;
      pending: true;
      size: number;
    };

// What's stored in conversation.draftAttachments
export type AttachmentDraftType =
  | ({
      url?: string;
      screenshotPath?: string;
      pending: false;
      // Old draft attachments may have a caption, though they are no longer editable
      //   because we removed the caption editor.
      caption?: string;
      fileName?: string;
      path: string;
      width?: number;
      height?: number;
    } & BaseAttachmentDraftType)
  | {
      contentType: MIME.MIMEType;
      fileName?: string;
      path?: string;
      pending: true;
      size: number;
    };

export type ThumbnailType = Pick<
  AttachmentType,
  'height' | 'width' | 'url' | 'contentType' | 'path' | 'data'
> & {
  // Only used when quote needed to make an in-memory thumbnail
  objectUrl?: string;
};

export async function migrateDataToFileSystem(
  attachment: AttachmentType,
  {
    writeNewAttachmentData,
    logger,
  }: {
    writeNewAttachmentData: (data: Uint8Array) => Promise<string>;
    logger: LoggerType;
  }
): Promise<AttachmentType> {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError("'writeNewAttachmentData' must be a function");
  }

  const { data } = attachment;
  const attachmentHasData = !isUndefined(data);
  const shouldSkipSchemaUpgrade = !attachmentHasData;
  if (shouldSkipSchemaUpgrade) {
    return attachment;
  }

  // This attachment was already broken by a roundtrip to the database - repair it now
  if (!isTypedArray(data)) {
    logger.warn(
      'migrateDataToFileSystem: Attachment had non-array `data` field; deleting.'
    );
    return omit({ ...attachment }, ['data']);
  }

  const path = await writeNewAttachmentData(data);

  const attachmentWithoutData = omit({ ...attachment, path }, ['data']);
  return attachmentWithoutData;
}

// // Incoming message attachment fields
// {
//   id: string
//   contentType: MIMEType
//   data: Uint8Array
//   digest: Uint8Array
//   fileName?: string
//   flags: null
//   key: Uint8Array
//   size: integer
//   thumbnail: Uint8Array
// }

// // Outgoing message attachment fields
// {
//   contentType: MIMEType
//   data: Uint8Array
//   fileName: string
//   size: integer
// }

// Returns true if `rawAttachment` is a valid attachment based on our current schema.
// Over time, we can expand this definition to become more narrow, e.g. require certain
// fields, etc.
export function isValid(
  rawAttachment?: Pick<AttachmentType, 'data' | 'path'>
): rawAttachment is AttachmentType {
  // NOTE: We cannot use `_.isPlainObject` because `rawAttachment` is
  // deserialized by protobuf:
  if (!rawAttachment) {
    return false;
  }

  return true;
}

// Upgrade steps
// NOTE: This step strips all EXIF metadata from JPEG images as
// part of re-encoding the image:
export async function autoOrientJPEG(
  attachment: AttachmentType,
  { logger }: { logger: LoggerType },
  {
    sendHQImages = false,
    isIncoming = false,
  }: {
    sendHQImages?: boolean;
    isIncoming?: boolean;
  } = {}
): Promise<AttachmentType> {
  if (isIncoming && !MIME.isJPEG(attachment.contentType)) {
    return attachment;
  }

  if (!canBeTranscoded(attachment)) {
    return attachment;
  }

  // If we haven't downloaded the attachment yet, we won't have the data.
  // All images go through handleImageAttachment before being sent and thus have
  // already been scaled to level, oriented, stripped of exif data, and saved
  // in high quality format. If we want to send the image in HQ we can return
  // the attachment as-is. Otherwise we'll have to further scale it down.
  if (!attachment.data || sendHQImages) {
    return attachment;
  }

  const dataBlob = new Blob([attachment.data], {
    type: attachment.contentType,
  });
  try {
    const { blob: xcodedDataBlob } = await scaleImageToLevel(
      dataBlob,
      attachment.contentType,
      isIncoming
    );
    const xcodedDataArrayBuffer = await blobToArrayBuffer(xcodedDataBlob);

    // IMPORTANT: We overwrite the existing `data` `Uint8Array` losing the original
    // image data. Ideally, we’d preserve the original image data for users who want to
    // retain it but due to reports of data loss, we don’t want to overburden IndexedDB
    // by potentially doubling stored image data.
    // See: https://github.com/signalapp/Signal-Desktop/issues/1589
    const xcodedAttachment = {
      // `digest` is no longer valid for auto-oriented image data, so we discard it:
      ...omit(attachment, 'digest'),
      data: new Uint8Array(xcodedDataArrayBuffer),
      size: xcodedDataArrayBuffer.byteLength,
    };

    return xcodedAttachment;
  } catch (error: unknown) {
    const errorString =
      isRecord(error) && 'stack' in error ? error.stack : error;
    logger.error(
      'autoOrientJPEG: Failed to rotate/scale attachment',
      errorString
    );

    return attachment;
  }
}

const UNICODE_LEFT_TO_RIGHT_OVERRIDE = '\u202D';
const UNICODE_RIGHT_TO_LEFT_OVERRIDE = '\u202E';
const UNICODE_REPLACEMENT_CHARACTER = '\uFFFD';
const INVALID_CHARACTERS_PATTERN = new RegExp(
  `[${UNICODE_LEFT_TO_RIGHT_OVERRIDE}${UNICODE_RIGHT_TO_LEFT_OVERRIDE}]`,
  'g'
);

// NOTE: Expose synchronous version to do property-based testing using `testcheck`,
// which currently doesn’t support async testing:
// https://github.com/leebyron/testcheck-js/issues/45
export function _replaceUnicodeOrderOverridesSync(
  attachment: AttachmentType
): AttachmentType {
  if (!is.string(attachment.fileName)) {
    return attachment;
  }

  const normalizedFilename = attachment.fileName.replace(
    INVALID_CHARACTERS_PATTERN,
    UNICODE_REPLACEMENT_CHARACTER
  );
  const newAttachment = { ...attachment, fileName: normalizedFilename };

  return newAttachment;
}

export const replaceUnicodeOrderOverrides = async (
  attachment: AttachmentType
): Promise<AttachmentType> => {
  return _replaceUnicodeOrderOverridesSync(attachment);
};

// \u202A-\u202E is LRE, RLE, PDF, LRO, RLO
// \u2066-\u2069 is LRI, RLI, FSI, PDI
// \u200E is LRM
// \u200F is RLM
// \u061C is ALM
const V2_UNWANTED_UNICODE = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g;

export async function replaceUnicodeV2(
  attachment: AttachmentType
): Promise<AttachmentType> {
  if (!is.string(attachment.fileName)) {
    return attachment;
  }

  const fileName = attachment.fileName.replace(
    V2_UNWANTED_UNICODE,
    UNICODE_REPLACEMENT_CHARACTER
  );

  return {
    ...attachment,
    fileName,
  };
}

export function removeSchemaVersion({
  attachment,
  logger,
}: {
  attachment: AttachmentType;
  logger: LoggerType;
}): AttachmentType {
  if (!isValid(attachment)) {
    logger.error(
      'Attachment.removeSchemaVersion: Invalid input attachment:',
      attachment
    );
    return attachment;
  }

  return omit(attachment, 'schemaVersion');
}

export function hasData(attachment: AttachmentType): boolean {
  return attachment.data instanceof Uint8Array;
}

export function loadData(
  readAttachmentData: (path: string) => Promise<Uint8Array>
): (
  attachment: Pick<AttachmentType, 'data' | 'path'>
) => Promise<AttachmentWithHydratedData> {
  if (!is.function_(readAttachmentData)) {
    throw new TypeError("'readAttachmentData' must be a function");
  }

  return async attachment => {
    if (!isValid(attachment)) {
      throw new TypeError("'attachment' is not valid");
    }

    const isAlreadyLoaded = Boolean(attachment.data);
    if (isAlreadyLoaded) {
      return attachment as AttachmentWithHydratedData;
    }

    if (!is.string(attachment.path)) {
      throw new TypeError("'attachment.path' is required");
    }

    const data = await readAttachmentData(attachment.path);
    return { ...attachment, data, size: data.byteLength };
  };
}

export function deleteData(
  deleteOnDisk: (path: string) => Promise<void>
): (attachment?: AttachmentType) => Promise<void> {
  if (!is.function_(deleteOnDisk)) {
    throw new TypeError('deleteData: deleteOnDisk must be a function');
  }

  return async (attachment?: AttachmentType): Promise<void> => {
    if (!isValid(attachment)) {
      throw new TypeError('deleteData: attachment is not valid');
    }

    const { path, thumbnail, screenshot } = attachment;
    if (is.string(path)) {
      await deleteOnDisk(path);
    }

    if (thumbnail && is.string(thumbnail.path)) {
      await deleteOnDisk(thumbnail.path);
    }

    if (screenshot && is.string(screenshot.path)) {
      await deleteOnDisk(screenshot.path);
    }
  };
}

const THUMBNAIL_SIZE = 150;
const THUMBNAIL_CONTENT_TYPE = MIME.IMAGE_PNG;

export async function captureDimensionsAndScreenshot(
  attachment: AttachmentType,
  params: {
    writeNewAttachmentData: (data: Uint8Array) => Promise<string>;
    getAbsoluteAttachmentPath: (path: string) => string;
    makeObjectUrl: (
      data: Uint8Array | ArrayBuffer,
      contentType: MIME.MIMEType
    ) => string;
    revokeObjectUrl: (path: string) => void;
    getImageDimensions: (params: {
      objectUrl: string;
      logger: LoggerType;
    }) => Promise<{
      width: number;
      height: number;
    }>;
    makeImageThumbnail: (params: {
      size: number;
      objectUrl: string;
      contentType: MIME.MIMEType;
      logger: LoggerType;
    }) => Promise<Blob>;
    makeVideoScreenshot: (params: {
      objectUrl: string;
      contentType: MIME.MIMEType;
      logger: LoggerType;
    }) => Promise<Blob>;
    logger: LoggerType;
  }
): Promise<AttachmentType> {
  const { contentType } = attachment;

  const {
    writeNewAttachmentData,
    getAbsoluteAttachmentPath,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions: getImageDimensionsFromURL,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
  } = params;

  if (
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !GoogleChrome.isVideoTypeSupported(contentType)
  ) {
    return attachment;
  }

  // If the attachment hasn't been downloaded yet, we won't have a path
  if (!attachment.path) {
    return attachment;
  }

  const absolutePath = getAbsoluteAttachmentPath(attachment.path);

  if (GoogleChrome.isImageTypeSupported(contentType)) {
    try {
      const { width, height } = await getImageDimensionsFromURL({
        objectUrl: absolutePath,
        logger,
      });
      const thumbnailBuffer = await blobToArrayBuffer(
        await makeImageThumbnail({
          size: THUMBNAIL_SIZE,
          objectUrl: absolutePath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          logger,
        })
      );

      const thumbnailPath = await writeNewAttachmentData(
        new Uint8Array(thumbnailBuffer)
      );
      return {
        ...attachment,
        width,
        height,
        thumbnail: {
          path: thumbnailPath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
        },
      };
    } catch (error) {
      logger.error(
        'captureDimensionsAndScreenshot:',
        'error processing image; skipping screenshot generation',
        toLogFormat(error)
      );
      return attachment;
    }
  }

  let screenshotObjectUrl: string | undefined;
  try {
    const screenshotBuffer = await blobToArrayBuffer(
      await makeVideoScreenshot({
        objectUrl: absolutePath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      })
    );
    screenshotObjectUrl = makeObjectUrl(
      screenshotBuffer,
      THUMBNAIL_CONTENT_TYPE
    );
    const { width, height } = await getImageDimensionsFromURL({
      objectUrl: screenshotObjectUrl,
      logger,
    });
    const screenshotPath = await writeNewAttachmentData(
      new Uint8Array(screenshotBuffer)
    );

    const thumbnailBuffer = await blobToArrayBuffer(
      await makeImageThumbnail({
        size: THUMBNAIL_SIZE,
        objectUrl: screenshotObjectUrl,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      })
    );

    const thumbnailPath = await writeNewAttachmentData(
      new Uint8Array(thumbnailBuffer)
    );

    return {
      ...attachment,
      screenshot: {
        contentType: THUMBNAIL_CONTENT_TYPE,
        path: screenshotPath,
        width,
        height,
      },
      thumbnail: {
        path: thumbnailPath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
      },
      width,
      height,
    };
  } catch (error) {
    logger.error(
      'captureDimensionsAndScreenshot: error processing video; skipping screenshot generation',
      toLogFormat(error)
    );
    return attachment;
  } finally {
    if (screenshotObjectUrl !== undefined) {
      revokeObjectUrl(screenshotObjectUrl);
    }
  }
}

// UI-focused functions

export function getExtensionForDisplay({
  fileName,
  contentType,
}: {
  fileName?: string;
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
    return undefined;
  }

  const slash = contentType.indexOf('/');
  if (slash >= 0) {
    return contentType.slice(slash + 1);
  }

  return undefined;
}

export function isAudio(attachments?: ReadonlyArray<AttachmentType>): boolean {
  return Boolean(
    attachments &&
      attachments[0] &&
      attachments[0].contentType &&
      !attachments[0].isCorrupted &&
      MIME.isAudio(attachments[0].contentType)
  );
}

export function canDisplayImage(
  attachments?: ReadonlyArray<AttachmentType>
): boolean {
  const { height, width } =
    attachments && attachments[0] ? attachments[0] : { height: 0, width: 0 };

  return Boolean(
    height &&
      height > 0 &&
      height <= 4096 &&
      width &&
      width > 0 &&
      width <= 4096
  );
}

export function getThumbnailUrl(
  attachment: AttachmentType
): string | undefined {
  if (attachment.thumbnail) {
    return attachment.thumbnail.url;
  }

  return getUrl(attachment);
}

export function getUrl(attachment: AttachmentType): string | undefined {
  if (attachment.screenshot) {
    return attachment.screenshot.url;
  }

  if (isVideoAttachment(attachment)) {
    return undefined;
  }

  return attachment.url;
}

export function isImage(attachments?: ReadonlyArray<AttachmentType>): boolean {
  return Boolean(
    attachments &&
      attachments[0] &&
      attachments[0].contentType &&
      isImageTypeSupported(attachments[0].contentType)
  );
}

export function isImageAttachment(
  attachment?: Pick<AttachmentType, 'contentType'>
): boolean {
  return Boolean(
    attachment &&
      attachment.contentType &&
      isImageTypeSupported(attachment.contentType)
  );
}

export function canBeTranscoded(
  attachment?: Pick<AttachmentType, 'contentType'>
): boolean {
  return Boolean(
    attachment &&
      isImageAttachment(attachment) &&
      !MIME.isGif(attachment.contentType)
  );
}

export function hasImage(attachments?: ReadonlyArray<AttachmentType>): boolean {
  return Boolean(
    attachments &&
      attachments[0] &&
      (attachments[0].url || attachments[0].pending || attachments[0].blurHash)
  );
}

export function isVideo(attachments?: ReadonlyArray<AttachmentType>): boolean {
  if (!attachments || attachments.length === 0) {
    return false;
  }
  return isVideoAttachment(attachments[0]);
}

export function isVideoAttachment(attachment?: AttachmentType): boolean {
  if (!attachment || !attachment.contentType) {
    return false;
  }
  return isVideoTypeSupported(attachment.contentType);
}

export function isGIF(attachments?: ReadonlyArray<AttachmentType>): boolean {
  if (!attachments || attachments.length !== 1) {
    return false;
  }

  const [attachment] = attachments;

  const flag = SignalService.AttachmentPointer.Flags.GIF;
  const hasFlag =
    // eslint-disable-next-line no-bitwise
    !is.undefined(attachment.flags) && (attachment.flags & flag) === flag;

  return hasFlag && isVideoAttachment(attachment);
}

export function isDownloaded(attachment?: AttachmentType): boolean {
  return Boolean(attachment && (attachment.path || attachment.textAttachment));
}

export function hasNotResolved(attachment?: AttachmentType): boolean {
  return Boolean(attachment && !attachment.url && !attachment.textAttachment);
}

export function isDownloading(attachment?: AttachmentType): boolean {
  return Boolean(attachment && attachment.downloadJobId && attachment.pending);
}

export function hasFailed(attachment?: AttachmentType): boolean {
  return Boolean(attachment && attachment.error);
}

export function hasVideoBlurHash(attachments?: Array<AttachmentType>): boolean {
  const firstAttachment = attachments ? attachments[0] : null;

  return Boolean(firstAttachment && firstAttachment.blurHash);
}

export function hasVideoScreenshot(
  attachments?: Array<AttachmentType>
): string | null | undefined {
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

export function getImageDimensions(
  attachment: Pick<AttachmentType, 'width' | 'height'>,
  forcedWidth?: number
): DimensionsType {
  const { height, width } = attachment;
  if (!height || !width) {
    return {
      height: MIN_HEIGHT,
      width: MIN_WIDTH,
    };
  }

  const aspectRatio = height / width;
  const targetWidth =
    forcedWidth || Math.max(Math.min(MAX_WIDTH, width), MIN_WIDTH);
  const candidateHeight = Math.round(targetWidth * aspectRatio);

  return {
    width: targetWidth,
    height: Math.max(Math.min(MAX_HEIGHT, candidateHeight), MIN_HEIGHT),
  };
}

export function areAllAttachmentsVisual(
  attachments?: ReadonlyArray<AttachmentType>
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
  attachments?: ReadonlyArray<AttachmentType>
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
    // A B
    return {
      height: 150,
      width: 300,
    };
  }

  if (attachments.length === 3) {
    // A A B
    // A A C
    return {
      height: 200,
      width: 300,
    };
  }

  if (attachments.length === 4) {
    // A B
    // C D
    return {
      height: 300,
      width: 300,
    };
  }

  // A A A B B B
  // A A A B B B
  // A A A B B B
  // C C D D E E
  // C C D D E E
  return {
    height: 250,
    width: 300,
  };
}

export function getAlt(
  attachment: AttachmentType,
  i18n: LocalizerType
): string {
  if (isVideoAttachment(attachment)) {
    return i18n('videoAttachmentAlt');
  }
  return i18n('imageAttachmentAlt');
}

// Migration-related attachment stuff

export const isVisualMedia = (attachment: AttachmentType): boolean => {
  const { contentType } = attachment;

  if (is.undefined(contentType)) {
    return false;
  }

  if (isVoiceMessage(attachment)) {
    return false;
  }

  return MIME.isImage(contentType) || MIME.isVideo(contentType);
};

export const isFile = (attachment: AttachmentType): boolean => {
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

export const isVoiceMessage = (attachment: AttachmentType): boolean => {
  const flag = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;
  const hasFlag =
    // eslint-disable-next-line no-bitwise
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

export const save = async ({
  attachment,
  index,
  readAttachmentData,
  saveAttachmentToDisk,
  timestamp,
}: {
  attachment: AttachmentType;
  index?: number;
  readAttachmentData: (relativePath: string) => Promise<Uint8Array>;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
  }) => Promise<{ name: string; fullPath: string } | null>;
  timestamp?: number;
}): Promise<string | null> => {
  let data: Uint8Array;
  if (attachment.path) {
    data = await readAttachmentData(attachment.path);
  } else if (attachment.data) {
    data = attachment.data;
  } else {
    throw new Error('Attachment had neither path nor data');
  }

  const name = getSuggestedFilename({ attachment, timestamp, index });

  const result = await saveAttachmentToDisk({
    data,
    name,
  });

  if (!result) {
    return null;
  }

  return result.fullPath;
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
  const { fileName } = attachment;
  if (fileName && (!isNumber(index) || index === 1)) {
    return fileName;
  }

  const prefix = 'signal';
  const suffix = timestamp
    ? moment(timestamp).format('-YYYY-MM-DD-HHmmss')
    : '';
  const fileType = getFileExtension(attachment);
  const extension = fileType ? `.${fileType}` : '';
  const indexSuffix =
    isNumber(index) && index > 1
      ? `_${padStart(index.toString(), 3, '0')}`
      : '';

  return `${prefix}${suffix}${indexSuffix}${extension}`;
};

export const getFileExtension = (
  attachment: AttachmentType
): string | undefined => {
  if (!attachment.contentType) {
    return undefined;
  }

  switch (attachment.contentType) {
    case 'video/quicktime':
      return 'mov';
    default:
      return attachment.contentType.split('/')[1];
  }
};

const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX = 100 * MEBIBYTE;

export const getMaximumAttachmentSize = (): number => {
  try {
    return parseIntOrThrow(
      getValue('global.attachments.maxBytes'),
      'preProcessAttachment/maxAttachmentSize'
    );
  } catch (error) {
    log.warn(
      'Failed to parse integer out of global.attachments.maxBytes feature flag'
    );
    return DEFAULT_MAX;
  }
};

export const defaultBlurHash = (theme: ThemeType = ThemeType.light): string => {
  if (theme === ThemeType.dark) {
    return 'L05OQnoffQofoffQfQfQfQfQfQfQ';
  }
  return 'L1Q]+w-;fQ-;~qfQfQfQfQfQfQfQ';
};

export const canBeDownloaded = (
  attachment: Pick<AttachmentType, 'key' | 'digest'>
): boolean => {
  return Boolean(attachment.key && attachment.digest);
};
