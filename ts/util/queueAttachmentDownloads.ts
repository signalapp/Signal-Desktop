// Copyright 2020 Signal Messenger, LLC
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
  EditHistoryType,
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import * as Errors from '../types/errors';
import {
  getAttachmentSignature,
  isDownloading,
  isDownloaded,
} from '../types/Attachment';
import type { StickerType } from '../types/Stickers';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import { isNotNil } from './isNotNil';

export type MessageAttachmentsDownloadedType = {
  bodyAttachment?: AttachmentType;
  attachments: Array<AttachmentType>;
  editHistory?: Array<EditHistoryType>;
  preview: Array<LinkPreviewType>;
  contact: Array<EmbeddedContactType>;
  quote?: QuotedMessageType;
  sticker?: StickerType;
};

function getAttachmentSignatureSafe(
  attachment: AttachmentType
): string | undefined {
  try {
    return getAttachmentSignature(attachment);
  } catch {
    log.warn(
      'queueAttachmentDownloads: attachment was missing digest',
      attachment.blurHash
    );
    return undefined;
  }
}

// Receive logic
// NOTE: If you're changing any logic in this function that deals with the
// count then you'll also have to modify ./hasAttachmentsDownloads
export async function queueAttachmentDownloads(
  message: MessageAttributesType
): Promise<MessageAttachmentsDownloadedType | undefined> {
  const attachmentsToQueue = message.attachments || [];
  const messageId = message.id;
  const idForLogging = getMessageIdForLogging(message);

  let count = 0;
  let bodyAttachment;

  const idLog = `queueAttachmentDownloads(${idForLogging}})`;

  log.info(
    `${idLog}: Queueing ${attachmentsToQueue.length} attachment downloads`
  );

  const [longMessageAttachments, normalAttachments] = partition(
    attachmentsToQueue,
    attachment => isLongMessage(attachment.contentType)
  );

  if (longMessageAttachments.length > 1) {
    log.error(`${idLog}: Received more than one long message attachment`);
  }

  log.info(
    `${idLog}: Queueing ${longMessageAttachments.length} long message attachment downloads`
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
    `${idLog}: Queueing ${normalAttachments.length} normal attachment downloads`
  );
  const { attachments, count: attachmentsCount } = await queueNormalAttachments(
    idLog,
    messageId,
    normalAttachments,
    message.editHistory?.flatMap(x => x.attachments ?? [])
  );
  count += attachmentsCount;

  const previewsToQueue = message.preview || [];
  log.info(
    `${idLog}: Queueing ${previewsToQueue.length} preview attachment downloads`
  );
  const { preview, count: previewCount } = await queuePreviews(
    idLog,
    messageId,
    previewsToQueue,
    message.editHistory?.flatMap(x => x.preview ?? [])
  );
  count += previewCount;

  log.info(
    `${idLog}: Queueing ${message.quote?.attachments?.length ?? 0} ` +
      'quote attachment downloads'
  );
  const { quote, count: thumbnailCount } = await queueQuoteAttachments(
    idLog,
    messageId,
    message.quote,
    message.editHistory?.map(x => x.quote).filter(isNotNil) ?? []
  );
  count += thumbnailCount;

  const contactsToQueue = message.contact || [];
  log.info(
    `${idLog}: Queueing ${contactsToQueue.length} contact attachment downloads`
  );
  const contact = await Promise.all(
    contactsToQueue.map(async (item, index) => {
      if (!item.avatar || !item.avatar.avatar) {
        return item;
      }
      // We've already downloaded this!
      if (item.avatar.avatar.path) {
        log.info(`${idLog}: Contact attachment already downloaded`);
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

  let { sticker } = message;
  if (sticker && sticker.data && sticker.data.path) {
    log.info(`${idLog}: Sticker attachment already downloaded`);
  } else if (sticker) {
    log.info(`${idLog}: Queueing sticker download`);
    count += 1;
    const { packId, stickerId, packKey } = sticker;

    const status = getStickerPackStatus(packId);
    let data: AttachmentType | undefined;

    if (status && (status === 'downloaded' || status === 'installed')) {
      try {
        data = await copyStickerToAttachments(packId, stickerId);
      } catch (error) {
        log.error(
          `${idLog}: Problem copying sticker (${packId}, ${stickerId}) to attachments:`,
          Errors.toLogFormat(error)
        );
      }
    }
    if (!data) {
      if (sticker.data) {
        data = await AttachmentDownloads.addJob(sticker.data, {
          messageId,
          type: 'sticker',
          index: 0,
        });
      } else {
        log.error(`${idLog}: Sticker data was missing`);
      }
    }
    if (!status) {
      // Save the packId/packKey for future download/install
      void savePackMetadata(packId, packKey, { messageId });
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

  let { editHistory } = message;
  if (editHistory) {
    log.info(`${idLog}: Looping through ${editHistory.length} edits`);
    editHistory = await Promise.all(
      editHistory.map(async edit => {
        const { attachments: editAttachments, count: editAttachmentsCount } =
          await queueNormalAttachments(
            idLog,
            messageId,
            edit.attachments,
            attachments
          );
        count += editAttachmentsCount;
        if (editAttachmentsCount !== 0) {
          log.info(
            `${idLog}: Queueing ${editAttachmentsCount} normal attachment ` +
              `downloads (edited:${edit.timestamp})`
          );
        }

        const { preview: editPreview, count: editPreviewCount } =
          await queuePreviews(idLog, messageId, edit.preview, preview);
        count += editPreviewCount;
        if (editPreviewCount !== 0) {
          log.info(
            `${idLog}: Queueing ${editPreviewCount} preview attachment ` +
              `downloads (edited:${edit.timestamp})`
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

  log.info(`${idLog}: Queued ${count} total attachment downloads`);

  if (count <= 0) {
    return;
  }

  return {
    attachments,
    bodyAttachment,
    contact,
    editHistory,
    preview,
    quote,
    sticker,
  };
}

async function queueNormalAttachments(
  idLog: string,
  messageId: string,
  attachments: MessageAttributesType['attachments'] = [],
  otherAttachments: MessageAttributesType['attachments']
): Promise<{
  attachments: Array<AttachmentType>;
  count: number;
}> {
  // Look through "otherAttachments" which can either be attachments in the
  // edit history or the message's attachments and see if any of the attachments
  // are the same. If they are let's replace it so that we don't download more
  // than once.
  // We don't also register the signatures for "attachments" because they would
  // then not be added to the AttachmentDownloads job.
  const attachmentSignatures: Map<string, AttachmentType> = new Map();
  otherAttachments?.forEach(attachment => {
    const signature = getAttachmentSignatureSafe(attachment);
    if (signature) {
      attachmentSignatures.set(signature, attachment);
    }
  });

  let count = 0;
  const nextAttachments = await Promise.all(
    attachments.map((attachment, index) => {
      if (!attachment) {
        return attachment;
      }
      // We've already downloaded this!
      if (isDownloaded(attachment)) {
        log.info(`${idLog}: Normal attachment already downloaded`);
        return attachment;
      }

      const signature = getAttachmentSignatureSafe(attachment);
      const existingAttachment = signature
        ? attachmentSignatures.get(signature)
        : undefined;

      // We've already downloaded this elsewhere!
      if (
        existingAttachment &&
        (isDownloading(existingAttachment) || isDownloaded(existingAttachment))
      ) {
        log.info(
          `${idLog}: Normal attachment already downloaded in other attachments. Replacing`
        );
        // Incrementing count so that we update the message's fields downstream
        count += 1;
        return existingAttachment;
      }

      count += 1;

      return AttachmentDownloads.addJob(attachment, {
        messageId,
        type: 'attachment',
        index,
      });
    })
  );

  return {
    attachments: nextAttachments,
    count,
  };
}

function getLinkPreviewSignature(preview: LinkPreviewType): string | undefined {
  const { image, url } = preview;

  if (!image) {
    return;
  }

  const signature = getAttachmentSignatureSafe(image);
  if (!signature) {
    return;
  }

  return `<${url}>${signature}`;
}

async function queuePreviews(
  idLog: string,
  messageId: string,
  previews: MessageAttributesType['preview'] = [],
  otherPreviews: MessageAttributesType['preview']
): Promise<{ preview: Array<LinkPreviewType>; count: number }> {
  // Similar to queueNormalAttachments' logic for detecting same attachments
  // except here we also pick by link preview URL.
  const previewSignatures: Map<string, LinkPreviewType> = new Map();
  otherPreviews?.forEach(preview => {
    const signature = getLinkPreviewSignature(preview);
    if (!signature) {
      return;
    }
    previewSignatures.set(signature, preview);
  });

  let count = 0;

  const preview = await Promise.all(
    previews.map(async (item, index) => {
      if (!item.image) {
        return item;
      }
      // We've already downloaded this!
      if (isDownloaded(item.image)) {
        log.info(`${idLog}: Preview attachment already downloaded`);
        return item;
      }
      const signature = getLinkPreviewSignature(item);
      const existingPreview = signature
        ? previewSignatures.get(signature)
        : undefined;

      // We've already downloaded this elsewhere!
      if (
        existingPreview &&
        (isDownloading(existingPreview.image) ||
          isDownloaded(existingPreview.image))
      ) {
        log.info(`${idLog}: Preview already downloaded elsewhere. Replacing`);
        // Incrementing count so that we update the message's fields downstream
        count += 1;
        return existingPreview;
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

  return {
    preview,
    count,
  };
}

function getQuoteThumbnailSignature(
  quote: QuotedMessageType,
  thumbnail?: AttachmentType
): string | undefined {
  if (!thumbnail) {
    return undefined;
  }
  const signature = getAttachmentSignatureSafe(thumbnail);
  if (!signature) {
    return;
  }
  return `<${quote.id}>${signature}`;
}

async function queueQuoteAttachments(
  idLog: string,
  messageId: string,
  quote: QuotedMessageType | undefined,
  otherQuotes: ReadonlyArray<QuotedMessageType>
): Promise<{ quote?: QuotedMessageType; count: number }> {
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
  const thumbnailSignatures: Map<string, AttachmentType> = new Map();
  otherQuotes.forEach(otherQuote => {
    for (const attachment of otherQuote.attachments) {
      const signature = getQuoteThumbnailSignature(
        otherQuote,
        attachment.thumbnail
      );
      if (!signature) {
        continue;
      }
      thumbnailSignatures.set(signature, attachment);
    }
  });

  return {
    quote: {
      ...quote,
      attachments: await Promise.all(
        quote.attachments.map(async (item, index) => {
          if (!item.thumbnail) {
            return item;
          }
          // We've already downloaded this!
          if (isDownloaded(item.thumbnail)) {
            log.info(`${idLog}: Quote attachment already downloaded`);
            return item;
          }

          const signature = getQuoteThumbnailSignature(quote, item.thumbnail);
          const existingThumbnail = signature
            ? thumbnailSignatures.get(signature)
            : undefined;

          // We've already downloaded this elsewhere!
          if (
            existingThumbnail &&
            (isDownloading(existingThumbnail) ||
              isDownloaded(existingThumbnail))
          ) {
            log.info(
              `${idLog}: Preview already downloaded elsewhere. Replacing`
            );
            // Incrementing count so that we update the message's fields downstream
            count += 1;
            return {
              ...item,
              thumbnail: existingThumbnail,
            };
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
    },
    count,
  };
}
