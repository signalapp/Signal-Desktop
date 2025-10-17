// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getMessageById } from '../messages/getMessageById.preload.js';
import type { MessageModel } from '../models/messages.preload.js';

import { hydrateStoryContext } from './hydrateStoryContext.preload.js';
import { getMessageIdForLogging } from './idForLogging.preload.js';

import { createLogger } from '../logging/log.std.js';
import { isQuoteAMatch } from '../messages/quotes.preload.js';
import { shouldTryToCopyFromQuotedMessage } from '../messages/helpers.std.js';
import { copyQuoteContentFromOriginal } from '../messages/copyQuote.preload.js';
import { queueUpdateMessage } from './messageBatcher.preload.js';
import { drop } from './drop.std.js';

const log = createLogger('doubleCheckMissingQuoteReference');

export async function doubleCheckMissingQuoteReference(
  message: MessageModel
): Promise<void> {
  const logId = getMessageIdForLogging(message.attributes);

  const storyId = message.get('storyId');
  if (storyId) {
    log.warn(`${logId}: missing story reference`);

    const storyMessage = await getMessageById(storyId);
    if (!storyMessage) {
      return;
    }

    if (message.get('storyReplyContext')) {
      message.set({ storyReplyContext: undefined });
    }
    await hydrateStoryContext(message.id, storyMessage.attributes, {
      shouldSave: true,
    });
    return;
  }

  const quote = message.get('quote');
  if (!quote) {
    log.warn(`${logId}: Missing quote!`);
    return;
  }

  const { authorAci, author, id: sentAt, referencedMessageNotFound } = quote;
  const contact = window.ConversationController.get(authorAci || author);

  // Is the quote really without a reference? Check with our in memory store
  // first to make sure it's not there.
  if (
    contact &&
    shouldTryToCopyFromQuotedMessage({
      referencedMessageNotFound,
      quoteAttachment: quote.attachments.at(0),
    })
  ) {
    const matchingMessage = await window.MessageCache.findBySentAt(
      Number(sentAt),
      model =>
        isQuoteAMatch(model.attributes, message.get('conversationId'), quote)
    );

    if (!matchingMessage) {
      log.info(`${logId}: No match for ${sentAt}.`);
      return;
    }

    message.set({
      quote: {
        ...quote,
        referencedMessageNotFound: false,
      },
    });

    log.info(`${logId}: Found match for ${sentAt}, updating.`);

    await copyQuoteContentFromOriginal(matchingMessage, quote);
    message.set({
      quote: {
        ...quote,
        referencedMessageNotFound: false,
      },
    });
    drop(queueUpdateMessage(message.attributes));
  }
}
