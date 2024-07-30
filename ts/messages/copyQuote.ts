// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';

import * as log from '../logging/log';
import { DataReader, DataWriter } from '../sql/Client';
import type { QuotedMessageType } from '../model-types';
import type { MessageModel } from '../models/messages';
import { SignalService } from '../protobuf';
import { isGiftBadge, isTapToView } from '../state/selectors/message';
import type { ProcessedQuote } from '../textsecure/Types';
import { IMAGE_JPEG } from '../types/MIME';
import { strictAssert } from '../util/assert';
import { getQuoteBodyText } from '../util/getQuoteBodyText';
import { find } from '../util/iterables';
import { isQuoteAMatch, messageHasPaymentEvent } from './helpers';
import * as Errors from '../types/errors';
import { isDownloadable } from '../types/Attachment';

export const copyFromQuotedMessage = async (
  quote: ProcessedQuote,
  conversationId: string
): Promise<QuotedMessageType> => {
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

  const inMemoryMessages = window.MessageCache.__DEPRECATED$filterBySentAt(id);
  const matchingMessage = find(inMemoryMessages, item =>
    isQuoteAMatch(item.attributes, conversationId, result)
  );

  let queryMessage: undefined | MessageModel;

  if (matchingMessage) {
    queryMessage = matchingMessage;
  } else {
    log.info('copyFromQuotedMessage: db lookup needed', id);
    const messages = await DataReader.getMessagesBySentAt(id);
    const found = messages.find(item =>
      isQuoteAMatch(item, conversationId, result)
    );

    if (!found) {
      result.referencedMessageNotFound = true;
      return result;
    }

    queryMessage = window.MessageCache.__DEPRECATED$register(
      found.id,
      found,
      'copyFromQuotedMessage'
    );
  }

  if (queryMessage) {
    await copyQuoteContentFromOriginal(queryMessage, result);
  }

  return result;
};

export const copyQuoteContentFromOriginal = async (
  originalMessage: MessageModel,
  quote: QuotedMessageType
): Promise<void> => {
  const { attachments } = quote;
  const firstAttachment = attachments ? attachments[0] : undefined;

  if (messageHasPaymentEvent(originalMessage.attributes)) {
    // eslint-disable-next-line no-param-reassign
    quote.payment = originalMessage.get('payment');
  }

  if (isTapToView(originalMessage.attributes)) {
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

  const isMessageAGiftBadge = isGiftBadge(originalMessage.attributes);
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
  quote.text = getQuoteBodyText(originalMessage.attributes, quote.id);

  // eslint-disable-next-line no-param-reassign
  quote.bodyRanges = originalMessage.attributes.bodyRanges;

  if (!firstAttachment || !firstAttachment.contentType) {
    return;
  }

  try {
    const schemaVersion = originalMessage.get('schemaVersion');
    if (
      schemaVersion &&
      schemaVersion < window.Signal.Types.Message.VERSION_NEEDED_FOR_DISPLAY
    ) {
      const upgradedMessage =
        await window.Signal.Migrations.upgradeMessageSchema(
          originalMessage.attributes
        );
      originalMessage.set(upgradedMessage);
      await DataWriter.saveMessage(upgradedMessage, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    }
  } catch (error) {
    log.error(
      'Problem upgrading message quoted message from database',
      Errors.toLogFormat(error)
    );
    return;
  }

  const queryAttachments = originalMessage.get('attachments') || [];
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

  const queryPreview = originalMessage.get('preview') || [];
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

  const sticker = originalMessage.get('sticker');
  if (sticker && sticker.data && sticker.data.path) {
    firstAttachment.thumbnail = {
      ...sticker.data,
      copied: true,
    };
  }
};
