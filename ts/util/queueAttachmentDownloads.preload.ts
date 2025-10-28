// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { isAudio, isImage, isLongMessage, isVideo } from '../types/MIME.std.js';
import { getMessageIdForLogging } from './idForLogging.preload.js';
import {
  copyStickerToAttachments,
  savePackMetadata,
  getStickerPackStatus,
} from '../types/Stickers.preload.js';
import { DataWriter } from '../sql/Client.preload.js';

import type { AttachmentType, ThumbnailType } from '../types/Attachment.std.js';
import type { EmbeddedContactType } from '../types/EmbeddedContact.std.js';
import type {
  EditHistoryType,
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d.ts';
import * as Errors from '../types/errors.std.js';
import {
  isDownloading,
  isDownloaded,
  isVoiceMessage,
  partitionBodyAndNormalAttachments,
  getCachedAttachmentBySignature,
  cacheAttachmentBySignature,
  getUndownloadedAttachmentSignature,
} from './Attachment.std.js';
import { AttachmentDownloadUrgency } from '../types/AttachmentDownload.std.js';
import type { StickerType } from '../types/Stickers.preload.js';
import type { LinkPreviewType } from '../types/message/LinkPreviews.std.js';
import { strictAssert } from './assert.std.js';
import { isNotNil } from './isNotNil.std.js';
import { AttachmentDownloadManager } from '../jobs/AttachmentDownloadManager.preload.js';
import { AttachmentDownloadSource } from '../sql/Interface.std.js';
import type { MessageModel } from '../models/messages.preload.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import { isOutgoing, isStory } from '../messages/helpers.std.js';
import { shouldDownloadStory } from './shouldDownloadStory.preload.js';
import { hasAttachmentDownloads } from './hasAttachmentDownloads.std.js';
import {
  addToAttachmentDownloadQueue,
  shouldUseAttachmentDownloadQueue,
} from './attachmentDownloadQueue.preload.js';
import { queueUpdateMessage } from './messageBatcher.preload.js';
import type { LoggerType } from '../types/Logging.std.js';
import {
  itemStorage,
  DEFAULT_AUTO_DOWNLOAD_ATTACHMENT,
} from '../textsecure/Storage.preload.js';

const defaultLogger = createLogger('queueAttachmentDownloads');

export type MessageAttachmentsDownloadedType = {
  bodyAttachment?: AttachmentType;
  attachments: ReadonlyArray<AttachmentType>;
  editHistory?: ReadonlyArray<EditHistoryType>;
  preview: ReadonlyArray<LinkPreviewType>;
  contact: ReadonlyArray<EmbeddedContactType>;
  quote?: QuotedMessageType;
  sticker?: StickerType;
};

function getLogger(source: AttachmentDownloadSource) {
  const verbose =
    source !== AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA &&
    source !== AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA;
  const log = verbose ? defaultLogger : { ...defaultLogger, info: () => null };
  return log;
}

export async function handleAttachmentDownloadsForNewMessage(
  message: MessageModel,
  conversation: ConversationModel
): Promise<void> {
  const logId =
    `handleAttachmentDownloadsForNewMessage/${conversation.idForLogging()} ` +
    `${getMessageIdForLogging(message.attributes)}`;

  // Only queue attachments for downloads if this is a story (with additional logic), or
  // if it's either an outgoing message or we've accepted the conversation
  let shouldQueueForDownload = false;
  if (isStory(message.attributes)) {
    shouldQueueForDownload = await shouldDownloadStory(conversation.attributes);
  } else {
    shouldQueueForDownload =
      hasAttachmentDownloads(message.attributes) &&
      (conversation.getAccepted() || isOutgoing(message.attributes));
  }

  if (shouldQueueForDownload) {
    if (shouldUseAttachmentDownloadQueue()) {
      addToAttachmentDownloadQueue(logId, message);
    } else {
      await queueAttachmentDownloadsAndMaybeSaveMessage(message, {
        isManualDownload: false,
      });
    }
  }
}

export async function queueAttachmentDownloadsAndMaybeSaveMessage(
  message: MessageModel,
  options: {
    isManualDownload: boolean;
    urgency?: AttachmentDownloadUrgency;
    signaturesToQueue?: Set<string>;
    source?: AttachmentDownloadSource;
  }
): Promise<void> {
  const updated = await queueAttachmentDownloads(message, options);
  if (!updated) {
    return;
  }

  await queueUpdateMessage(message.attributes);
}

// Receive logic
// NOTE: If you're changing any logic in this function that deals with the
// count then you'll also have to modify ./hasAttachmentsDownloads
export async function queueAttachmentDownloads(
  message: MessageModel,
  {
    isManualDownload,
    source = AttachmentDownloadSource.STANDARD,
    signaturesToQueue,
    urgency = AttachmentDownloadUrgency.STANDARD,
  }: {
    isManualDownload: boolean;
    signaturesToQueue?: Set<string>;
    source?: AttachmentDownloadSource;
    urgency?: AttachmentDownloadUrgency;
  }
): Promise<boolean> {
  function shouldQueueAttachmentBasedOnSignature(
    attachment: AttachmentType
  ): boolean {
    if (!signaturesToQueue) {
      return true;
    }
    return signaturesToQueue.has(
      getUndownloadedAttachmentSignature(attachment)
    );
  }

  const autoDownloadAttachment = itemStorage.get(
    'auto-download-attachment',
    DEFAULT_AUTO_DOWNLOAD_ATTACHMENT
  );

  const messageId = message.id;
  const idForLogging = getMessageIdForLogging(message.attributes);

  let count = 0;

  const logId = `queueAttachmentDownloads(${idForLogging}})`;
  const log = getLogger(source);

  message.set(
    ensureBodyAttachmentsAreSeparated(message.attributes, {
      logId,
      logger: log,
    })
  );

  const bodyAttachmentsToDownload = [
    message.get('bodyAttachment'),
    ...(message
      .get('editHistory')
      ?.slice(1) // first entry is the same as the root level message!
      .map(editHistory => editHistory.bodyAttachment) ?? []),
  ]
    .filter(isNotNil)
    .filter(shouldQueueAttachmentBasedOnSignature)
    .filter(attachment => !isDownloaded(attachment));

  if (bodyAttachmentsToDownload.length) {
    log.info(
      `${logId}: Queueing ${bodyAttachmentsToDownload.length} long message attachment download`
    );
    await Promise.all(
      bodyAttachmentsToDownload.map(attachment =>
        AttachmentDownloadManager.addJob({
          attachment,
          attachmentType: 'long-message',
          isManualDownload,
          messageId,
          receivedAt: message.get('received_at'),
          sentAt: message.get('sent_at'),
          source,
          urgency,
        })
      )
    );
    count += bodyAttachmentsToDownload.length;
  }

  const startingAttachments = message.get('attachments') || [];
  const { attachments, count: attachmentsCount } = await queueNormalAttachments(
    {
      attachments: startingAttachments,
      isManualDownload,
      logId,
      messageId,
      otherAttachments: message
        .get('editHistory')
        ?.flatMap(x => x.attachments ?? []),
      receivedAt: message.get('received_at'),
      sentAt: message.get('sent_at'),
      source,
      urgency,
      shouldQueueAttachmentBasedOnSignature,
    }
  );

  if (attachmentsCount > 0) {
    message.set({ attachments });
  }
  if (startingAttachments.length > 0) {
    log.info(
      `${logId}: Queued ${attachmentsCount} (of ${startingAttachments.length}) normal attachment downloads`
    );
  }
  count += attachmentsCount;

  const previews = message.get('preview') || [];
  const { preview, count: previewCount } = await queuePreviews({
    logId,
    isManualDownload,
    messageId,
    previews,
    otherPreviews: message.get('editHistory')?.flatMap(x => x.preview ?? []),
    receivedAt: message.get('received_at'),
    sentAt: message.get('sent_at'),
    urgency,
    source,
    shouldQueueAttachmentBasedOnSignature,
  });
  if (previewCount > 0) {
    message.set({ preview });
  }
  if (previews.length > 0) {
    log.info(
      `${logId}: Queued ${previewCount} (of ${previews.length}) preview attachment downloads`
    );
  }
  count += previewCount;

  const numQuoteAttachments = message.get('quote')?.attachments?.length ?? 0;
  const { quote, count: thumbnailCount } = await queueQuoteAttachments({
    logId,
    isManualDownload,
    messageId,
    otherQuotes:
      message
        .get('editHistory')
        ?.map(x => x.quote)
        .filter(isNotNil) ?? [],
    quote: message.get('quote'),
    receivedAt: message.get('received_at'),
    sentAt: message.get('sent_at'),
    source,
    urgency,
    shouldQueueAttachmentBasedOnSignature,
  });
  if (thumbnailCount > 0) {
    message.set({ quote });
  }
  if (numQuoteAttachments > 0) {
    log.info(
      `${logId}: Queued ${thumbnailCount} (of ${numQuoteAttachments}) quote attachment downloads`
    );
  }
  count += thumbnailCount;

  const contactsToQueue = message.get('contact') || [];
  let avatarCount = 0;
  const contact = await Promise.all(
    contactsToQueue.map(async item => {
      if (!item.avatar || !item.avatar.avatar) {
        return item;
      }

      if (!shouldQueueAttachmentBasedOnSignature(item.avatar.avatar)) {
        return item;
      }

      // We've already downloaded this!
      if (item.avatar.avatar.path) {
        log.info(`${logId}: Contact attachment already downloaded`);
        return item;
      }

      if (!isManualDownload) {
        if (autoDownloadAttachment.photos === false) {
          return item;
        }
      }

      avatarCount += 1;
      return {
        ...item,
        avatar: {
          ...item.avatar,
          avatar: await AttachmentDownloadManager.addJob({
            attachment: item.avatar.avatar,
            attachmentType: 'contact',
            isManualDownload,
            messageId,
            receivedAt: message.get('received_at'),
            sentAt: message.get('sent_at'),
            source,
            urgency,
          }),
        },
      };
    })
  );
  if (avatarCount > 0) {
    message.set({ contact });
  }
  if (contactsToQueue.length > 0) {
    log.info(
      `${logId}: Queued ${avatarCount} (of ${contactsToQueue.length}) contact attachment downloads`
    );
  }
  count += avatarCount;

  let sticker = message.get('sticker');
  let copiedSticker = false;
  if (sticker && sticker.data && sticker.data.path) {
    log.info(`${logId}: Sticker attachment already downloaded`);
  } else if (sticker) {
    const { packId, stickerId, packKey } = sticker;

    const status = getStickerPackStatus(packId);

    if (status && (status === 'downloaded' || status === 'installed')) {
      try {
        log.info(`${logId}: Copying sticker from installed pack`);
        copiedSticker = true;
        count += 1;
        const data = await copyStickerToAttachments(packId, stickerId);

        // Refresh sticker attachment since we had to await above
        const freshSticker = message.get('sticker');
        strictAssert(freshSticker != null, 'Sticker is gone while copying');
        sticker = {
          ...freshSticker,
          data,
        };
        message.set({
          sticker,
        });
      } catch (error) {
        log.error(
          `${logId}: Problem copying sticker (${packId}, ${stickerId}) to attachments:`,
          Errors.toLogFormat(error)
        );
      }
    }

    if (!copiedSticker) {
      if (sticker.data) {
        if (shouldQueueAttachmentBasedOnSignature(sticker.data)) {
          log.info(`${logId}: Queueing sticker download`);
          count += 1;
          await AttachmentDownloadManager.addJob({
            attachment: sticker.data,
            attachmentType: 'sticker',
            isManualDownload,
            messageId,
            receivedAt: message.get('received_at'),
            sentAt: message.get('sent_at'),
            source,
            urgency,
          });
        }
      } else {
        log.error(`${logId}: Sticker data was missing`);
      }
    }
    const stickerRef = {
      messageId,
      packId,
      stickerId,
      isUnresolved: sticker.data?.error === true,
    };
    if (!status) {
      // Save the packId/packKey for future download/install
      await savePackMetadata(packId, packKey, stickerRef);
    } else {
      await DataWriter.addStickerPackReference(stickerRef);
    }
  }

  let editHistory = message.get('editHistory');

  let allEditsAttachmentCount = 0;
  if (editHistory) {
    log.info(`${logId}: Looping through ${editHistory.length} edits`);
    editHistory = await Promise.all(
      editHistory.map(async edit => {
        const { attachments: editAttachments, count: editAttachmentsCount } =
          await queueNormalAttachments({
            attachments: edit.attachments,
            isManualDownload,
            logId,
            messageId,
            otherAttachments: attachments,
            receivedAt: message.get('received_at'),
            sentAt: message.get('sent_at'),
            source,
            urgency,
            shouldQueueAttachmentBasedOnSignature,
          });
        count += editAttachmentsCount;
        allEditsAttachmentCount += editAttachmentsCount;
        if (editAttachments.length !== 0) {
          log.info(
            `${logId}: Queued ${editAttachmentsCount} (of ${edit.attachments?.length ?? 0}) ` +
              `normal attachment downloads (edited:${edit.timestamp})`
          );
        }

        const { preview: editPreview, count: editPreviewCount } =
          await queuePreviews({
            logId,
            isManualDownload,
            messageId,
            previews: edit.preview,
            otherPreviews: preview,
            receivedAt: message.get('received_at'),
            sentAt: message.get('sent_at'),
            urgency,
            source,
            shouldQueueAttachmentBasedOnSignature,
          });
        count += editPreviewCount;
        allEditsAttachmentCount += editPreviewCount;
        if (editPreview.length !== 0) {
          log.info(
            `${logId}: Queued ${editPreviewCount} (of ${edit.preview?.length ?? 0}) ` +
              `preview attachment downloads (edited:${edit.timestamp})`
          );
        }

        return {
          ...edit,
          attachments: editAttachments,
          preview: editPreview,
        };
      })
    );
  }
  if (allEditsAttachmentCount > 0) {
    message.set({ editHistory });
  }

  if (count <= 0) {
    return false;
  }

  log.info(`${logId}: Queued ${count} total attachment downloads`);

  return true;
}

export async function queueNormalAttachments({
  attachments = [],
  isManualDownload,
  logId,
  messageId,
  otherAttachments,
  receivedAt,
  sentAt,
  source,
  urgency,
  shouldQueueAttachmentBasedOnSignature,
}: {
  attachments: MessageAttributesType['attachments'];
  isManualDownload: boolean;
  logId: string;
  messageId: string;
  otherAttachments: MessageAttributesType['attachments'];
  receivedAt: number;
  sentAt: number;
  source: AttachmentDownloadSource;
  urgency: AttachmentDownloadUrgency;
  shouldQueueAttachmentBasedOnSignature: (
    attachment: AttachmentType
  ) => boolean;
}): Promise<{
  attachments: Array<AttachmentType>;
  count: number;
}> {
  const log = getLogger(source);
  // Look through "otherAttachments" which can either be attachments in the
  // edit history or the message's attachments and see if any of the attachments
  // are the same. If they are let's replace it so that we don't download more
  // than once.
  // We don't also register the signatures for "attachments" because they would
  // then not be added to the AttachmentDownloads job.
  const attachmentSignatures: Map<string, AttachmentType> = new Map();
  otherAttachments?.forEach(attachment => {
    cacheAttachmentBySignature(attachmentSignatures, attachment);
  });

  let count = 0;
  const nextAttachments = await Promise.all(
    attachments.map(attachment => {
      if (!attachment) {
        return attachment;
      }

      if (!shouldQueueAttachmentBasedOnSignature(attachment)) {
        return attachment;
      }

      if (isLongMessage(attachment.contentType)) {
        throw new Error(
          `${logId}: queueNormalAttachments passed long-message attachment`
        );
      }

      // We've already downloaded this!
      if (isDownloaded(attachment)) {
        log.info(`${logId}: Normal attachment already downloaded`);
        return attachment;
      }

      const existingAttachment = getCachedAttachmentBySignature(
        attachmentSignatures,
        attachment
      );

      // We've already downloaded this elsewhere!
      if (
        existingAttachment &&
        (isDownloading(existingAttachment) || isDownloaded(existingAttachment))
      ) {
        log.info(
          `${logId}: Normal attachment already downloaded in other attachments. Replacing`
        );
        // Incrementing count so that we update the message's fields downstream
        count += 1;
        return existingAttachment;
      }

      const { contentType } = attachment;
      if (!isManualDownload) {
        const autoDownloadAttachment = itemStorage.get(
          'auto-download-attachment',
          DEFAULT_AUTO_DOWNLOAD_ATTACHMENT
        );

        if (isVideo(contentType)) {
          if (autoDownloadAttachment.videos === false) {
            return attachment;
          }
        } else if (isImage(contentType)) {
          if (autoDownloadAttachment.photos === false) {
            return attachment;
          }
        } else if (isAudio(contentType)) {
          if (
            autoDownloadAttachment.audio === false &&
            !isVoiceMessage(attachment)
          ) {
            return attachment;
          }
        } else if (autoDownloadAttachment.documents === false) {
          return attachment;
        }
      }

      count += 1;

      return AttachmentDownloadManager.addJob({
        attachment,
        attachmentType: 'attachment',
        isManualDownload,
        messageId,
        receivedAt,
        sentAt,
        source,
        urgency,
      });
    })
  );

  return {
    attachments: nextAttachments,
    count,
  };
}

async function queuePreviews({
  isManualDownload,
  logId,
  messageId,
  otherPreviews,
  previews = [],
  receivedAt,
  sentAt,
  source,
  urgency,
  shouldQueueAttachmentBasedOnSignature,
}: {
  isManualDownload: boolean;
  logId: string;
  messageId: string;
  otherPreviews: MessageAttributesType['preview'];
  previews: MessageAttributesType['preview'];
  receivedAt: number;
  sentAt: number;
  source: AttachmentDownloadSource;
  urgency: AttachmentDownloadUrgency;
  shouldQueueAttachmentBasedOnSignature: (
    attachment: AttachmentType
  ) => boolean;
}): Promise<{ preview: Array<LinkPreviewType>; count: number }> {
  const log = getLogger(source);
  const previewSignatures: Map<string, AttachmentType> = new Map();
  otherPreviews?.forEach(preview => {
    if (preview.image) {
      cacheAttachmentBySignature(previewSignatures, preview.image);
    }
  });

  let count = 0;

  const preview = await Promise.all(
    previews.map(async item => {
      if (!item.image) {
        return item;
      }

      if (!shouldQueueAttachmentBasedOnSignature(item.image)) {
        return item;
      }

      // We've already downloaded this!
      if (isDownloaded(item.image)) {
        log.info(`${logId}: Preview attachment already downloaded`);
        return item;
      }

      const existingPreviewImage = getCachedAttachmentBySignature(
        previewSignatures,
        item.image
      );

      // We've already downloaded this elsewhere!
      if (
        existingPreviewImage &&
        (isDownloading(existingPreviewImage) ||
          isDownloaded(existingPreviewImage))
      ) {
        log.info(`${logId}: Preview already downloaded elsewhere. Replacing`);
        // Incrementing count so that we update the message's fields downstream
        count += 1;
        return { ...item, image: existingPreviewImage };
      }

      if (!isManualDownload) {
        const autoDownloadAttachment = itemStorage.get(
          'auto-download-attachment',
          DEFAULT_AUTO_DOWNLOAD_ATTACHMENT
        );

        if (autoDownloadAttachment.photos === false) {
          return item;
        }
      }

      count += 1;
      return {
        ...item,
        image: await AttachmentDownloadManager.addJob({
          attachment: item.image,
          attachmentType: 'preview',
          isManualDownload,
          messageId,
          receivedAt,
          sentAt,
          source,
          urgency,
        }),
      };
    })
  );

  return {
    preview,
    count,
  };
}

async function queueQuoteAttachments({
  isManualDownload,
  logId,
  messageId,
  otherQuotes,
  quote,
  receivedAt,
  sentAt,
  source,
  urgency,
  shouldQueueAttachmentBasedOnSignature,
}: {
  logId: string;
  isManualDownload: boolean;
  messageId: string;
  otherQuotes: ReadonlyArray<QuotedMessageType>;
  quote: QuotedMessageType | undefined;
  receivedAt: number;
  sentAt: number;
  source: AttachmentDownloadSource;
  urgency: AttachmentDownloadUrgency;
  shouldQueueAttachmentBasedOnSignature: (
    attachment: AttachmentType
  ) => boolean;
}): Promise<{ quote?: QuotedMessageType; count: number }> {
  const log = getLogger(source);
  let count = 0;
  if (!quote) {
    return { quote, count };
  }

  const quoteAttachmentsToQueue =
    quote && quote.attachments ? quote.attachments : [];
  if (quoteAttachmentsToQueue.length === 0) {
    return { quote, count };
  }

  // Similar to queueNormalAttachments' logic for detecting same attachments
  // except here we also pick by quote sent timestamp.
  const thumbnailSignatures: Map<string, ThumbnailType> = new Map();
  otherQuotes.forEach(otherQuote => {
    for (const attachment of otherQuote.attachments) {
      if (attachment.thumbnail) {
        cacheAttachmentBySignature(thumbnailSignatures, attachment.thumbnail);
      }
    }
  });

  return {
    quote: {
      ...quote,
      attachments: await Promise.all(
        quote.attachments.map(async item => {
          if (!item.thumbnail) {
            return item;
          }

          if (!shouldQueueAttachmentBasedOnSignature(item.thumbnail)) {
            return item;
          }

          if (isDownloaded(item.thumbnail)) {
            log.info(`${logId}: Quote attachment already downloaded`);
            return item;
          }

          const existingThumbnail = getCachedAttachmentBySignature(
            thumbnailSignatures,
            item.thumbnail
          );

          // We've already downloaded this elsewhere!
          if (
            existingThumbnail &&
            (isDownloading(existingThumbnail) ||
              isDownloaded(existingThumbnail))
          ) {
            log.info(
              `${logId}: Preview already downloaded elsewhere. Replacing`
            );
            // Incrementing count so that we update the message's fields downstream
            count += 1;
            return {
              ...item,
              thumbnail: existingThumbnail,
            };
          }

          // Note: we always download quote attachments

          count += 1;
          return {
            ...item,
            thumbnail: await AttachmentDownloadManager.addJob({
              attachment: item.thumbnail,
              attachmentType: 'quote',
              isManualDownload,
              messageId,
              receivedAt,
              sentAt,
              source,
              urgency,
            }),
          };
        })
      ),
    },
    count,
  };
}

export function ensureBodyAttachmentsAreSeparated(
  messageAttributes: MessageAttributesType,
  { logId, logger = defaultLogger }: { logId: string; logger?: LoggerType }
): {
  bodyAttachment: AttachmentType | undefined;
  attachments: Array<AttachmentType>;
  editHistory: Array<EditHistoryType> | undefined;
} {
  const { bodyAttachment, attachments } = partitionBodyAndNormalAttachments(
    {
      attachments: messageAttributes.attachments ?? [],
      existingBodyAttachment: messageAttributes.bodyAttachment,
    },
    { logId, logger }
  );

  const updatedEditHistory = messageAttributes.editHistory?.map(edit => {
    return {
      ...edit,
      ...partitionBodyAndNormalAttachments(
        {
          attachments: edit.attachments ?? [],
          existingBodyAttachment: edit.bodyAttachment,
        },
        {
          logId: `${logId}/editHistory(${edit.timestamp})`,
          logger,
        }
      ),
    };
  });

  return {
    bodyAttachment: bodyAttachment ?? messageAttributes.bodyAttachment,
    attachments,
    editHistory: updatedEditHistory,
  };
}
