// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { createLogger } from '../logging/log.std.js';
import type { QuotedMessageType } from '../model-types.d.ts';
import { SignalService } from '../protobuf/index.std.js';
import {
  isGiftBadge,
  isTapToView,
} from '../state/selectors/message.preload.js';
import type { ProcessedQuote } from '../textsecure/Types.d.ts';
import { IMAGE_JPEG } from '../types/MIME.std.js';
import { VERSION_NEEDED_FOR_DISPLAY } from '../types/Message2.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { getQuoteBodyText } from '../util/getQuoteBodyText.std.js';
import { isQuoteAMatch } from './quotes.preload.js';
import { messageHasPaymentEvent } from './payments.std.js';
import * as Errors from '../types/errors.std.js';
import type { MessageModel } from '../models/messages.preload.js';
import { isDownloadable } from '../util/Attachment.std.js';

const { omit } = lodash;

const log = createLogger('copyQuote');

export type MinimalMessageCache = Readonly<{
  findBySentAt(
    sentAt: number,
    predicate: (attributes: MessageModel) => boolean
  ): Promise<MessageModel | undefined>;
  upgradeSchema(message: MessageModel, minSchemaVersion: number): Promise<void>;
  register(message: MessageModel): MessageModel;
}>;

export type CopyQuoteOptionsType = Readonly<{
  messageCache?: MinimalMessageCache;
}>;

export const copyFromQuotedMessage = async (
  quote: ProcessedQuote,
  conversationId: string,
  options: CopyQuoteOptionsType = {}
): Promise<QuotedMessageType> => {
  const { messageCache = window.MessageCache } = options;
  const { id } = quote;
  strictAssert(id, 'Quote must have an id');

  const result: QuotedMessageType = {
    ...omit(quote, 'type'),

    id,

    attachments: quote.attachments.slice(),
    bodyRanges: quote.bodyRanges?.slice(),

    // Just placeholder values for the fields
    referencedMessageNotFound: false,
    isGiftBadge: quote.type === SignalService.DataMessage.Quote.Type.GIFT_BADGE,
    isViewOnce: false,
  };

  const queryMessage = await messageCache.findBySentAt(
    id,
    (message: MessageModel) => {
      return isQuoteAMatch(message.attributes, conversationId, result);
    }
  );

  if (queryMessage == null) {
    result.referencedMessageNotFound = true;
    return result;
  }

  if (queryMessage) {
    await copyQuoteContentFromOriginal(queryMessage, result, options);
  }

  return result;
};

export const copyQuoteContentFromOriginal = async (
  message: MessageModel,
  quote: QuotedMessageType,
  { messageCache = window.MessageCache }: CopyQuoteOptionsType = {}
): Promise<void> => {
  const { attachments } = quote;
  const quoteAttachment = attachments ? attachments[0] : undefined;

  if (messageHasPaymentEvent(message.attributes)) {
    // eslint-disable-next-line no-param-reassign
    quote.payment = message.get('payment');
  }

  if (isTapToView(message.attributes)) {
    // eslint-disable-next-line no-param-reassign
    quote.text = undefined;
    // eslint-disable-next-line no-param-reassign
    quote.attachments = [
      {
        contentType: IMAGE_JPEG,
      },
    ];
    // eslint-disable-next-line no-param-reassign
    quote.isViewOnce = true;

    return;
  }

  const isMessageAGiftBadge = isGiftBadge(message.attributes);
  if (isMessageAGiftBadge !== quote.isGiftBadge) {
    log.warn(
      `copyQuoteContentFromOriginal: Quote.isGiftBadge: ${quote.isGiftBadge}, isGiftBadge(message): ${isMessageAGiftBadge}`
    );
    // eslint-disable-next-line no-param-reassign
    quote.isGiftBadge = isMessageAGiftBadge;
  }
  if (isMessageAGiftBadge) {
    // eslint-disable-next-line no-param-reassign
    quote.text = undefined;
    // eslint-disable-next-line no-param-reassign
    quote.attachments = [];

    return;
  }

  // eslint-disable-next-line no-param-reassign
  quote.isViewOnce = false;

  // eslint-disable-next-line no-param-reassign
  quote.text = getQuoteBodyText(message.attributes, quote.id);

  // eslint-disable-next-line no-param-reassign
  quote.bodyRanges = message.attributes.bodyRanges;

  if (!quoteAttachment || !quoteAttachment.contentType) {
    return;
  }

  try {
    await messageCache.upgradeSchema(message, VERSION_NEEDED_FOR_DISPLAY);
  } catch (error) {
    log.error(
      'Problem upgrading message quoted message from database',
      Errors.toLogFormat(error)
    );
    return;
  }

  const {
    attachments: queryAttachments = [],
    preview: queryPreview = [],
    sticker,
  } = message.attributes;

  if (queryAttachments.length > 0) {
    const queryFirst = queryAttachments[0];
    const { thumbnail: quotedThumbnail } = queryFirst;

    if (quotedThumbnail && quotedThumbnail.path) {
      quoteAttachment.thumbnail = {
        ...quotedThumbnail,
        copied: true,
      };
    } else if (!quoteAttachment.thumbnail || !isDownloadable(queryFirst)) {
      quoteAttachment.contentType = queryFirst.contentType;
      quoteAttachment.fileName = queryFirst.fileName;
      quoteAttachment.thumbnail = undefined;
    } else {
      // there is a thumbnail, but the original message attachment has not been
      // downloaded yet, so we leave the quote attachment as is for now
    }
  }

  if (queryPreview.length > 0) {
    const { image: quotedPreviewImage } = queryPreview[0];
    if (quotedPreviewImage && quotedPreviewImage.path) {
      quoteAttachment.thumbnail = {
        ...quotedPreviewImage,
        copied: true,
      };
    }
  }

  if (sticker && sticker.data && sticker.data.path) {
    quoteAttachment.thumbnail = {
      ...sticker.data,
      copied: true,
    };
  }
};
