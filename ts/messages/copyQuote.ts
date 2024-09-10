// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';

import * as log from '../logging/log';
import type { QuotedMessageType } from '../model-types';
import type {
  MessageAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d';
import { SignalService } from '../protobuf';
import { isGiftBadge, isTapToView } from '../state/selectors/message';
import type { ProcessedQuote } from '../textsecure/Types';
import { IMAGE_JPEG } from '../types/MIME';
import { strictAssert } from '../util/assert';
import { getQuoteBodyText } from '../util/getQuoteBodyText';
import { isQuoteAMatch, messageHasPaymentEvent } from './helpers';
import * as Errors from '../types/errors';
import { isDownloadable } from '../types/Attachment';

export type MinimalMessageCache = Readonly<{
  findBySentAt(
    sentAt: number,
    predicate: (attributes: ReadonlyMessageAttributesType) => boolean
  ): Promise<MessageAttributesType | undefined>;
  upgradeSchema(
    attributes: MessageAttributesType,
    minSchemaVersion: number
  ): Promise<MessageAttributesType>;
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
    messageId: '',
  };

  const queryMessage = await messageCache.findBySentAt(id, attributes =>
    isQuoteAMatch(attributes, conversationId, result)
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
  providedOriginalMessage: MessageAttributesType,
  quote: QuotedMessageType,
  { messageCache = window.MessageCache }: CopyQuoteOptionsType = {}
): Promise<void> => {
  let originalMessage = providedOriginalMessage;

  const { attachments } = quote;
  const firstAttachment = attachments ? attachments[0] : undefined;

  if (messageHasPaymentEvent(originalMessage)) {
    // eslint-disable-next-line no-param-reassign
    quote.payment = originalMessage.payment;
  }

  if (isTapToView(originalMessage)) {
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

  const isMessageAGiftBadge = isGiftBadge(originalMessage);
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
  quote.text = getQuoteBodyText(originalMessage, quote.id);

  // eslint-disable-next-line no-param-reassign
  quote.bodyRanges = originalMessage.bodyRanges;

  if (!firstAttachment || !firstAttachment.contentType) {
    return;
  }

  try {
    originalMessage = await messageCache.upgradeSchema(
      originalMessage,
      window.Signal.Types.Message.VERSION_NEEDED_FOR_DISPLAY
    );
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
  } = originalMessage;

  if (queryAttachments.length > 0) {
    const queryFirst = queryAttachments[0];
    const { thumbnail } = queryFirst;

    if (thumbnail && thumbnail.path) {
      firstAttachment.thumbnail = {
        ...thumbnail,
        copied: true,
      };
    } else if (!firstAttachment.thumbnail || !isDownloadable(queryFirst)) {
      firstAttachment.contentType = queryFirst.contentType;
      firstAttachment.fileName = queryFirst.fileName;
      firstAttachment.thumbnail = undefined;
    } else {
      // there is a thumbnail, but the original message attachment has not been
      // downloaded yet, so we leave the quote attachment as is for now
    }
  }

  if (queryPreview.length > 0) {
    const queryFirst = queryPreview[0];
    const { image } = queryFirst;

    if (image && image.path) {
      firstAttachment.thumbnail = {
        ...image,
        copied: true,
      };
    }
  }

  if (sticker && sticker.data && sticker.data.path) {
    firstAttachment.thumbnail = {
      ...sticker.data,
      copied: true,
    };
  }
};
