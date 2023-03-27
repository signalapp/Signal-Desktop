// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType, ThumbnailType } from '../types/Attachment';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import type { MIMEType } from '../types/MIME';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { StickerType } from '../types/Stickers';
import { IMAGE_JPEG, IMAGE_GIF } from '../types/MIME';
import { getContact } from '../messages/helpers';
import { getQuoteBodyText } from './getQuoteBodyText';
import { isGIF } from '../types/Attachment';
import { isGiftBadge, isTapToView } from '../state/selectors/message';
import { map, take, collect } from './iterables';
import { strictAssert } from './assert';

export async function makeQuote(
  quotedMessage: MessageAttributesType
): Promise<QuotedMessageType> {
  const contact = getContact(quotedMessage);

  strictAssert(contact, 'makeQuote: no contact');

  const {
    attachments,
    bodyRanges,
    editMessageTimestamp,
    id: messageId,
    payment,
    preview,
    sticker,
  } = quotedMessage;

  const quoteId = editMessageTimestamp || quotedMessage.sent_at;

  return {
    authorUuid: contact.get('uuid'),
    attachments: isTapToView(quotedMessage)
      ? [{ contentType: IMAGE_JPEG, fileName: null }]
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
): Promise<
  Array<{
    contentType: MIMEType;
    fileName: string | null;
    thumbnail: ThumbnailType | null;
  }>
> {
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
            // Our protos library complains about this field being undefined, so we
            //   force it to null
            fileName: fileName || null,
            thumbnail: null,
          };
        }

        return {
          contentType: isGIFQuote ? IMAGE_GIF : contentType,
          // Our protos library complains about this field being undefined, so we force
          //   it to null
          fileName: fileName || null,
          thumbnail: thumbnail
            ? {
                ...(await loadAttachmentData(thumbnail)),
                objectUrl: thumbnail.path
                  ? getAbsoluteAttachmentPath(thumbnail.path)
                  : undefined,
              }
            : null,
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
          // Our protos library complains about this field being undefined, so we
          //   force it to null
          fileName: null,
          thumbnail: image
            ? {
                ...(await loadAttachmentData(image)),
                objectUrl: image.path
                  ? getAbsoluteAttachmentPath(image.path)
                  : undefined,
              }
            : null,
        };
      })
    );
  }

  if (sticker && sticker.data && sticker.data.path) {
    const { path, contentType } = sticker.data;

    return [
      {
        contentType,
        // Our protos library complains about this field being undefined, so we
        //   force it to null
        fileName: null,
        thumbnail: {
          ...(await loadAttachmentData(sticker.data)),
          objectUrl: path ? getAbsoluteAttachmentPath(path) : undefined,
        },
      },
    ];
  }

  return [];
}
