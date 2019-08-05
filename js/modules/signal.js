// The idea with this file is to make it webpackable for the style guide

const { bindActionCreators } = require('redux');
const Backbone = require('../../ts/backbone');
const Crypto = require('./crypto');
const Data = require('./data');
const Database = require('./database');
const Emojis = require('./emojis');
const EmojiLib = require('../../ts/components/emoji/lib');
const IndexedDB = require('./indexeddb');
const Notifications = require('../../ts/notifications');
const OS = require('../../ts/OS');
const Stickers = require('./stickers');
const Settings = require('./settings');
const Util = require('../../ts/util');
const { migrateToSQL } = require('./migrate_to_sql');
const Metadata = require('./metadata/SecretSessionCipher');
const RefreshSenderCertificate = require('./refresh_sender_certificate');
const LinkPreviews = require('./link_previews');
const AttachmentDownloads = require('./attachment_downloads');

// Components
const {
  AttachmentList,
} = require('../../ts/components/conversation/AttachmentList');
const { CaptionEditor } = require('../../ts/components/CaptionEditor');
const {
  ContactDetail,
} = require('../../ts/components/conversation/ContactDetail');
const { ContactListItem } = require('../../ts/components/ContactListItem');
const { ContactName } = require('../../ts/components/conversation/ContactName');
const {
  ConversationHeader,
} = require('../../ts/components/conversation/ConversationHeader');
const {
  EmbeddedContact,
} = require('../../ts/components/conversation/EmbeddedContact');
const { Emojify } = require('../../ts/components/conversation/Emojify');
const {
  GroupNotification,
} = require('../../ts/components/conversation/GroupNotification');
const { Lightbox } = require('../../ts/components/Lightbox');
const { LightboxGallery } = require('../../ts/components/LightboxGallery');
const {
  MediaGallery,
} = require('../../ts/components/conversation/media-gallery/MediaGallery');
const { Message } = require('../../ts/components/conversation/Message');
const { MessageBody } = require('../../ts/components/conversation/MessageBody');
const {
  MessageDetail,
} = require('../../ts/components/conversation/MessageDetail');
const { Quote } = require('../../ts/components/conversation/Quote');
const {
  ResetSessionNotification,
} = require('../../ts/components/conversation/ResetSessionNotification');
const {
  SafetyNumberNotification,
} = require('../../ts/components/conversation/SafetyNumberNotification');
const {
  StagedLinkPreview,
} = require('../../ts/components/conversation/StagedLinkPreview');
const {
  TimerNotification,
} = require('../../ts/components/conversation/TimerNotification');
const {
  TypingBubble,
} = require('../../ts/components/conversation/TypingBubble');
const {
  UnsupportedMessage,
} = require('../../ts/components/conversation/UnsupportedMessage');
const {
  VerificationNotification,
} = require('../../ts/components/conversation/VerificationNotification');

// State
const {
  createCompositionArea,
} = require('../../ts/state/roots/createCompositionArea');
const { createLeftPane } = require('../../ts/state/roots/createLeftPane');
const {
  createStickerManager,
} = require('../../ts/state/roots/createStickerManager');
const {
  createStickerPreviewModal,
} = require('../../ts/state/roots/createStickerPreviewModal');

const { createStore } = require('../../ts/state/createStore');
const conversationsDuck = require('../../ts/state/ducks/conversations');
const emojisDuck = require('../../ts/state/ducks/emojis');
const itemsDuck = require('../../ts/state/ducks/items');
const stickersDuck = require('../../ts/state/ducks/stickers');
const userDuck = require('../../ts/state/ducks/user');

// Migrations
const {
  getPlaceholderMigrations,
  getCurrentVersion,
} = require('./migrations/get_placeholder_migrations');
const { run } = require('./migrations/migrations');

// Types
const AttachmentType = require('./types/attachment');
const VisualAttachment = require('./types/visual_attachment');
const Contact = require('../../ts/types/Contact');
const Conversation = require('./types/conversation');
const Errors = require('./types/errors');
const MediaGalleryMessage = require('../../ts/components/conversation/media-gallery/types/Message');
const MessageType = require('./types/message');
const MIME = require('../../ts/types/MIME');
const PhoneNumber = require('../../ts/types/PhoneNumber');
const SettingsType = require('../../ts/types/Settings');

// Views
const Initialization = require('./views/initialization');

// Workflow
const { IdleDetector } = require('./idle_detector');
const MessageDataMigrator = require('./messages_data_migrator');

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
    getPath,
    getStickersPath,
    getTempPath,
    createReader,
    createAbsolutePathGetter,
    createWriterForNew,
    createWriterForExisting,
  } = Attachments;
  const {
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
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
  const copyIntoAttachmentsDirectory = Attachments.copyIntoAttachmentsDirectory(
    attachmentsPath
  );

  const stickersPath = getStickersPath(userDataPath);
  const writeNewStickerData = createWriterForNew(stickersPath);
  const getAbsoluteStickerPath = createAbsolutePathGetter(stickersPath);
  const deleteSticker = Attachments.createDeleter(stickersPath);
  const readStickerData = createReader(stickersPath);

  const tempPath = getTempPath(userDataPath);
  const getAbsoluteTempPath = createAbsolutePathGetter(tempPath);
  const writeNewTempData = createWriterForNew(tempPath);
  const deleteTempFile = Attachments.createDeleter(tempPath);
  const readTempData = createReader(tempPath);
  const copyIntoTempDirectory = Attachments.copyIntoAttachmentsDirectory(
    tempPath
  );

  return {
    attachmentsPath,
    copyIntoAttachmentsDirectory,
    copyIntoTempDirectory,
    deleteAttachmentData: deleteOnDisk,
    deleteExternalMessageFiles: MessageType.deleteAllExternalFiles({
      deleteAttachmentData: Type.deleteData(deleteOnDisk),
      deleteOnDisk,
    }),
    deleteSticker,
    deleteTempFile,
    getAbsoluteAttachmentPath,
    getAbsoluteStickerPath,
    getAbsoluteTempPath,
    getPlaceholderMigrations,
    getCurrentVersion,
    loadAttachmentData,
    loadMessage: MessageType.createAttachmentLoader(loadAttachmentData),
    loadPreviewData,
    loadQuoteData,
    loadStickerData,
    readAttachmentData,
    readStickerData,
    readTempData,
    run,
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
    CaptionEditor,
    ContactDetail,
    ContactListItem,
    ContactName,
    ConversationHeader,
    EmbeddedContact,
    Emojify,
    GroupNotification,
    Lightbox,
    LightboxGallery,
    MediaGallery,
    Message,
    MessageBody,
    MessageDetail,
    Quote,
    ResetSessionNotification,
    SafetyNumberNotification,
    StagedLinkPreview,
    TimerNotification,
    Types: {
      Message: MediaGalleryMessage,
    },
    TypingBubble,
    UnsupportedMessage,
    VerificationNotification,
  };

  const Roots = {
    createCompositionArea,
    createLeftPane,
    createStickerManager,
    createStickerPreviewModal,
  };
  const Ducks = {
    conversations: conversationsDuck,
    emojis: emojisDuck,
    items: itemsDuck,
    user: userDuck,
    stickers: stickersDuck,
  };
  const State = {
    bindActionCreators,
    createStore,
    Roots,
    Ducks,
  };

  const Types = {
    Attachment: AttachmentType,
    Contact,
    Conversation,
    Errors,
    Message: MessageType,
    MIME,
    PhoneNumber,
    Settings: SettingsType,
    VisualAttachment,
  };

  const Views = {
    Initialization,
  };

  const Workflow = {
    IdleDetector,
    MessageDataMigrator,
  };

  return {
    AttachmentDownloads,
    Backbone,
    Components,
    Crypto,
    Data,
    Database,
    Emojis,
    EmojiLib,
    IndexedDB,
    LinkPreviews,
    Metadata,
    migrateToSQL,
    Migrations,
    Notifications,
    OS,
    RefreshSenderCertificate,
    Settings,
    State,
    Stickers,
    Types,
    Util,
    Views,
    Workflow,
  };
};
