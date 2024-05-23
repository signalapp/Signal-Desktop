// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type {
  MessageAttributesType,
  QuotedAttachmentType,
  QuotedMessageType,
} from '../model-types.d';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { StickerType } from '../types/Stickers';
import { IMAGE_JPEG, IMAGE_GIF } from '../types/MIME';
import { getAuthor } from '../messages/helpers';
import { getQuoteBodyText } from './getQuoteBodyText';
import { isGIF } from '../types/Attachment';
import { isGiftBadge, isTapToView } from '../state/selectors/message';
import * as log from '../logging/log';
import { map, take, collect } from './iterables';
import { strictAssert } from './assert';
import { getMessageSentTimestamp } from './getMessageSentTimestamp';

export async function makeQuote(
  quotedMessage: MessageAttributesType
): Promise<QuotedMessageType> {
  const contact = getAuthor(quotedMessage);

  strictAssert(contact, 'makeQuote: no contact');

  const {
    attachments,
    bodyRanges,
    id: messageId,
    payment,
    preview,
    sticker,
  } = quotedMessage;

  const quoteId = getMessageSentTimestamp(quotedMessage, { log });

  return {
    authorAci: contact.getCheckedAci('makeQuote'),
    attachments: isTapToView(quotedMessage)
      ? [{ contentType: IMAGE_JPEG }]
      : await getQuoteAttachment(attachments, preview, sticker),
    payment,
    bodyRanges,
    id: quoteId,
    isViewOnce: isTapToView(quotedMessage),
    isGiftBadge: isGiftBadge(quotedMessage),
    messageId,
    referencedMessageNotFound: false,
    text: getQuoteBodyText(quotedMessage, quoteId),
  };
}

export async function getQuoteAttachment(
  attachments?: Array<AttachmentType>,
  preview?: Array<LinkPreviewType>,
  sticker?: StickerType
): Promise<Array<QuotedAttachmentType>> {
  const { getAbsoluteAttachmentPath, loadAttachmentData } =
    window.Signal.Migrations;

  if (attachments && attachments.length) {
    const attachmentsToUse = Array.from(take(attachments, 1));
    const isGIFQuote = isGIF(attachmentsToUse);

    return Promise.all(
      map(attachmentsToUse, async attachment => {
        const { path, fileName, thumbnail, contentType } = attachment;

        if (!path) {
          return {
            contentType: isGIFQuote ? IMAGE_GIF : contentType,
            fileName,
            thumbnail,
          };
        }

        return {
          contentType: isGIFQuote ? IMAGE_GIF : contentType,
          fileName,
          thumbnail: thumbnail
            ? {
                ...(await loadAttachmentData(thumbnail)),
                objectUrl: thumbnail.path
                  ? getAbsoluteAttachmentPath(thumbnail.path)
                  : undefined,
              }
            : undefined,
        };
      })
    );
  }

  if (preview && preview.length) {
    const previewImages = collect(preview, prev => prev.image);
    const previewImagesToUse = take(previewImages, 1);

    return Promise.all(
      map(previewImagesToUse, async image => {
        const { contentType } = image;

        return {
          contentType,
          thumbnail: image
            ? {
                ...(await loadAttachmentData(image)),
                objectUrl: image.path
                  ? getAbsoluteAttachmentPath(image.path)
                  : undefined,
              }
            : undefined,
        };
      })
    );
  }

  if (sticker && sticker.data && sticker.data.path) {
    const { path, contentType } = sticker.data;

    return [
      {
        contentType,
        thumbnail: {
          ...(await loadAttachmentData(sticker.data)),
          objectUrl: path ? getAbsoluteAttachmentPath(path) : undefined,
        },
      },
    ];
  }

  return [];
}
