// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  createAbsolutePathGetter,
  createPlaintextReader,
  createWriterForNew,
  createDoesExist,
  getUnusedFilename,
  readAndDecryptDataFromDisk,
  saveAttachmentToDisk,
  writeNewAttachmentData as doWriteNewAttachmentData,
  createDeleter,
  copyIntoAttachmentsDirectory,
} from '../windows/main/attachments.preload.js';
import {
  getImageDimensions,
  makeImageThumbnail,
  makeObjectUrl,
  makeVideoScreenshot,
  revokeObjectUrl,
} from '../types/VisualAttachment.dom.js';
import { loadData } from './Attachment.std.js';
import {
  loadContactData as doLoadContactData,
  loadPreviewData as doLoadPreviewData,
  loadQuoteData as doLoadQuoteData,
  loadStickerData as doLoadStickerData,
  processNewAttachment as doProcessNewAttachment,
  processNewSticker as doProcessNewSticker,
  deleteAllExternalFiles,
  createAttachmentLoader,
  upgradeSchema,
} from '../types/Message2.preload.js';
import type {
  AttachmentType,
  AddressableAttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment.std.js';
import type { MessageAttachmentType } from '../types/AttachmentDownload.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import { createLogger } from '../logging/log.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import {
  ATTACHMENTS_PATH,
  STICKERS_PATH,
  BADGES_PATH,
  DRAFT_PATH,
  TEMP_PATH,
  AVATARS_PATH,
  DOWNLOADS_PATH,
} from './basePaths.preload.js';

const logger = createLogger('migrations');

type EncryptedReader = (
  attachment: Partial<AddressableAttachmentType>
) => Promise<Uint8Array>;

type EncryptedWriter = (data: Uint8Array) => Promise<LocalAttachmentV2Type>;

function createEncryptedReader(basePath: string): EncryptedReader {
  const fallbackReader = createPlaintextReader(basePath);
  const pathGetter = createAbsolutePathGetter(basePath);

  return async (
    attachment: Partial<AddressableAttachmentType>
  ): Promise<Uint8Array> => {
    // In-memory
    if (attachment.data != null) {
      return attachment.data;
    }

    if (attachment.path == null) {
      throw new Error('Attachment was not downloaded yet');
    }

    if (attachment.version !== 2) {
      return fallbackReader(attachment.path);
    }

    if (attachment.localKey == null || attachment.size == null) {
      throw new Error('Failed to decrypt v2 attachment');
    }

    const absolutePath = pathGetter(attachment.path);

    return readAndDecryptDataFromDisk({
      absolutePath,
      keysBase64: attachment.localKey,
      size: attachment.size,
    });
  };
}

function createEncryptedWriterForNew(basePath: string): EncryptedWriter {
  const pathGetter = createAbsolutePathGetter(basePath);

  return data =>
    doWriteNewAttachmentData({
      data,
      getAbsoluteAttachmentPath: pathGetter,
    });
}

export const readAttachmentData = createEncryptedReader(ATTACHMENTS_PATH);
export const loadAttachmentData = loadData(readAttachmentData);
export const loadContactData = doLoadContactData(loadAttachmentData);
export const loadPreviewData = doLoadPreviewData(loadAttachmentData);
export const loadQuoteData = doLoadQuoteData(loadAttachmentData);
export const loadStickerData = doLoadStickerData(loadAttachmentData);
export const getAbsoluteAttachmentPath =
  createAbsolutePathGetter(ATTACHMENTS_PATH);
export const deleteAttachmentData = createDeleter(ATTACHMENTS_PATH);
export const writeNewAttachmentData =
  createEncryptedWriterForNew(ATTACHMENTS_PATH);
export const doesAttachmentExist = createDoesExist(ATTACHMENTS_PATH);

export const getAbsoluteStickerPath = createAbsolutePathGetter(STICKERS_PATH);
export const writeNewStickerData = createEncryptedWriterForNew(STICKERS_PATH);
export const deleteSticker = createDeleter(STICKERS_PATH);
export const readStickerData = createEncryptedReader(STICKERS_PATH);
export const copyStickerIntoAttachmentsDirectory = copyIntoAttachmentsDirectory(
  {
    sourceDir: STICKERS_PATH,
    targetDir: ATTACHMENTS_PATH,
  }
);

export const getAbsoluteBadgeImageFilePath =
  createAbsolutePathGetter(BADGES_PATH);
export const writeNewBadgeImageFileData = createWriterForNew(
  BADGES_PATH,
  '.svg'
);

export const getAbsoluteTempPath = createAbsolutePathGetter(TEMP_PATH);
const writeNewTempData = createEncryptedWriterForNew(TEMP_PATH);
export const writeNewPlaintextTempData = createWriterForNew(TEMP_PATH);
export const deleteTempFile = createDeleter(TEMP_PATH);
export const readTempData = createEncryptedReader(TEMP_PATH);
export const copyAttachmentIntoTempDirectory = copyIntoAttachmentsDirectory({
  sourceDir: ATTACHMENTS_PATH,
  targetDir: TEMP_PATH,
});

export const getAbsoluteDraftPath = createAbsolutePathGetter(DRAFT_PATH);
export const writeNewDraftData = createEncryptedWriterForNew(DRAFT_PATH);
export const deleteDraftFile = createDeleter(DRAFT_PATH);
export const readDraftData = createEncryptedReader(DRAFT_PATH);

export const getAbsoluteDownloadsPath =
  createAbsolutePathGetter(DOWNLOADS_PATH);
export const deleteDownloadData = createDeleter(DOWNLOADS_PATH);

export const readAvatarData = createEncryptedReader(AVATARS_PATH);
export const getAbsoluteAvatarPath = createAbsolutePathGetter(AVATARS_PATH);
export const writeNewAvatarData = createEncryptedWriterForNew(AVATARS_PATH);
export const deleteAvatar = createDeleter(AVATARS_PATH);

export const deleteExternalMessageFiles = deleteAllExternalFiles({
  deleteAttachmentOnDisk: deleteAttachmentData,
  deleteDownloadOnDisk: deleteDownloadData,
});
export const loadMessage = createAttachmentLoader(loadAttachmentData);

export const processNewAttachment = (
  attachment: AttachmentType,
  attachmentType: MessageAttachmentType
): ReturnType<typeof doProcessNewAttachment> =>
  doProcessNewAttachment(attachment, attachmentType, {
    writeNewAttachmentData,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
  });
export const processNewSticker = (
  stickerData: Uint8Array
): ReturnType<typeof doProcessNewSticker> =>
  doProcessNewSticker(stickerData, false, {
    writeNewStickerData,
    getImageDimensions,
    logger,
  });
export const processNewEphemeralSticker = (
  stickerData: Uint8Array
): ReturnType<typeof doProcessNewSticker> =>
  doProcessNewSticker(stickerData, true, {
    writeNewStickerData: writeNewTempData,
    getImageDimensions,
    logger,
  });

export const upgradeMessageSchema = (
  message: MessageAttributesType,
  options: { maxVersion?: number } = {}
): Promise<MessageAttributesType> => {
  const { maxVersion } = options;

  return upgradeSchema(message, {
    deleteAttachmentOnDisk: deleteAttachmentData,
    doesAttachmentExist,
    getImageDimensions,
    getRegionCode: () => itemStorage.get('regionCode'),
    makeImageThumbnail,
    makeObjectUrl,
    makeVideoScreenshot,
    readAttachmentData,
    revokeObjectUrl,
    writeNewAttachmentData,
    writeNewStickerData,
    logger,
    maxVersion,
  });
};

export { getUnusedFilename, saveAttachmentToDisk };
