// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.std.ts';
import type {
  MessageAttributesType,
  QuotedAttachmentType,
} from '../model-types.d.ts';
import type { LinkPreviewType } from '../types/message/LinkPreviews.std.ts';
import type { StickerType } from '../types/Stickers.preload.ts';
import { IMAGE_JPEG, IMAGE_GIF } from '../types/MIME.std.ts';
import { getAuthor } from '../messages/sources.preload.ts';
import { getQuoteBodyText } from './getQuoteBodyText.std.ts';
import { isGIF } from './Attachment.std.ts';
import {
  isGiftBadge,
  isTapToView,
} from '../state/selectors/message.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { map, take, collect } from './iterables.std.ts';
import { strictAssert } from './assert.std.ts';
import { loadAttachmentData } from './migrations.preload.ts';
import { getMessageSentTimestamp } from './getMessageSentTimestamp.std.ts';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.ts';
import type { QuotedMessageForComposerType } from '../state/ducks/composer.preload.ts';

const log = createLogger('makeQuote');
const { i18n } = window.SignalContext;

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
    isPoll: quotedMessage.poll != null,
    messageId,
    referencedMessageNotFound: false,
    text: getQuoteBodyText({
      messageAttributes: quotedMessage,
      id: quoteId,
      i18n,
    }),
  };
}

export async function getQuoteAttachment(
  attachments?: ReadonlyArray<AttachmentType>,
  preview?: ReadonlyArray<LinkPreviewType>,
  sticker?: StickerType
): Promise<Array<QuotedAttachmentType>> {
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
                  url: getLocalAttachmentUrl(thumbnail),
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
              url: getLocalAttachmentUrl(sticker.data),
            }
          : undefined,
      },
    ];
  }

  return [];
}
