// The idea with this file is to make it webpackable for the style guide

const Backbone = require('../ts/backbone');
const Crypto = require('./modules/crypto');
const Database = require('./modules/database');
const HTML = require('../ts/html');
const Message = require('./modules/types/message');
const Notifications = require('../ts/notifications');
const OS = require('../ts/OS');
const Settings = require('./modules/settings');
const Startup = require('./modules/startup');
const Util = require('../ts/util');

// Components
const {
  ContactDetail,
} = require('../ts/components/conversation/ContactDetail');
const {
  EmbeddedContact,
} = require('../ts/components/conversation/EmbeddedContact');
const { Lightbox } = require('../ts/components/Lightbox');
const { LightboxGallery } = require('../ts/components/LightboxGallery');
const {
  MediaGallery,
} = require('../ts/components/conversation/media-gallery/MediaGallery');
const { Quote } = require('../ts/components/conversation/Quote');

// Migrations
const {
  getPlaceholderMigrations,
} = require('./modules/migrations/get_placeholder_migrations');

const Migrations0DatabaseWithAttachmentData = require('./modules/migrations/migrations_0_database_with_attachment_data');
const Migrations1DatabaseWithoutAttachmentData = require('./modules/migrations/migrations_1_database_without_attachment_data');

// Types
const AttachmentType = require('./modules/types/attachment');
const Contact = require('../ts/types/Contact');
const Conversation = require('../ts/types/Conversation');
const Errors = require('./modules/types/errors');
const MediaGalleryMessage = require('../ts/components/conversation/media-gallery/types/Message');
const MIME = require('../ts/types/MIME');
const SettingsType = require('../ts/types/Settings');

// Views
const Initialization = require('./modules/views/initialization');

// Workflow
const { IdleDetector } = require('./modules/idle_detector');
const MessageDataMigrator = require('./modules/messages_data_migrator');

exports.setup = (options = {}) => {
  const { Attachments, userDataPath } = options;

  const Components = {
    ContactDetail,
    EmbeddedContact,
    Lightbox,
    LightboxGallery,
    MediaGallery,
    Types: {
      Message: MediaGalleryMessage,
    },
    Quote,
  };

  const attachmentsPath = Attachments.getPath(userDataPath);
  const readAttachmentData = Attachments.createReader(attachmentsPath);
  const loadAttachmentData = AttachmentType.loadData(readAttachmentData);

  const Migrations = {
    attachmentsPath,
    deleteAttachmentData: AttachmentType.deleteData(
      Attachments.createDeleter(attachmentsPath)
    ),
    getAbsoluteAttachmentPath: Attachments.createAbsolutePathGetter(
      attachmentsPath
    ),
    getPlaceholderMigrations,
    loadAttachmentData,
    loadMessage: Message.createAttachmentLoader(loadAttachmentData),
    Migrations0DatabaseWithAttachmentData,
    Migrations1DatabaseWithoutAttachmentData,
    upgradeMessageSchema: message =>
      Message.upgradeSchema(message, {
        writeNewAttachmentData: Attachments.createWriterForNew(attachmentsPath),
      }),
    writeMessageAttachments: Message.createAttachmentDataWriter(
      Attachments.createWriterForExisting(attachmentsPath)
    ),
  };

  const Types = {
    Attachment: AttachmentType,
    Contact,
    Conversation,
    Errors,
    Message,
    MIME,
    Settings: SettingsType,
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
    HTML,
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
