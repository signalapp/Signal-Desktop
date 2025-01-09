// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type {
  MessageAttributesType,
  QuotedAttachmentType,
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
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl';
import type { QuotedMessageForComposerType } from '../state/ducks/composer';

export async function makeQuote(
  quotedMessage: MessageAttributesType
): Promise<QuotedMessageForComposerType['quote']> {
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
  attachments?: ReadonlyArray<AttachmentType>,
  preview?: ReadonlyArray<LinkPreviewType>,
  sticker?: StickerType
): Promise<Array<QuotedAttachmentType>> {
  const { loadAttachmentData } = window.Signal.Migrations;

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
          thumbnail:
            thumbnail && thumbnail.path
              ? {
                  ...(await loadAttachmentData(thumbnail)),
                  objectUrl: getLocalAttachmentUrl(thumbnail),
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
          thumbnail:
            image && image.path
              ? {
                  ...(await loadAttachmentData(image)),
                  objectUrl: getLocalAttachmentUrl(image),
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
        thumbnail: path
          ? {
              ...(await loadAttachmentData(sticker.data)),
              objectUrl: getLocalAttachmentUrl(sticker.data),
            }
          : undefined,
      },
    ];
  }

  return [];
}
