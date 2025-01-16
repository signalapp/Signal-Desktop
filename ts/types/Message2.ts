// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFunction, isObject, identity } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';

import * as Contact from './EmbeddedContact';
import type {
  AddressableAttachmentType,
  AttachmentType,
  AttachmentWithHydratedData,
  LocalAttachmentV2Type,
  LocallySavedAttachment,
  ReencryptableAttachment,
} from './Attachment';
import {
  captureDimensionsAndScreenshot,
  getAttachmentIdForLogging,
  isAttachmentLocallySaved,
  removeSchemaVersion,
  replaceUnicodeOrderOverrides,
  replaceUnicodeV2,
} from './Attachment';
import * as Errors from './errors';
import * as SchemaVersion from './SchemaVersion';
import { initializeAttachmentMetadata } from './message/initializeAttachmentMetadata';

import { LONG_MESSAGE } from './MIME';
import type * as MIME from './MIME';
import type { LoggerType } from './Logging';
import type {
  EmbeddedContactType,
  EmbeddedContactWithHydratedAvatar,
} from './EmbeddedContact';

import type {
  MessageAttributesType,
  QuotedAttachmentType,
  QuotedMessageType,
} from '../model-types.d';
import type {
  LinkPreviewType,
  LinkPreviewWithHydratedData,
} from './message/LinkPreviews';
import type { StickerType, StickerWithHydratedData } from './Stickers';
import { migrateDataToFileSystem } from '../util/attachments/migrateDataToFilesystem';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from '../util/getLocalAttachmentUrl';
import { encryptLegacyAttachment } from '../util/encryptLegacyAttachment';
import { deepClone } from '../util/deepClone';
import * as Bytes from '../Bytes';
import { isBodyTooLong } from '../util/longAttachment';

export const GROUP = 'group';
export const PRIVATE = 'private';

export type ContextType = {
  doesAttachmentExist: (relativePath: string) => Promise<boolean>;
  ensureAttachmentIsReencryptable: (
    attachment: LocallySavedAttachment
  ) => Promise<ReencryptableAttachment>;
  getImageDimensions: (params: {
    objectUrl: string;
    logger: LoggerType;
  }) => Promise<{
    width: number;
    height: number;
  }>;
  getRegionCode: () => string | undefined;
  logger: LoggerType;
  makeImageThumbnail: (params: {
    size: number;
    objectUrl: string;
    contentType: MIME.MIMEType;
    logger: LoggerType;
  }) => Promise<Blob>;
  makeObjectUrl: (
    data: Uint8Array | ArrayBuffer,
    contentType: MIME.MIMEType
  ) => string;
  makeVideoScreenshot: (params: {
    objectUrl: string;
    contentType: MIME.MIMEType;
    logger: LoggerType;
  }) => Promise<Blob>;
  maxVersion?: number;
  revokeObjectUrl: (objectUrl: string) => void;
  readAttachmentData: (
    attachment: Partial<AddressableAttachmentType>
  ) => Promise<Uint8Array>;
  writeNewAttachmentData: (data: Uint8Array) => Promise<LocalAttachmentV2Type>;
  writeNewStickerData: (data: Uint8Array) => Promise<LocalAttachmentV2Type>;
  deleteOnDisk: (path: string) => Promise<void>;
};

// Schema version history
//
// Version 0
//   - Schema initialized
// Version 1
//   - Attachments: Auto-orient JPEG attachments using EXIF `Orientation` data.
//     N.B. The process of auto-orient for JPEGs strips (loses) all existing
//     EXIF metadata improving privacy, e.g. geolocation, camera make, etc.
// Version 2
//   - Attachments: Sanitize Unicode order override characters.
// Version 3
//   - Attachments: Write attachment data to disk and store relative path to it.
// Version 4
//   - Quotes: Write thumbnail data to disk and store relative path to it.
// Version 5 (deprecated)
//   - Attachments: Track number and kind of attachments for media gallery
//     - `hasAttachments?: 1 | 0`
//     - `hasVisualMediaAttachments?: 1 | undefined` (for media gallery ‘Media’ view)
//     - `hasFileAttachments?: 1 | undefined` (for media gallery ‘Documents’ view)
//   - IMPORTANT: Version 7 changes the classification of visual media and files.
//     Therefore version 5 is considered deprecated. For an easier implementation,
//     new files have the same classification in version 5 as in version 7.
// Version 6
//   - Contact: Write contact avatar to disk, ensure contact data is well-formed
// Version 7 (supersedes attachment classification in version 5)
//   - Attachments: Update classification for:
//     - `hasVisualMediaAttachments`: Include all images and video regardless of
//       whether Chromium can render it or not.
//     - `hasFileAttachments`: Exclude voice messages.
// Version 8
//   - Attachments: Capture video/image dimensions and thumbnails, as well as a
//       full-size screenshot for video.
// Version 9
//   - Attachments: Expand the set of unicode characters we filter out of
//     attachment filenames
// Version 10
//   - Preview: A new type of attachment can be included in a message.
// Version 11 (deprecated)
//   - Attachments: add sha256 plaintextHash
// Version 12:
//   - Attachments: encrypt attachments on disk
// Version 13:
//   - Attachments: write bodyAttachment to disk
// Version 14
//   - All attachments: ensure they are reencryptable to a known digest

const INITIAL_SCHEMA_VERSION = 0;

// Placeholder until we have stronger preconditions:
export const isValid = (_message: MessageAttributesType): boolean => true;

// Schema
export const initializeSchemaVersion = ({
  message,
  logger,
}: {
  message: MessageAttributesType;
  logger: LoggerType;
}): MessageAttributesType => {
  const isInitialized =
    SchemaVersion.isValid(message.schemaVersion) && message.schemaVersion >= 1;
  if (isInitialized) {
    return message;
  }

  const firstAttachment = message?.attachments?.[0];
  if (!firstAttachment) {
    return { ...message, schemaVersion: INITIAL_SCHEMA_VERSION };
  }

  // All attachments should have the same schema version, so we just pick
  // the first one:
  const inheritedSchemaVersion = SchemaVersion.isValid(
    firstAttachment.schemaVersion
  )
    ? firstAttachment.schemaVersion
    : INITIAL_SCHEMA_VERSION;
  const messageWithInitialSchema = {
    ...message,
    schemaVersion: inheritedSchemaVersion,
    attachments:
      message?.attachments?.map(attachment =>
        removeSchemaVersion({ attachment, logger })
      ) || [],
  };

  return messageWithInitialSchema;
};

// Middleware
// type UpgradeStep = (Message, Context) -> Promise Message

// SchemaVersion -> UpgradeStep -> UpgradeStep
export const _withSchemaVersion = ({
  schemaVersion,
  upgrade,
}: {
  schemaVersion: number;
  upgrade: (
    message: MessageAttributesType,
    context: ContextType
  ) => Promise<MessageAttributesType>;
}): ((
  message: MessageAttributesType,
  context: ContextType
) => Promise<MessageAttributesType>) => {
  if (!SchemaVersion.isValid(schemaVersion)) {
    throw new TypeError('_withSchemaVersion: schemaVersion is invalid');
  }
  if (!isFunction(upgrade)) {
    throw new TypeError('_withSchemaVersion: upgrade must be a function');
  }

  return async (message: MessageAttributesType, context: ContextType) => {
    if (!context || !isObject(context.logger)) {
      throw new TypeError(
        '_withSchemaVersion: context must have logger object'
      );
    }
    const { logger } = context;

    if (!isValid(message)) {
      logger.error(
        'Message._withSchemaVersion: Invalid input message:',
        message
      );
      return message;
    }

    const isAlreadyUpgraded = (message.schemaVersion || 0) >= schemaVersion;
    if (isAlreadyUpgraded) {
      return message;
    }

    const expectedVersion = schemaVersion - 1;
    const hasExpectedVersion = message.schemaVersion === expectedVersion;
    if (!hasExpectedVersion) {
      logger.warn(
        'WARNING: Message._withSchemaVersion: Unexpected version:',
        `Expected message to have version ${expectedVersion},`,
        `but got ${message.schemaVersion}.`
      );
      return message;
    }

    let upgradedMessage;
    try {
      upgradedMessage = await upgrade(message, context);
    } catch (error) {
      logger.error(
        `Message._withSchemaVersion: error updating message ${message.id}, 
        attempt ${message.schemaMigrationAttempts}:`,
        Errors.toLogFormat(error)
      );
      throw error;
    }

    if (!isValid(upgradedMessage)) {
      logger.error(
        'Message._withSchemaVersion: Invalid upgraded message:',
        upgradedMessage
      );
      return message;
    }

    return { ...upgradedMessage, schemaVersion };
  };
};

// Public API
//      _mapAttachments :: (Attachment -> Promise Attachment) ->
//                         (Message, Context) ->
//                         Promise Message
export type UpgradeAttachmentType = (
  attachment: AttachmentType,
  context: ContextType,
  message: MessageAttributesType
) => Promise<AttachmentType>;

// As regrettable as it is we have to fight back against esbuild's `__name`
// wrapper for functions that are created at high rate, because `__name` affects
// runtime performance.
const esbuildAnonymize = identity;

export const _mapAttachments =
  (upgradeAttachment: UpgradeAttachmentType) =>
  async (
    message: MessageAttributesType,
    context: ContextType
  ): Promise<MessageAttributesType> => {
    if (!message.attachments?.length) {
      return message;
    }

    const upgradeWithContext = esbuildAnonymize((attachment: AttachmentType) =>
      upgradeAttachment(attachment, context, message)
    );
    const attachments = await Promise.all(
      (message.attachments || []).map(upgradeWithContext)
    );
    return { ...message, attachments };
  };

export const _mapAllAttachments =
  (upgradeAttachment: UpgradeAttachmentType) =>
  async (
    message: MessageAttributesType,
    context: ContextType
  ): Promise<MessageAttributesType> => {
    let result = { ...message };
    result = await _mapAttachments(upgradeAttachment)(result, context);
    result = await _mapQuotedAttachments(upgradeAttachment)(result, context);
    result = await _mapPreviewAttachments(upgradeAttachment)(result, context);
    result = await _mapContact(async contact => {
      if (!contact.avatar?.avatar) {
        return contact;
      }

      return {
        ...contact,
        avatar: {
          ...contact.avatar,
          avatar: await upgradeAttachment(
            contact.avatar.avatar,
            context,
            result
          ),
        },
      };
    })(result, context);

    if (result.sticker?.data) {
      result.sticker.data = await upgradeAttachment(
        result.sticker.data,
        context,
        result
      );
    }
    if (result.bodyAttachment) {
      result.bodyAttachment = await upgradeAttachment(
        result.bodyAttachment,
        context,
        result
      );
    }

    return result;
  };

// Public API
//      _mapContact :: (Contact -> Promise Contact) ->
//                     (Message, Context) ->
//                     Promise Message

export type UpgradeContactType = (
  contact: EmbeddedContactType,
  context: ContextType,
  message: MessageAttributesType
) => Promise<EmbeddedContactType>;
export const _mapContact =
  (upgradeContact: UpgradeContactType) =>
  async (
    message: MessageAttributesType,
    context: ContextType
  ): Promise<MessageAttributesType> => {
    if (!message.contact?.length) {
      return message;
    }

    const upgradeWithContext = esbuildAnonymize(
      (contact: EmbeddedContactType) =>
        upgradeContact(contact, context, message)
    );
    const contact = await Promise.all(
      (message.contact || []).map(upgradeWithContext)
    );
    return { ...message, contact };
  };

//      _mapQuotedAttachments :: (QuotedAttachment -> Promise QuotedAttachment) ->
//                               (Message, Context) ->
//                               Promise Message
export const _mapQuotedAttachments =
  (upgradeAttachment: UpgradeAttachmentType) =>
  async (
    message: MessageAttributesType,
    context: ContextType
  ): Promise<MessageAttributesType> => {
    if (!message.quote) {
      return message;
    }
    if (!context || !isObject(context.logger)) {
      throw new Error('_mapQuotedAttachments: context must have logger object');
    }

    const upgradeWithContext = esbuildAnonymize(
      async (
        attachment: QuotedAttachmentType
      ): Promise<QuotedAttachmentType> => {
        const { thumbnail } = attachment;
        if (!thumbnail) {
          return attachment;
        }

        const upgradedThumbnail = await upgradeAttachment(
          thumbnail as AttachmentType,
          context,
          message
        );
        return { ...attachment, thumbnail: upgradedThumbnail };
      }
    );

    const quotedAttachments =
      (message.quote && message.quote.attachments) || [];

    const attachments = await Promise.all(
      quotedAttachments.map(upgradeWithContext)
    );
    return { ...message, quote: { ...message.quote, attachments } };
  };

//      _mapPreviewAttachments :: (PreviewAttachment -> Promise PreviewAttachment) ->
//                               (Message, Context) ->
//                               Promise Message
export const _mapPreviewAttachments =
  (upgradeAttachment: UpgradeAttachmentType) =>
  async (
    message: MessageAttributesType,
    context: ContextType
  ): Promise<MessageAttributesType> => {
    if (!message.preview) {
      return message;
    }
    if (!context || !isObject(context.logger)) {
      throw new Error(
        '_mapPreviewAttachments: context must have logger object'
      );
    }

    const upgradeWithContext = esbuildAnonymize(
      async (preview: LinkPreviewType) => {
        const { image } = preview;
        if (!image) {
          return preview;
        }

        const upgradedImage = await upgradeAttachment(image, context, message);
        return { ...preview, image: upgradedImage };
      }
    );

    const preview = await Promise.all(
      (message.preview || []).map(upgradeWithContext)
    );
    return { ...message, preview };
  };

const noopUpgrade = async (message: MessageAttributesType) => message;

const toVersion0 = async (
  message: MessageAttributesType,
  context: ContextType
) => initializeSchemaVersion({ message, logger: context.logger });

const toVersion1 = _withSchemaVersion({
  schemaVersion: 1,
  // NOOP: We no longer need to run autoOrientJPEG on incoming JPEGs since Chromium
  // respects the EXIF orientation for us when displaying the image
  upgrade: noopUpgrade,
});
const toVersion2 = _withSchemaVersion({
  schemaVersion: 2,
  upgrade: _mapAttachments(replaceUnicodeOrderOverrides),
});
const toVersion3 = _withSchemaVersion({
  schemaVersion: 3,
  upgrade: _mapAttachments(migrateDataToFileSystem),
});
const toVersion4 = _withSchemaVersion({
  schemaVersion: 4,
  upgrade: _mapQuotedAttachments(migrateDataToFileSystem),
});
// NOOP: Used to be initializeAttachmentMetadata, but it happens in version 7
// now.
const toVersion5 = _withSchemaVersion({
  schemaVersion: 5,
  upgrade: noopUpgrade,
});
const toVersion6 = _withSchemaVersion({
  schemaVersion: 6,
  upgrade: _mapContact(Contact.parseAndWriteAvatar(migrateDataToFileSystem)),
});
// IMPORTANT: We’ve updated our definition of `initializeAttachmentMetadata`, so
// we need to run it again on existing items that have previously been incorrectly
// classified:
const toVersion7 = _withSchemaVersion({
  schemaVersion: 7,
  upgrade: initializeAttachmentMetadata,
});

const toVersion8 = _withSchemaVersion({
  schemaVersion: 8,
  upgrade: _mapAttachments(captureDimensionsAndScreenshot),
});

const toVersion9 = _withSchemaVersion({
  schemaVersion: 9,
  upgrade: _mapAttachments(replaceUnicodeV2),
});
const toVersion10 = _withSchemaVersion({
  schemaVersion: 10,
  upgrade: async (message, context) => {
    const processPreviews = _mapPreviewAttachments(migrateDataToFileSystem);
    const processSticker = esbuildAnonymize(
      async (
        stickerMessage: MessageAttributesType,
        stickerContext: ContextType
      ): Promise<MessageAttributesType> => {
        const { sticker } = stickerMessage;
        if (!sticker || !sticker.data || !sticker.data.data) {
          return stickerMessage;
        }

        return {
          ...stickerMessage,
          sticker: {
            ...sticker,
            data: await migrateDataToFileSystem(sticker.data, stickerContext),
          },
        };
      }
    );

    const previewProcessed = await processPreviews(message, context);
    const stickerProcessed = await processSticker(previewProcessed, context);

    return stickerProcessed;
  },
});

const toVersion11 = _withSchemaVersion({
  schemaVersion: 11,
  // NOOP: We no longer need to get plaintextHash here because we get it once
  // we migrate attachments to v2.
  upgrade: noopUpgrade,
});

const toVersion12 = _withSchemaVersion({
  schemaVersion: 12,
  upgrade: async (message, context) => {
    const { attachments, quote, contact, preview, sticker } = message;

    const result = { ...message };

    const logId = `Message2.toVersion12(${message.sent_at})`;

    if (attachments?.length) {
      result.attachments = await Promise.all(
        attachments.map(async (attachment, i) => {
          const copy = await encryptLegacyAttachment(attachment, {
            ...context,
            logId: `${logId}.attachments[${i}]`,
          });
          if (copy.thumbnail) {
            copy.thumbnail = await encryptLegacyAttachment(copy.thumbnail, {
              ...context,
              logId: `${logId}.attachments[${i}].thumbnail`,
            });
          }
          if (copy.screenshot) {
            copy.screenshot = await encryptLegacyAttachment(copy.screenshot, {
              ...context,
              logId: `${logId}.attachments[${i}].screenshot`,
            });
          }
          return copy;
        })
      );
    }

    if (quote && quote.attachments?.length) {
      result.quote = {
        ...quote,
        attachments: await Promise.all(
          quote.attachments.map(async (quoteAttachment, i) => {
            return {
              ...quoteAttachment,
              thumbnail:
                quoteAttachment.thumbnail &&
                (await encryptLegacyAttachment(quoteAttachment.thumbnail, {
                  ...context,
                  logId: `${logId}.quote[${i}].thumbnail`,
                })),
            };
          })
        ),
      };
    }

    if (contact?.length) {
      result.contact = await Promise.all(
        contact.map(async (c, i) => {
          if (!c.avatar?.avatar) {
            return c;
          }

          return {
            ...c,
            avatar: {
              ...c.avatar,
              avatar: await encryptLegacyAttachment(c.avatar.avatar, {
                ...context,
                logId: `${logId}.contact[${i}].avatar`,
              }),
            },
          };
        })
      );
    }

    if (preview?.length) {
      result.preview = await Promise.all(
        preview.map(async (p, i) => {
          if (!p.image) {
            return p;
          }

          return {
            ...p,
            image: await encryptLegacyAttachment(p.image, {
              ...context,
              logId: `${logId}.preview[${i}].image`,
            }),
          };
        })
      );
    }

    if (sticker) {
      result.sticker = {
        ...sticker,
        data: sticker.data && {
          ...(await encryptLegacyAttachment(sticker.data, {
            ...context,
            logId: `${logId}.sticker.data`,
          })),
          thumbnail:
            sticker.data.thumbnail &&
            (await encryptLegacyAttachment(sticker.data.thumbnail, {
              ...context,
              logId: `${logId}.sticker.thumbnail`,
            })),
        },
      };
    }

    return result;
  },
});
const toVersion13 = _withSchemaVersion({
  schemaVersion: 13,
  upgrade: migrateBodyAttachmentToDisk,
});

const toVersion14 = _withSchemaVersion({
  schemaVersion: 14,
  upgrade: _mapAllAttachments(
    async (
      attachment,
      { logger, ensureAttachmentIsReencryptable, doesAttachmentExist }
    ) => {
      if (!isAttachmentLocallySaved(attachment)) {
        return attachment;
      }

      if (!(await doesAttachmentExist(attachment.path))) {
        // Attachments may be missing, e.g. for quote thumbnails that reference messages
        // which have been deleted
        logger.info(
          `Message2.toVersion14(id=${getAttachmentIdForLogging(attachment)}: File does not exist`
        );
        return attachment;
      }

      if (!attachment.digest) {
        // Messages that are being upgraded prior to being sent may not have encrypted the
        // attachment yet
        return attachment;
      }

      return ensureAttachmentIsReencryptable(attachment);
    }
  ),
});

const VERSIONS = [
  toVersion0,
  toVersion1,
  toVersion2,
  toVersion3,
  toVersion4,
  toVersion5,
  toVersion6,
  toVersion7,
  toVersion8,
  toVersion9,
  toVersion10,
  toVersion11,
  toVersion12,
  toVersion13,
  toVersion14,
];

export const CURRENT_SCHEMA_VERSION = VERSIONS.length - 1;

// We need dimensions and screenshots for images for proper display
export const VERSION_NEEDED_FOR_DISPLAY = 9;

// UpgradeStep
export const upgradeSchema = async (
  rawMessage: MessageAttributesType,
  {
    readAttachmentData,
    writeNewAttachmentData,
    doesAttachmentExist,
    ensureAttachmentIsReencryptable,
    getRegionCode,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
    writeNewStickerData,
    deleteOnDisk,
    logger,
    maxVersion = CURRENT_SCHEMA_VERSION,
  }: ContextType,
  upgradeOptions: {
    versions: ReadonlyArray<
      (
        message: MessageAttributesType,
        context: ContextType
      ) => Promise<MessageAttributesType>
    >;
  } = { versions: VERSIONS }
): Promise<MessageAttributesType> => {
  const { versions } = upgradeOptions;
  let message = rawMessage;
  const startingVersion = message.schemaVersion ?? 0;
  for (let index = 0, max = versions.length; index < max; index += 1) {
    if (maxVersion < index) {
      break;
    }

    const currentVersion = versions[index];
    try {
      // We really do want this intra-loop await because this is a chained async action,
      //   each step dependent on the previous
      // eslint-disable-next-line no-await-in-loop
      message = await currentVersion(message, {
        readAttachmentData,
        writeNewAttachmentData,
        makeObjectUrl,
        revokeObjectUrl,
        doesAttachmentExist,
        ensureAttachmentIsReencryptable,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        logger,
        getRegionCode,
        writeNewStickerData,
        deleteOnDisk,
      });
    } catch (e) {
      // Throw the error if we were unable to upgrade the message at all
      if (message.schemaVersion === startingVersion) {
        throw e;
      } else {
        // Otherwise, return the message upgraded as far as it could be. On the next
        // migration attempt, it will fail.
        logger.error(
          `Upgraded message from ${startingVersion} -> ${message.schemaVersion}; failed on upgrade to ${index}`
        );
        break;
      }
    }
  }

  return message;
};

// Runs on attachments outside of the schema upgrade process, since attachments are
//   downloaded out of band.
export const processNewAttachment = async (
  attachment: AttachmentType,
  {
    ensureAttachmentIsReencryptable,
    writeNewAttachmentData,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
  }: Pick<
    ContextType,
    | 'writeNewAttachmentData'
    | 'makeObjectUrl'
    | 'revokeObjectUrl'
    | 'getImageDimensions'
    | 'makeImageThumbnail'
    | 'makeVideoScreenshot'
    | 'logger'
    | 'deleteOnDisk'
    | 'ensureAttachmentIsReencryptable'
  >
): Promise<AttachmentType> => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError('context.writeNewAttachmentData is required');
  }
  if (!isFunction(makeObjectUrl)) {
    throw new TypeError('context.makeObjectUrl is required');
  }
  if (!isFunction(revokeObjectUrl)) {
    throw new TypeError('context.revokeObjectUrl is required');
  }
  if (!isFunction(getImageDimensions)) {
    throw new TypeError('context.getImageDimensions is required');
  }
  if (!isFunction(makeImageThumbnail)) {
    throw new TypeError('context.makeImageThumbnail is required');
  }
  if (!isFunction(makeVideoScreenshot)) {
    throw new TypeError('context.makeVideoScreenshot is required');
  }
  if (!isObject(logger)) {
    throw new TypeError('context.logger is required');
  }

  let upgradedAttachment = attachment;

  if (isAttachmentLocallySaved(upgradedAttachment)) {
    upgradedAttachment =
      await ensureAttachmentIsReencryptable(upgradedAttachment);
  }

  const finalAttachment = await captureDimensionsAndScreenshot(
    upgradedAttachment,
    {
      writeNewAttachmentData,
      makeObjectUrl,
      revokeObjectUrl,
      getImageDimensions,
      makeImageThumbnail,
      makeVideoScreenshot,
      logger,
    }
  );

  return finalAttachment;
};

export const processNewSticker = async (
  stickerData: Uint8Array,
  isEphemeral: boolean,
  {
    writeNewStickerData,
    getImageDimensions,
    logger,
  }: Pick<ContextType, 'writeNewStickerData' | 'getImageDimensions' | 'logger'>
): Promise<LocalAttachmentV2Type & { width: number; height: number }> => {
  if (!isFunction(writeNewStickerData)) {
    throw new TypeError('context.writeNewStickerData is required');
  }
  if (!isFunction(getImageDimensions)) {
    throw new TypeError('context.getImageDimensions is required');
  }
  if (!isObject(logger)) {
    throw new TypeError('context.logger is required');
  }

  const local = await writeNewStickerData(stickerData);
  const url = await getLocalAttachmentUrl(local, {
    disposition: isEphemeral
      ? AttachmentDisposition.Temporary
      : AttachmentDisposition.Sticker,
  });

  const { width, height } = await getImageDimensions({
    objectUrl: url,
    logger,
  });

  return {
    ...local,
    width,
    height,
  };
};

type LoadAttachmentType = (
  attachment: Partial<AttachmentType>
) => Promise<AttachmentWithHydratedData>;

export const createAttachmentLoader = (
  loadAttachmentData: LoadAttachmentType
): ((message: MessageAttributesType) => Promise<MessageAttributesType>) => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError(
      'createAttachmentLoader: loadAttachmentData is required'
    );
  }

  return async (
    message: MessageAttributesType
  ): Promise<MessageAttributesType> => ({
    ...message,
    attachments: await Promise.all(
      (message.attachments || []).map(loadAttachmentData)
    ),
  });
};

export const loadQuoteData = (
  loadAttachmentData: LoadAttachmentType
): ((
  quote: QuotedMessageType | undefined | null
) => Promise<QuotedMessageType | null>) => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('loadQuoteData: loadAttachmentData is required');
  }

  return async (
    quote: QuotedMessageType | undefined | null
  ): Promise<QuotedMessageType | null> => {
    if (!quote) {
      return null;
    }

    return {
      ...quote,
      attachments: await Promise.all(
        (quote.attachments || []).map(async attachment => {
          const { thumbnail } = attachment;

          if (!thumbnail || !thumbnail.path) {
            return attachment;
          }

          return {
            ...attachment,
            thumbnail: await loadAttachmentData(thumbnail),
          };
        })
      ),
    };
  };
};

export const loadContactData = (
  loadAttachmentData: LoadAttachmentType
): ((
  contact: ReadonlyArray<ReadonlyDeep<EmbeddedContactType>> | undefined
) => Promise<Array<EmbeddedContactWithHydratedAvatar> | undefined>) => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('loadContactData: loadAttachmentData is required');
  }

  return async (
    contact: ReadonlyArray<ReadonlyDeep<EmbeddedContactType>> | undefined
  ): Promise<Array<EmbeddedContactWithHydratedAvatar> | undefined> => {
    if (!contact) {
      return undefined;
    }

    return Promise.all(
      contact.map(
        async (
          item: ReadonlyDeep<EmbeddedContactType>
        ): Promise<EmbeddedContactWithHydratedAvatar> => {
          const copy = deepClone(item);
          if (!copy?.avatar?.avatar?.path) {
            return {
              ...copy,
              avatar: undefined,
            };
          }

          return {
            ...copy,
            avatar: {
              ...copy.avatar,
              avatar: {
                ...copy.avatar.avatar,
                ...(await loadAttachmentData(copy.avatar.avatar)),
              },
            },
          };
        }
      )
    );
  };
};

export const loadPreviewData = (
  loadAttachmentData: LoadAttachmentType
): ((
  preview: ReadonlyArray<ReadonlyDeep<LinkPreviewType>> | undefined
) => Promise<Array<LinkPreviewWithHydratedData>>) => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('loadPreviewData: loadAttachmentData is required');
  }

  return async (
    preview: ReadonlyArray<ReadonlyDeep<LinkPreviewType>> | undefined
  ) => {
    if (!preview || !preview.length) {
      return [];
    }

    return Promise.all(
      preview.map(
        async (item: LinkPreviewType): Promise<LinkPreviewWithHydratedData> => {
          const copy = deepClone(item);

          if (!copy.image) {
            return {
              ...copy,
              // Pacify typescript
              image: undefined,
            };
          }

          return {
            ...copy,
            image: await loadAttachmentData(copy.image),
          };
        }
      )
    );
  };
};

export const loadStickerData = (
  loadAttachmentData: LoadAttachmentType
): ((
  sticker: StickerType | undefined
) => Promise<StickerWithHydratedData | undefined>) => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('loadStickerData: loadAttachmentData is required');
  }

  return async (sticker: StickerType | undefined) => {
    if (!sticker || !sticker.data) {
      return undefined;
    }

    return {
      ...sticker,
      data: await loadAttachmentData(sticker.data),
    };
  };
};

export const deleteAllExternalFiles = ({
  deleteAttachmentData,
  deleteOnDisk,
}: {
  deleteAttachmentData: (attachment: AttachmentType) => Promise<void>;
  deleteOnDisk: (path: string) => Promise<void>;
}): ((message: MessageAttributesType) => Promise<void>) => {
  if (!isFunction(deleteAttachmentData)) {
    throw new TypeError(
      'deleteAllExternalFiles: deleteAttachmentData must be a function'
    );
  }

  if (!isFunction(deleteOnDisk)) {
    throw new TypeError(
      'deleteAllExternalFiles: deleteOnDisk must be a function'
    );
  }

  return async (message: MessageAttributesType) => {
    const {
      attachments,
      bodyAttachment,
      editHistory,
      quote,
      contact,
      preview,
      sticker,
    } = message;

    if (attachments && attachments.length) {
      await Promise.all(attachments.map(deleteAttachmentData));
    }

    if (bodyAttachment) {
      await deleteAttachmentData(bodyAttachment);
    }

    if (quote && quote.attachments && quote.attachments.length) {
      await Promise.all(
        quote.attachments.map(async attachment => {
          const { thumbnail } = attachment;

          // To prevent spoofing, we copy the original image from the quoted message.
          //   If so, it will have a 'copied' field. We don't want to delete it if it has
          //   that field set to true.
          if (thumbnail && thumbnail.path && !thumbnail.copied) {
            await deleteOnDisk(thumbnail.path);
          }
        })
      );
    }

    if (contact && contact.length) {
      await Promise.all(
        contact.map(async item => {
          const { avatar } = item;

          if (avatar && avatar.avatar && avatar.avatar.path) {
            await deleteOnDisk(avatar.avatar.path);
          }
        })
      );
    }

    if (preview && preview.length) {
      await deletePreviews(preview, deleteOnDisk);
    }

    if (sticker && sticker.data && sticker.data.path) {
      await deleteOnDisk(sticker.data.path);

      if (sticker.data.thumbnail && sticker.data.thumbnail.path) {
        await deleteOnDisk(sticker.data.thumbnail.path);
      }
    }

    if (editHistory && editHistory.length) {
      await Promise.all(
        editHistory.map(async edit => {
          if (edit.bodyAttachment) {
            await deleteAttachmentData(edit.bodyAttachment);
          }

          if (!edit.attachments || !edit.attachments.length) {
            return;
          }
          return Promise.all(edit.attachments.map(deleteAttachmentData));
        })
      );
      await Promise.all(
        editHistory.map(edit => deletePreviews(edit.preview, deleteOnDisk))
      );
    }
  };
};

export async function migrateBodyAttachmentToDisk(
  message: MessageAttributesType,
  { logger, writeNewAttachmentData }: ContextType
): Promise<MessageAttributesType> {
  const logId = `Message2.toVersion13(${message.sent_at})`;

  // if there is already a bodyAttachment, nothing to do
  if (message.bodyAttachment) {
    return message;
  }

  if (!message.body || !isBodyTooLong(message.body)) {
    return message;
  }

  logger.info(`${logId}: Writing bodyAttachment to disk`);

  const bodyAttachment = {
    contentType: LONG_MESSAGE,
    ...(await writeNewAttachmentData(Bytes.fromString(message.body))),
  };

  return {
    ...message,
    bodyAttachment,
  };
}

async function deletePreviews(
  preview: MessageAttributesType['preview'],
  deleteOnDisk: (path: string) => Promise<void>
): Promise<Array<void>> {
  if (!preview) {
    return [];
  }

  return Promise.all(
    preview.map(async item => {
      const { image } = item;

      if (image && image.path) {
        await deleteOnDisk(image.path);
      }

      if (image?.thumbnail?.path) {
        await deleteOnDisk(image.thumbnail.path);
      }
    })
  );
}

export const isUserMessage = (message: MessageAttributesType): boolean =>
  message.type === 'incoming' || message.type === 'outgoing';

export const hasExpiration = (message: MessageAttributesType): boolean => {
  if (!isUserMessage(message)) {
    return false;
  }

  const { expireTimer } = message;

  return typeof expireTimer === 'number' && expireTimer > 0;
};
