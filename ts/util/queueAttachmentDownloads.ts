// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { partition } from 'lodash';
import * as AttachmentDownloads from '../messageModifiers/AttachmentDownloads';
import * as log from '../logging/log';
import { isLongMessage } from '../types/MIME';
import { getMessageIdForLogging } from './idForLogging';
import {
  copyStickerToAttachments,
  savePackMetadata,
  getStickerPackStatus,
} from '../types/Stickers';
import dataInterface from '../sql/Client';

import type { AttachmentType } from '../types/Attachment';
import type { EmbeddedContactType } from '../types/EmbeddedContact';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import type { StickerType } from '../types/Stickers';
import type { LinkPreviewType } from '../types/message/LinkPreviews';

type ReturnType = {
  bodyAttachment?: AttachmentType;
  attachments: Array<AttachmentType>;
  preview: Array<LinkPreviewType>;
  contact: Array<EmbeddedContactType>;
  quote?: QuotedMessageType;
  sticker?: StickerType;
};

// Receive logic
// NOTE: If you're changing any logic in this function that deals with the
// count then you'll also have to modify ./hasAttachmentsDownloads
export async function queueAttachmentDownloads(
  message: MessageAttributesType
): Promise<ReturnType | undefined> {
  const attachmentsToQueue = message.attachments || [];
  const messageId = message.id;
  const idForLogging = getMessageIdForLogging(message);

  let count = 0;
  let bodyAttachment;

  log.info(
    `Queueing ${attachmentsToQueue.length} attachment downloads for message ${idForLogging}`
  );

  const [longMessageAttachments, normalAttachments] = partition(
    attachmentsToQueue,
    attachment => isLongMessage(attachment.contentType)
  );

  if (longMessageAttachments.length > 1) {
    log.error(
      `Received more than one long message attachment in message ${idForLogging}`
    );
  }

  log.info(
    `Queueing ${longMessageAttachments.length} long message attachment downloads for message ${idForLogging}`
  );

  if (longMessageAttachments.length > 0) {
    count += 1;
    [bodyAttachment] = longMessageAttachments;
  }
  if (!bodyAttachment && message.bodyAttachment) {
    count += 1;
    bodyAttachment = message.bodyAttachment;
  }

  if (bodyAttachment) {
    await AttachmentDownloads.addJob(bodyAttachment, {
      messageId,
      type: 'long-message',
      index: 0,
    });
  }

  log.info(
    `Queueing ${normalAttachments.length} normal attachment downloads for message ${idForLogging}`
  );
  const attachments = await Promise.all(
    normalAttachments.map((attachment, index) => {
      if (!attachment) {
        return attachment;
      }
      // We've already downloaded this!
      if (attachment.path || attachment.textAttachment) {
        log.info(
          `Normal attachment already downloaded for message ${idForLogging}`
        );
        return attachment;
      }

      count += 1;

      return AttachmentDownloads.addJob(attachment, {
        messageId,
        type: 'attachment',
        index,
      });
    })
  );

  const previewsToQueue = message.preview || [];
  log.info(
    `Queueing ${previewsToQueue.length} preview attachment downloads for message ${idForLogging}`
  );
  const preview = await Promise.all(
    previewsToQueue.map(async (item, index) => {
      if (!item.image) {
        return item;
      }
      // We've already downloaded this!
      if (item.image.path) {
        log.info(
          `Preview attachment already downloaded for message ${idForLogging}`
        );
        return item;
      }

      count += 1;
      return {
        ...item,
        image: await AttachmentDownloads.addJob(item.image, {
          messageId,
          type: 'preview',
          index,
        }),
      };
    })
  );

  const contactsToQueue = message.contact || [];
  log.info(
    `Queueing ${contactsToQueue.length} contact attachment downloads for message ${idForLogging}`
  );
  const contact = await Promise.all(
    contactsToQueue.map(async (item, index) => {
      if (!item.avatar || !item.avatar.avatar) {
        return item;
      }
      // We've already downloaded this!
      if (item.avatar.avatar.path) {
        log.info(
          `Contact attachment already downloaded for message ${idForLogging}`
        );
        return item;
      }

      count += 1;
      return {
        ...item,
        avatar: {
          ...item.avatar,
          avatar: await AttachmentDownloads.addJob(item.avatar.avatar, {
            messageId,
            type: 'contact',
            index,
          }),
        },
      };
    })
  );

  let { quote } = message;
  const quoteAttachmentsToQueue =
    quote && quote.attachments ? quote.attachments : [];
  log.info(
    `Queueing ${quoteAttachmentsToQueue.length} quote attachment downloads for message ${idForLogging}`
  );
  if (quote && quoteAttachmentsToQueue.length > 0) {
    quote = {
      ...quote,
      attachments: await Promise.all(
        (quote?.attachments || []).map(async (item, index) => {
          if (!item.thumbnail) {
            return item;
          }
          // We've already downloaded this!
          if (item.thumbnail.path) {
            log.info(
              `Quote attachment already downloaded for message ${idForLogging}`
            );
            return item;
          }

          count += 1;
          return {
            ...item,
            thumbnail: await AttachmentDownloads.addJob(item.thumbnail, {
              messageId,
              type: 'quote',
              index,
            }),
          };
        })
      ),
    };
  }

  let { sticker } = message;
  if (sticker && sticker.data && sticker.data.path) {
    log.info(
      `Sticker attachment already downloaded for message ${idForLogging}`
    );
  } else if (sticker) {
    log.info(`Queueing sticker download for message ${idForLogging}`);
    count += 1;
    const { packId, stickerId, packKey } = sticker;

    const status = getStickerPackStatus(packId);
    let data: AttachmentType | undefined;

    if (status && (status === 'downloaded' || status === 'installed')) {
      try {
        data = await copyStickerToAttachments(packId, stickerId);
      } catch (error) {
        log.error(
          `Problem copying sticker (${packId}, ${stickerId}) to attachments:`,
          error && error.stack ? error.stack : error
        );
      }
    }
    if (!data && sticker.data) {
      data = await AttachmentDownloads.addJob(sticker.data, {
        messageId,
        type: 'sticker',
        index: 0,
      });
    }
    if (!status) {
      // Save the packId/packKey for future download/install
      savePackMetadata(packId, packKey, { messageId });
    } else {
      await dataInterface.addStickerPackReference(messageId, packId);
    }

    if (!data) {
      throw new Error('queueAttachmentDownloads: Failed to fetch sticker data');
    }

    sticker = {
      ...sticker,
      packId,
      data,
    };
  }

  log.info(
    `Queued ${count} total attachment downloads for message ${idForLogging}`
  );

  if (count <= 0) {
    return;
  }

  return {
    bodyAttachment,
    attachments,
    preview,
    contact,
    quote,
    sticker,
  };
}
