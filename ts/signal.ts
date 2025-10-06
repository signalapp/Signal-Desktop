// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The idea with this file is to make it webpackable for the style guide

import type { ReadonlyDeep } from 'type-fest';

import OS from './util/os/osMain.js';
import { isProduction } from './util/version.js';
import { DataReader, DataWriter } from './sql/Client.js';

// Types
import * as TypesAttachment from './types/Attachment.js';
import * as VisualAttachment from './types/VisualAttachment.js';
import * as MessageType from './types/Message2.js';
import { Address } from './types/Address.js';
import { QualifiedAddress } from './types/QualifiedAddress.js';

// Processes / Services
import { calling } from './services/calling.js';
import * as storage from './services/storage.js';
import { backupsService } from './services/backups/index.js';
import * as donations from './services/donations.js';

import type { LoggerType } from './types/Logging.js';
import type {
  AttachmentType,
  AttachmentWithHydratedData,
  AddressableAttachmentType,
  LocalAttachmentV2Type,
} from './types/Attachment.js';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from './model-types.d.ts';
import type { SignalCoreType } from './window.d.ts';
import type {
  EmbeddedContactType,
  EmbeddedContactWithHydratedAvatar,
} from './types/EmbeddedContact.js';
import type {
  LinkPreviewType,
  LinkPreviewWithHydratedData,
} from './types/message/LinkPreviews.js';
import type { StickerType, StickerWithHydratedData } from './types/Stickers.js';
import type { MessageAttachmentType } from './types/AttachmentDownload.js';

type EncryptedReader = (
  attachment: Partial<AddressableAttachmentType>
) => Promise<Uint8Array>;

type EncryptedWriter = (data: Uint8Array) => Promise<LocalAttachmentV2Type>;

type MigrationsModuleType = {
  attachmentsPath: string;
  copyStickerIntoAttachmentsDirectory: (
    path: string
  ) => Promise<{ path: string; size: number }>;
  copyAttachmentIntoTempDirectory: (
    path: string
  ) => Promise<{ path: string; size: number }>;
  deleteAttachmentData: (path: string) => Promise<void>;
  deleteAvatar: (path: string) => Promise<void>;
  deleteDownloadData: (path: string) => Promise<void>;
  deleteDraftFile: (path: string) => Promise<void>;
  deleteExternalMessageFiles: (
    attributes: MessageAttributesType
  ) => Promise<void>;
  deleteSticker: (path: string) => Promise<void>;
  deleteTempFile: (path: string) => Promise<void>;
  doesAttachmentExist: (path: string) => Promise<boolean>;
  getAbsoluteAttachmentPath: (path: string) => string;
  getAbsoluteAvatarPath: (src: string) => string;
  getAbsoluteBadgeImageFilePath: (path: string) => string;
  getAbsoluteDownloadsPath: (path: string) => string;
  getAbsoluteDraftPath: (path: string) => string;
  getAbsoluteStickerPath: (path: string) => string;
  getAbsoluteTempPath: (path: string) => string;
  getUnusedFilename: (options: {
    filename: string;
    baseDir?: string;
  }) => string;
  loadAttachmentData: (
    attachment: Partial<AttachmentType>
  ) => Promise<AttachmentWithHydratedData>;
  loadContactData: (
    contact: ReadonlyArray<ReadonlyDeep<EmbeddedContactType>> | undefined
  ) => Promise<Array<EmbeddedContactWithHydratedAvatar> | undefined>;
  loadMessage: (
    message: MessageAttributesType
  ) => Promise<MessageAttributesType>;
  loadPreviewData: (
    preview: ReadonlyArray<ReadonlyDeep<LinkPreviewType>> | undefined
  ) => Promise<Array<LinkPreviewWithHydratedData>>;
  loadQuoteData: (
    quote: QuotedMessageType | null | undefined
  ) => Promise<QuotedMessageType | null>;
  loadStickerData: (
    sticker: StickerType | undefined
  ) => Promise<StickerWithHydratedData | undefined>;
  readAttachmentData: EncryptedReader;
  readAvatarData: EncryptedReader;
  readDraftData: EncryptedReader;
  readStickerData: EncryptedReader;
  readTempData: EncryptedReader;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
    baseDir?: string;
  }) => Promise<null | { fullPath: string; name: string }>;
  processNewAttachment: (
    attachment: AttachmentType,
    attachmentType: MessageAttachmentType
  ) => Promise<AttachmentType>;
  processNewSticker: (stickerData: Uint8Array) => Promise<
    LocalAttachmentV2Type & {
      width: number;
      height: number;
    }
  >;
  processNewEphemeralSticker: (stickerData: Uint8Array) => Promise<
    LocalAttachmentV2Type & {
      width: number;
      height: number;
    }
  >;
  upgradeMessageSchema: (
    attributes: MessageAttributesType,
    options?: { maxVersion?: number }
  ) => Promise<MessageAttributesType>;
  writeNewAttachmentData: EncryptedWriter;
  writeNewDraftData: EncryptedWriter;
  writeNewAvatarData: EncryptedWriter;
  writeNewStickerData: EncryptedWriter;
  writeNewBadgeImageFileData: (data: Uint8Array) => Promise<string>;
  writeNewPlaintextTempData: (data: Uint8Array) => Promise<string>;
};

export function initializeMigrations({
  getRegionCode,
  Attachments,
  Type,
  VisualType,
  logger,
  userDataPath,
}: {
  getRegionCode: () => string | undefined;
  Attachments: AttachmentsModuleType;
  Type: typeof TypesAttachment;
  VisualType: typeof VisualAttachment;
  logger: LoggerType;
  userDataPath: string;
}): MigrationsModuleType {
  if (!Attachments) {
    throw new Error('initializeMigrations: Missing provided attachments!');
  }
  const {
    createAbsolutePathGetter,
    createPlaintextReader,
    createWriterForNew,
    createDoesExist,
    getAvatarsPath,
    getDraftPath,
    getDownloadsPath,
    getPath,
    getStickersPath,
    getBadgesPath,
    getTempPath,
    getUnusedFilename,
    readAndDecryptDataFromDisk,
    saveAttachmentToDisk,
  } = Attachments;
  const {
    getImageDimensions,
    makeImageThumbnail,
    makeObjectUrl,
    makeVideoScreenshot,
    revokeObjectUrl,
  } = VisualType;

  const attachmentsPath = getPath(userDataPath);

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
      Attachments.writeNewAttachmentData({
        data,
        getAbsoluteAttachmentPath: pathGetter,
      });
  }

  const readAttachmentData = createEncryptedReader(attachmentsPath);
  const loadAttachmentData = Type.loadData(readAttachmentData);
  const loadContactData = MessageType.loadContactData(loadAttachmentData);
  const loadPreviewData = MessageType.loadPreviewData(loadAttachmentData);
  const loadQuoteData = MessageType.loadQuoteData(loadAttachmentData);
  const loadStickerData = MessageType.loadStickerData(loadAttachmentData);
  const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  const deleteAttachmentOnDisk = Attachments.createDeleter(attachmentsPath);
  const writeNewAttachmentData = createEncryptedWriterForNew(attachmentsPath);
  const doesAttachmentExist = createDoesExist(attachmentsPath);

  const stickersPath = getStickersPath(userDataPath);
  const getAbsoluteStickerPath = createAbsolutePathGetter(stickersPath);
  const writeNewStickerData = createEncryptedWriterForNew(stickersPath);
  const deleteSticker = Attachments.createDeleter(stickersPath);
  const readStickerData = createEncryptedReader(stickersPath);
  const copyStickerIntoAttachmentsDirectory =
    Attachments.copyIntoAttachmentsDirectory({
      sourceDir: stickersPath,
      targetDir: attachmentsPath,
    });

  const badgesPath = getBadgesPath(userDataPath);
  const getAbsoluteBadgeImageFilePath = createAbsolutePathGetter(badgesPath);
  const writeNewBadgeImageFileData = createWriterForNew(badgesPath, '.svg');

  const tempPath = getTempPath(userDataPath);
  const getAbsoluteTempPath = createAbsolutePathGetter(tempPath);
  const writeNewTempData = createEncryptedWriterForNew(tempPath);
  const writeNewPlaintextTempData = createWriterForNew(tempPath);
  const deleteTempFile = Attachments.createDeleter(tempPath);
  const readTempData = createEncryptedReader(tempPath);
  const copyAttachmentIntoTempDirectory =
    Attachments.copyIntoAttachmentsDirectory({
      sourceDir: attachmentsPath,
      targetDir: tempPath,
    });

  const draftPath = getDraftPath(userDataPath);
  const getAbsoluteDraftPath = createAbsolutePathGetter(draftPath);
  const writeNewDraftData = createEncryptedWriterForNew(draftPath);
  const deleteDraftFile = Attachments.createDeleter(draftPath);
  const readDraftData = createEncryptedReader(draftPath);

  const downloadsPath = getDownloadsPath(userDataPath);
  const getAbsoluteDownloadsPath = createAbsolutePathGetter(downloadsPath);
  const deleteDownloadOnDisk = Attachments.createDeleter(downloadsPath);

  const avatarsPath = getAvatarsPath(userDataPath);
  const readAvatarData = createEncryptedReader(avatarsPath);
  const getAbsoluteAvatarPath = createAbsolutePathGetter(avatarsPath);
  const writeNewAvatarData = createEncryptedWriterForNew(avatarsPath);
  const deleteAvatar = Attachments.createDeleter(avatarsPath);

  return {
    attachmentsPath,
    copyStickerIntoAttachmentsDirectory,
    copyAttachmentIntoTempDirectory,
    deleteAttachmentData: deleteAttachmentOnDisk,
    deleteAvatar,
    deleteDownloadData: deleteDownloadOnDisk,
    deleteDraftFile,
    deleteExternalMessageFiles: MessageType.deleteAllExternalFiles({
      deleteAttachmentOnDisk,
      deleteDownloadOnDisk,
    }),
    deleteSticker,
    deleteTempFile,
    doesAttachmentExist,
    getAbsoluteAttachmentPath,
    getAbsoluteAvatarPath,
    getAbsoluteBadgeImageFilePath,
    getAbsoluteDownloadsPath,
    getAbsoluteDraftPath,
    getAbsoluteStickerPath,
    getAbsoluteTempPath,
    getUnusedFilename,
    loadAttachmentData,
    loadContactData,
    loadMessage: MessageType.createAttachmentLoader(loadAttachmentData),
    loadPreviewData,
    loadQuoteData,
    loadStickerData,
    readAttachmentData,
    readAvatarData,
    readDraftData,
    readStickerData,
    readTempData,
    saveAttachmentToDisk,
    processNewAttachment: (
      attachment: AttachmentType,
      attachmentType: MessageAttachmentType
    ) =>
      MessageType.processNewAttachment(attachment, attachmentType, {
        writeNewAttachmentData,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        logger,
      }),
    processNewSticker: (stickerData: Uint8Array) =>
      MessageType.processNewSticker(stickerData, false, {
        writeNewStickerData,
        getImageDimensions,
        logger,
      }),
    processNewEphemeralSticker: (stickerData: Uint8Array) =>
      MessageType.processNewSticker(stickerData, true, {
        writeNewStickerData: writeNewTempData,
        getImageDimensions,
        logger,
      }),
    upgradeMessageSchema: (
      message: MessageAttributesType,
      options: { maxVersion?: number } = {}
    ) => {
      const { maxVersion } = options;

      return MessageType.upgradeSchema(message, {
        deleteAttachmentOnDisk,
        doesAttachmentExist,
        getImageDimensions,
        getRegionCode,
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
    },
    writeNewAttachmentData,
    writeNewAvatarData,
    writeNewDraftData,
    writeNewBadgeImageFileData,
    writeNewPlaintextTempData,
    writeNewStickerData,
  };
}

type StringGetterType = (basePath: string) => string;

type AttachmentsModuleType = {
  getAvatarsPath: StringGetterType;
  getBadgesPath: StringGetterType;
  getDownloadsPath: StringGetterType;
  getDraftPath: StringGetterType;
  getPath: StringGetterType;
  getStickersPath: StringGetterType;
  getTempPath: StringGetterType;
  getUpdateCachePath: StringGetterType;

  createDeleter: (root: string) => (relativePath: string) => Promise<void>;

  createPlaintextReader: (
    root: string
  ) => (relativePath: string) => Promise<Uint8Array>;

  copyIntoAttachmentsDirectory: (options: {
    sourceDir: string;
    targetDir: string;
  }) => (sourcePath: string) => Promise<{ path: string; size: number }>;

  createWriterForNew: (
    root: string,
    suffix?: string
  ) => (bytes: Uint8Array) => Promise<string>;

  createAbsolutePathGetter: (
    rootPath: string
  ) => (relativePath: string) => string;

  createDoesExist: (root: string) => (relativePath: string) => Promise<boolean>;
  getUnusedFilename: (options: {
    filename: string;
    baseDir?: string;
  }) => string;
  saveAttachmentToDisk: ({
    data,
    name,
    dirName,
  }: {
    data: Uint8Array;
    name: string;
    dirName?: string;
  }) => Promise<null | { fullPath: string; name: string }>;

  readAndDecryptDataFromDisk: (options: {
    absolutePath: string;
    keysBase64: string;
    size: number;
  }) => Promise<Uint8Array>;

  writeNewAttachmentData: (options: {
    data: Uint8Array;
    getAbsoluteAttachmentPath: (relativePath: string) => string;
  }) => Promise<LocalAttachmentV2Type>;
};

export const setup = (options: {
  Attachments: AttachmentsModuleType;
  getRegionCode: () => string | undefined;
  logger: LoggerType;
  userDataPath: string;
}): SignalCoreType => {
  const { Attachments, getRegionCode, logger, userDataPath } = options;

  const Migrations = initializeMigrations({
    getRegionCode,
    Attachments,
    Type: TypesAttachment,
    VisualType: VisualAttachment,
    logger,
    userDataPath,
  });

  // Only for testing
  const Services = {
    storage,
    calling,
    donations,
    backups: backupsService,
  };

  const Types = {
    Message: MessageType,

    // Mostly for debugging
    Address,
    QualifiedAddress,
  };

  return {
    Migrations,
    OS,
    Services,
    Types,

    ...(isProduction(window.getVersion())
      ? {}
      : {
          DataReader,
          DataWriter,
        }),
  };
};
