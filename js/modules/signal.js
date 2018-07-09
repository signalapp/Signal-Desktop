// The idea with this file is to make it webpackable for the style guide

const Backbone = require('../../ts/backbone');
const Crypto = require('./crypto');
const Database = require('./database');
const Emoji = require('../../ts/util/emoji');
const Notifications = require('../../ts/notifications');
const OS = require('../../ts/OS');
const Settings = require('./settings');
const Startup = require('./startup');
const Util = require('../../ts/util');

// Components
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
  TimerNotification,
} = require('../../ts/components/conversation/TimerNotification');
const {
  VerificationNotification,
} = require('../../ts/components/conversation/VerificationNotification');

// Migrations
const {
  getPlaceholderMigrations,
} = require('./migrations/get_placeholder_migrations');

const Migrations0DatabaseWithAttachmentData = require('./migrations/migrations_0_database_with_attachment_data');
const Migrations1DatabaseWithoutAttachmentData = require('./migrations/migrations_1_database_without_attachment_data');

// Types
const AttachmentType = require('./types/attachment');
const VisualAttachment = require('./types/visual_attachment');
const Contact = require('../../ts/types/Contact');
const Conversation = require('../../ts/types/Conversation');
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
}) {
  if (!Attachments) {
    return null;
  }
  const {
    getPath,
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
  const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);

  return {
    attachmentsPath,
    deleteAttachmentData: Type.deleteData(
      Attachments.createDeleter(attachmentsPath)
    ),
    getAbsoluteAttachmentPath,
    getPlaceholderMigrations,
    loadAttachmentData,
    loadMessage: MessageType.createAttachmentLoader(loadAttachmentData),
    Migrations0DatabaseWithAttachmentData,
    Migrations1DatabaseWithoutAttachmentData,
    upgradeMessageSchema: message =>
      MessageType.upgradeSchema(message, {
        writeNewAttachmentData: createWriterForNew(attachmentsPath),
        getRegionCode,
        getAbsoluteAttachmentPath,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
      }),
    writeMessageAttachments: MessageType.createAttachmentDataWriter(
      createWriterForExisting(attachmentsPath)
    ),
  };
}

exports.setup = (options = {}) => {
  const { Attachments, userDataPath, getRegionCode } = options;

  const Migrations = initializeMigrations({
    userDataPath,
    getRegionCode,
    Attachments,
    Type: AttachmentType,
    VisualType: VisualAttachment,
  });

  const Components = {
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
    TimerNotification,
    Types: {
      Message: MediaGalleryMessage,
    },
    VerificationNotification,
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
    Backbone,
    Components,
    Crypto,
    Database,
    Emoji,
    Migrations,
    Notifications,
    OS,
    Settings,
    Startup,
    Types,
    Util,
    Views,
    Workflow,
  };
};
