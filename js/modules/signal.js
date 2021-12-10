// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The idea with this file is to make it webpackable for the style guide

const Backbone = require('../../ts/backbone');
const Crypto = require('../../ts/Crypto');
const Curve = require('../../ts/Curve');
const {
  start: conversationControllerStart,
} = require('../../ts/ConversationController');
const Data = require('../../ts/sql/Client').default;
const EmojiLib = require('../../ts/components/emoji/lib');
const Groups = require('../../ts/groups');
const GroupChange = require('../../ts/groupChange');
const IndexedDB = require('./indexeddb');
const OS = require('../../ts/OS');
const Stickers = require('../../ts/types/Stickers');
const Settings = require('./settings');
const RemoteConfig = require('../../ts/RemoteConfig');
const Util = require('../../ts/util');

// Components
const {
  AttachmentList,
} = require('../../ts/components/conversation/AttachmentList');
const { ChatColorPicker } = require('../../ts/components/ChatColorPicker');
const {
  ConfirmationDialog,
} = require('../../ts/components/ConfirmationDialog');
const {
  ContactDetail,
} = require('../../ts/components/conversation/ContactDetail');
const {
  ContactModal,
} = require('../../ts/components/conversation/ContactModal');
const { Emojify } = require('../../ts/components/conversation/Emojify');
const { ErrorModal } = require('../../ts/components/ErrorModal');
const { Lightbox } = require('../../ts/components/Lightbox');
const {
  MediaGallery,
} = require('../../ts/components/conversation/media-gallery/MediaGallery');
const {
  MessageDetail,
} = require('../../ts/components/conversation/MessageDetail');
const { Quote } = require('../../ts/components/conversation/Quote');
const { ProgressModal } = require('../../ts/components/ProgressModal');
const {
  StagedLinkPreview,
} = require('../../ts/components/conversation/StagedLinkPreview');
const {
  DisappearingTimeDialog,
} = require('../../ts/components/DisappearingTimeDialog');
const {
  SystemTraySettingsCheckboxes,
} = require('../../ts/components/conversation/SystemTraySettingsCheckboxes');
const { WhatsNewLink } = require('../../ts/components/WhatsNewLink');

// State
const {
  createChatColorPicker,
} = require('../../ts/state/roots/createChatColorPicker');
const {
  createConversationDetails,
} = require('../../ts/state/roots/createConversationDetails');
const { createApp } = require('../../ts/state/roots/createApp');
const {
  createForwardMessageModal,
} = require('../../ts/state/roots/createForwardMessageModal');
const {
  createGroupLinkManagement,
} = require('../../ts/state/roots/createGroupLinkManagement');
const {
  createGroupV1MigrationModal,
} = require('../../ts/state/roots/createGroupV1MigrationModal');
const {
  createGroupV2JoinModal,
} = require('../../ts/state/roots/createGroupV2JoinModal');
const { createLeftPane } = require('../../ts/state/roots/createLeftPane');
const {
  createMessageDetail,
} = require('../../ts/state/roots/createMessageDetail');
const {
  createConversationNotificationsSettings,
} = require('../../ts/state/roots/createConversationNotificationsSettings');
const {
  createGroupV2Permissions,
} = require('../../ts/state/roots/createGroupV2Permissions');
const {
  createPendingInvites,
} = require('../../ts/state/roots/createPendingInvites');
const {
  createSafetyNumberViewer,
} = require('../../ts/state/roots/createSafetyNumberViewer');
const {
  createStickerManager,
} = require('../../ts/state/roots/createStickerManager');
const {
  createStickerPreviewModal,
} = require('../../ts/state/roots/createStickerPreviewModal');
const {
  createShortcutGuideModal,
} = require('../../ts/state/roots/createShortcutGuideModal');

const { createStore } = require('../../ts/state/createStore');
const appDuck = require('../../ts/state/ducks/app');
const callingDuck = require('../../ts/state/ducks/calling');
const conversationsDuck = require('../../ts/state/ducks/conversations');
const emojisDuck = require('../../ts/state/ducks/emojis');
const expirationDuck = require('../../ts/state/ducks/expiration');
const itemsDuck = require('../../ts/state/ducks/items');
const linkPreviewsDuck = require('../../ts/state/ducks/linkPreviews');
const networkDuck = require('../../ts/state/ducks/network');
const searchDuck = require('../../ts/state/ducks/search');
const stickersDuck = require('../../ts/state/ducks/stickers');
const updatesDuck = require('../../ts/state/ducks/updates');
const userDuck = require('../../ts/state/ducks/user');

const conversationsSelectors = require('../../ts/state/selectors/conversations');
const searchSelectors = require('../../ts/state/selectors/search');

// Types
const AttachmentType = require('../../ts/types/Attachment');
const VisualAttachment = require('../../ts/types/VisualAttachment');
const MessageType = require('./types/message');
const { UUID } = require('../../ts/types/UUID');
const { Address } = require('../../ts/types/Address');
const { QualifiedAddress } = require('../../ts/types/QualifiedAddress');

// Views
const Initialization = require('./views/initialization');

// Workflow
const MessageDataMigrator = require('./messages_data_migrator');

// Processes / Services
const {
  initializeGroupCredentialFetcher,
} = require('../../ts/services/groupCredentialFetcher');
const {
  initializeNetworkObserver,
} = require('../../ts/services/networkObserver');
const {
  initializeUpdateListener,
} = require('../../ts/services/updateListener');
const { calling } = require('../../ts/services/calling');
const {
  enableStorageService,
  eraseAllStorageServiceState,
  runStorageServiceSyncJob,
  storageServiceUploadJob,
} = require('../../ts/services/storage');

function initializeMigrations({
  userDataPath,
  getRegionCode,
  Attachments,
  Type,
  VisualType,
  logger,
}) {
  if (!Attachments) {
    return null;
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
    openFileInFolder,
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
  const loadPreviewData = MessageType.loadPreviewData(loadAttachmentData);
  const loadQuoteData = MessageType.loadQuoteData(loadAttachmentData);
  const loadStickerData = MessageType.loadStickerData(loadAttachmentData);
  const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  const deleteOnDisk = Attachments.createDeleter(attachmentsPath);
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
    loadMessage: MessageType.createAttachmentLoader(loadAttachmentData),
    loadPreviewData,
    loadQuoteData,
    loadStickerData,
    openFileInFolder,
    readAttachmentData,
    readDraftData,
    readStickerData,
    readTempData,
    saveAttachmentToDisk,
    processNewAttachment: attachment =>
      MessageType.processNewAttachment(attachment, {
        writeNewAttachmentData,
        getAbsoluteAttachmentPath,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        logger,
      }),
    processNewSticker: stickerData =>
      MessageType.processNewSticker(stickerData, {
        writeNewStickerData,
        getAbsoluteStickerPath,
        getImageDimensions,
        logger,
      }),
    processNewEphemeralSticker: stickerData =>
      MessageType.processNewSticker(stickerData, {
        writeNewStickerData: writeNewTempData,
        getAbsoluteStickerPath: getAbsoluteTempPath,
        getImageDimensions,
        logger,
      }),
    upgradeMessageSchema: (message, options = {}) => {
      const { maxVersion } = options;

      return MessageType.upgradeSchema(message, {
        writeNewAttachmentData,
        getRegionCode,
        getAbsoluteAttachmentPath,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        logger,
        maxVersion,
      });
    },
    writeMessageAttachments: MessageType.createAttachmentDataWriter({
      writeExistingAttachmentData: createWriterForExisting(attachmentsPath),
      logger,
    }),
    writeNewAttachmentData: createWriterForNew(attachmentsPath),
    writeNewAvatarData,
    writeNewDraftData,
    writeNewBadgeImageFileData,
  };
}

exports.setup = (options = {}) => {
  const { Attachments, userDataPath, getRegionCode, logger } = options;

  const Migrations = initializeMigrations({
    userDataPath,
    getRegionCode,
    Attachments,
    Type: AttachmentType,
    VisualType: VisualAttachment,
    logger,
  });

  const Components = {
    AttachmentList,
    ChatColorPicker,
    ConfirmationDialog,
    ContactDetail,
    ContactModal,
    Emojify,
    ErrorModal,
    Lightbox,
    MediaGallery,
    MessageDetail,
    Quote,
    ProgressModal,
    StagedLinkPreview,
    DisappearingTimeDialog,
    SystemTraySettingsCheckboxes,
    WhatsNewLink,
  };

  const Roots = {
    createApp,
    createChatColorPicker,
    createConversationDetails,
    createForwardMessageModal,
    createGroupLinkManagement,
    createGroupV1MigrationModal,
    createGroupV2JoinModal,
    createGroupV2Permissions,
    createLeftPane,
    createMessageDetail,
    createConversationNotificationsSettings,
    createPendingInvites,
    createSafetyNumberViewer,
    createShortcutGuideModal,
    createStickerManager,
    createStickerPreviewModal,
  };

  const Ducks = {
    app: appDuck,
    calling: callingDuck,
    conversations: conversationsDuck,
    emojis: emojisDuck,
    expiration: expirationDuck,
    items: itemsDuck,
    linkPreviews: linkPreviewsDuck,
    network: networkDuck,
    updates: updatesDuck,
    user: userDuck,
    search: searchDuck,
    stickers: stickersDuck,
  };

  const Selectors = {
    conversations: conversationsSelectors,
    search: searchSelectors,
  };

  const Services = {
    calling,
    enableStorageService,
    eraseAllStorageServiceState,
    initializeGroupCredentialFetcher,
    initializeNetworkObserver,
    initializeUpdateListener,
    runStorageServiceSyncJob,
    storageServiceUploadJob,
  };

  const State = {
    createStore,
    Roots,
    Ducks,
    Selectors,
  };

  const Types = {
    Message: MessageType,

    // Mostly for debugging
    UUID,
    Address,
    QualifiedAddress,
  };

  const Views = {
    Initialization,
  };

  const Workflow = {
    MessageDataMigrator,
  };

  return {
    Backbone,
    Components,
    Crypto,
    Curve,
    conversationControllerStart,
    Data,
    EmojiLib,
    Groups,
    GroupChange,
    IndexedDB,
    Migrations,
    OS,
    RemoteConfig,
    Settings,
    Services,
    State,
    Stickers,
    Types,
    Util,
    Views,
    Workflow,
  };
};
