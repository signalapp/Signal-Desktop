import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import _ from 'lodash';
import { MessageRenderingProps } from '../../../../models/messageType';
import { PubKey } from '../../../../session/types';
import { openConversationToSpecificMessage } from '../../../../state/ducks/conversations';
import {
  getMessageQuoteProps,
  isMessageDetailView,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { Quote } from './Quote';
import { ToastUtils } from '../../../../session/utils';
import { getMessagesBySentAt } from '../../../../data/data';
import { MessageModel } from '../../../../models/message';

// tslint:disable: use-simple-attributes

type Props = {
  messageId: string;
};

export type MessageQuoteSelectorProps = Pick<MessageRenderingProps, 'quote' | 'direction'>;

export const MessageQuote = (props: Props) => {
  const selected = useSelector(state => getMessageQuoteProps(state as any, props.messageId));
  const multiSelectMode = useSelector(isMessageSelectionMode);
  const isMessageDetailViewMode = useSelector(isMessageDetailView);

  const quote = selected ? selected.quote : undefined;
  const direction = selected ? selected.direction : undefined;

  const onQuoteClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!quote) {
        window.log.warn('onQuoteClick: quote not valid');
        return;
      }

      if (isMessageDetailViewMode) {
        // trying to scroll while in the container while the message detail view is shown has unknown effects
        return;
      }

      const {
        referencedMessageNotFound,
        messageId: quotedMessageSentAt,
        sender: quoteAuthor,
      } = quote;
      // For simplicity's sake, we show the 'not found' toast no matter what if we were
      //   not able to find the referenced message when the quote was received.
      if (referencedMessageNotFound || !quotedMessageSentAt || !quoteAuthor) {
        ToastUtils.pushOriginalNotFound();
        return;
      }

      const collection = await getMessagesBySentAt(_.toNumber(quotedMessageSentAt));
      const foundInDb = collection.find((item: MessageModel) => {
        const messageAuthor = item.getSource();

        return Boolean(messageAuthor && quoteAuthor === messageAuthor);
      });

      if (!foundInDb) {
        ToastUtils.pushOriginalNotFound();
        return;
      }
      void openConversationToSpecificMessage({
        conversationKey: foundInDb.get('conversationId'),
        messageIdToNavigateTo: foundInDb.get('id'),
        shouldHighlightMessage: true,
      });
    },
    [quote, multiSelectMode, props.messageId]
  );
  if (!selected) {
    return null;
  }

  if (!quote || !quote.sender || !quote.messageId) {
    return null;
  }
  const shortenedPubkey = PubKey.shorten(quote.sender);

  const displayedPubkey = quote.authorProfileName ? shortenedPubkey : quote.sender;

  return (
    <Quote
      onClick={onQuoteClick}
      text={quote.text || ''}
      attachment={quote.attachment}
      isIncoming={direction === 'incoming'}
      sender={displayedPubkey}
      authorProfileName={quote.authorProfileName}
      authorName={quote.authorName}
      referencedMessageNotFound={quote.referencedMessageNotFound || false}
      isFromMe={quote.isFromMe || false}
    />
  );
};
