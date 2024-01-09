// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The idea with this file is to make it webpackable for the style guide

import * as Crypto from './Crypto';
import * as Curve from './Curve';
import { start as conversationControllerStart } from './ConversationController';
import Data from './sql/Client';
import * as Groups from './groups';
import OS from './util/os/osMain';
import * as RemoteConfig from './RemoteConfig';

// Components
import { ConfirmationDialog } from './components/ConfirmationDialog';

// State
import { createApp } from './state/roots/createApp';
import { createSafetyNumberViewer } from './state/roots/createSafetyNumberViewer';

// Types
import * as TypesAttachment from './types/Attachment';
import * as VisualAttachment from './types/VisualAttachment';
import * as MessageType from './types/Message2';
import { Address } from './types/Address';
import { QualifiedAddress } from './types/QualifiedAddress';

// Processes / Services
import { initializeGroupCredentialFetcher } from './services/groupCredentialFetcher';
import { initializeNetworkObserver } from './services/networkObserver';
import { initializeUpdateListener } from './services/updateListener';
import { calling } from './services/calling';
import * as storage from './services/storage';

import type { LoggerType } from './types/Logging';
import type {
  AttachmentType,
  AttachmentWithHydratedData,
} from './types/Attachment';
import type { MessageAttributesType, QuotedMessageType } from './model-types.d';
import type { SignalCoreType } from './window.d';
import type {
  EmbeddedContactType,
  EmbeddedContactWithHydratedAvatar,
} from './types/EmbeddedContact';
import type {
  LinkPreviewType,
  LinkPreviewWithHydratedData,
} from './types/message/LinkPreviews';
import type { StickerType, StickerWithHydratedData } from './types/Stickers';

type MigrationsModuleType = {
  attachmentsPath: string;
  copyIntoAttachmentsDirectory: (
    path: string
  ) => Promise<{ path: string; size: number }>;
  copyIntoTempDirectory: (
    path: string
  ) => Promise<{ path: string; size: number }>;
  deleteAttachmentData: (path: string) => Promise<void>;
  deleteAvatar: (path: string) => Promise<void>;
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
  getAbsoluteDraftPath: (path: string) => string;
  getAbsoluteStickerPath: (path: string) => string;
  getAbsoluteTempPath: (path: string) => string;
  loadAttachmentData: (
    attachment: Pick<AttachmentType, 'data' | 'path'>
  ) => Promise<AttachmentWithHydratedData>;
  loadContactData: (
    contact: Array<EmbeddedContactType> | undefined
  ) => Promise<Array<EmbeddedContactWithHydratedAvatar> | undefined>;
  loadMessage: (
    message: MessageAttributesType
  ) => Promise<MessageAttributesType>;
  loadPreviewData: (
    preview: Array<LinkPreviewType> | undefined
  ) => Promise<Array<LinkPreviewWithHydratedData>>;
  loadQuoteData: (
    quote: QuotedMessageType | null | undefined
  ) => Promise<QuotedMessageType | null>;
  loadStickerData: (
    sticker: StickerType | undefined
  ) => Promise<StickerWithHydratedData | undefined>;
  readAttachmentData: (path: string) => Promise<Uint8Array>;
  readDraftData: (path: string) => Promise<Uint8Array>;
  readStickerData: (path: string) => Promise<Uint8Array>;
  readTempData: (path: string) => Promise<Uint8Array>;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
  }) => Promise<null | { fullPath: string; name: string }>;
  processNewAttachment: (attachment: AttachmentType) => Promise<AttachmentType>;
  processNewSticker: (stickerData: Uint8Array) => Promise<{
    path: string;
    width: number;
    height: number;
  }>;
  processNewEphemeralSticker: (stickerData: Uint8Array) => Promise<{
    path: string;
    width: number;
    height: number;
  }>;
  upgradeMessageSchema: (
    attributes: MessageAttributesType,
    options?: { maxVersion?: number; keepOnDisk?: boolean }
  ) => Promise<MessageAttributesType>;
  writeMessageAttachments: (
    message: MessageAttributesType
  ) => Promise<MessageAttributesType>;
  writeNewAttachmentData: (data: Uint8Array) => Promise<string>;
  writeNewDraftData: (data: Uint8Array) => Promise<string>;
  writeNewAvatarData: (data: Uint8Array) => Promise<string>;
  writeNewBadgeImageFileData: (data: Uint8Array) => Promise<string>;
  writeNewTempData: (data: Uint8Array) => Promise<string>;
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
    createReader,
    createWriterForExisting,
    createWriterForNew,
    createDoesExist,
    getAvatarsPath,
    getDraftPath,
    getPath,
    getStickersPath,
    getBadgesPath,
    getTempPath,
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
  const readAttachmentData = createReader(attachmentsPath);
  const loadAttachmentData = Type.loadData(readAttachmentData);
  const loadContactData = MessageType.loadContactData(loadAttachmentData);
  const loadPreviewData = MessageType.loadPreviewData(loadAttachmentData);
  const loadQuoteData = MessageType.loadQuoteData(loadAttachmentData);
  const loadStickerData = MessageType.loadStickerData(loadAttachmentData);
  const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  const deleteOnDisk = Attachments.createDeleter(attachmentsPath);
  const writeExistingAttachmentData = createWriterForExisting(attachmentsPath);
  const writeNewAttachmentData = createWriterForNew(attachmentsPath);
  const copyIntoAttachmentsDirectory =
    Attachments.copyIntoAttachmentsDirectory(attachmentsPath);
  const doesAttachmentExist = createDoesExist(attachmentsPath);

  const stickersPath = getStickersPath(userDataPath);
  const writeNewStickerData = createWriterForNew(stickersPath);
  const getAbsoluteStickerPath = createAbsolutePathGetter(stickersPath);
  const deleteSticker = Attachments.createDeleter(stickersPath);
  const readStickerData = createReader(stickersPath);

  const badgesPath = getBadgesPath(userDataPath);
  const getAbsoluteBadgeImageFilePath = createAbsolutePathGetter(badgesPath);
  const writeNewBadgeImageFileData = createWriterForNew(badgesPath, '.svg');

  const tempPath = getTempPath(userDataPath);
  const getAbsoluteTempPath = createAbsolutePathGetter(tempPath);
  const writeNewTempData = createWriterForNew(tempPath);
  const deleteTempFile = Attachments.createDeleter(tempPath);
  const readTempData = createReader(tempPath);
  const copyIntoTempDirectory =
    Attachments.copyIntoAttachmentsDirectory(tempPath);

  const draftPath = getDraftPath(userDataPath);
  const getAbsoluteDraftPath = createAbsolutePathGetter(draftPath);
  const writeNewDraftData = createWriterForNew(draftPath);
  const deleteDraftFile = Attachments.createDeleter(draftPath);
  const readDraftData = createReader(draftPath);

  const avatarsPath = getAvatarsPath(userDataPath);
  const getAbsoluteAvatarPath = createAbsolutePathGetter(avatarsPath);
  const writeNewAvatarData = createWriterForNew(avatarsPath);
  const deleteAvatar = Attachments.createDeleter(avatarsPath);

  return {
    attachmentsPath,
    copyIntoAttachmentsDirectory,
    copyIntoTempDirectory,
    deleteAttachmentData: deleteOnDisk,
    deleteAvatar,
    deleteDraftFile,
    deleteExternalMessageFiles: MessageType.deleteAllExternalFiles({
      deleteAttachmentData: Type.deleteData(deleteOnDisk),
      deleteOnDisk,
    }),
    deleteSticker,
    deleteTempFile,
    doesAttachmentExist,
    getAbsoluteAttachmentPath,
    getAbsoluteAvatarPath,
    getAbsoluteBadgeImageFilePath,
    getAbsoluteDraftPath,
    getAbsoluteStickerPath,
    getAbsoluteTempPath,
    loadAttachmentData,
    loadContactData,
    loadMessage: MessageType.createAttachmentLoader(loadAttachmentData),
    loadPreviewData,
    loadQuoteData,
    loadStickerData,
    readAttachmentData,
    readDraftData,
    readStickerData,
    readTempData,
    saveAttachmentToDisk,
    processNewAttachment: (attachment: AttachmentType) =>
      MessageType.processNewAttachment(attachment, {
        writeNewAttachmentData,
        getAbsoluteAttachmentPath,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        deleteOnDisk,
        logger,
      }),
    processNewSticker: (stickerData: Uint8Array) =>
      MessageType.processNewSticker(stickerData, {
        writeNewStickerData,
        getAbsoluteStickerPath,
        getImageDimensions,
        logger,
      }),
    processNewEphemeralSticker: (stickerData: Uint8Array) =>
      MessageType.processNewSticker(stickerData, {
        writeNewStickerData: writeNewTempData,
        getAbsoluteStickerPath: getAbsoluteTempPath,
        getImageDimensions,
        logger,
      }),
    upgradeMessageSchema: (
      message: MessageAttributesType,
      options: { maxVersion?: number; keepOnDisk?: boolean } = {}
    ) => {
      const { maxVersion, keepOnDisk } = options;

      return MessageType.upgradeSchema(message, {
        deleteOnDisk,
        getAbsoluteAttachmentPath,
        getAbsoluteStickerPath,
        getImageDimensions,
        getRegionCode,
        makeImageThumbnail,
        makeObjectUrl,
        makeVideoScreenshot,
        revokeObjectUrl,
        writeNewAttachmentData,
        writeNewStickerData,

        keepOnDisk,
        logger,
        maxVersion,
      });
    },
    writeMessageAttachments: MessageType.createAttachmentDataWriter({
      writeExistingAttachmentData,
      logger,
    }),
    writeNewAttachmentData: createWriterForNew(attachmentsPath),
    writeNewAvatarData,
    writeNewDraftData,
    writeNewBadgeImageFileData,
    writeNewTempData,
  };
}

type StringGetterType = (basePath: string) => string;

type AttachmentsModuleType = {
  getAvatarsPath: StringGetterType;
  getBadgesPath: StringGetterType;
  getDraftPath: StringGetterType;
  getPath: StringGetterType;
  getStickersPath: StringGetterType;
  getTempPath: StringGetterType;
  getUpdateCachePath: StringGetterType;

  createDeleter: (root: string) => (relativePath: string) => Promise<void>;

  createReader: (root: string) => (relativePath: string) => Promise<Uint8Array>;
  getRelativePath: (name: string) => string;
  createName: (suffix?: string) => string;

  copyIntoAttachmentsDirectory: (
    root: string
  ) => (sourcePath: string) => Promise<{ path: string; size: number }>;

  createWriterForNew: (
    root: string,
    suffix?: string
  ) => (bytes: Uint8Array) => Promise<string>;

  createWriterForExisting: (
    root: string
  ) => (options: { data?: Uint8Array; path?: string }) => Promise<string>;

  createAbsolutePathGetter: (
    rootPath: string
  ) => (relativePath: string) => string;

  createDoesExist: (root: string) => (relativePath: string) => Promise<boolean>;
  saveAttachmentToDisk: ({
    data,
    name,
  }: {
    data: Uint8Array;
    name: string;
  }) => Promise<null | { fullPath: string; name: string }>;
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

  const Components = {
    ConfirmationDialog,
  };

  const Roots = {
    createApp,
    createSafetyNumberViewer,
  };

  const Services = {
    calling,
    initializeGroupCredentialFetcher,
    initializeNetworkObserver,
    initializeUpdateListener,

    // Testing
    storage,
  };

  const State = {
    Roots,
  };

  const Types = {
    Message: MessageType,

    // Mostly for debugging
    Address,
    QualifiedAddress,
  };

  return {
    Components,
    Crypto,
    Curve,
    // Note: used in test/index.html, and not type-checked!
    conversationControllerStart,
    Data,
    Groups,
    Migrations,
    OS,
    RemoteConfig,
    Services,
    State,
    Types,
  };
};
