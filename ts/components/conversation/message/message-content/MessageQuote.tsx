import { isEmpty, toNumber } from 'lodash';
import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Data } from '../../../../data/data';
import { MessageRenderingProps } from '../../../../models/messageType';
import { ToastUtils } from '../../../../session/utils';
import { openConversationToSpecificMessage } from '../../../../state/ducks/conversations';
import { StateType } from '../../../../state/reducer';
import { useMessageDirection } from '../../../../state/selectors';
import {
  getMessageQuoteProps,
  isMessageDetailView,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { Quote } from './quote/Quote';

// tslint:disable: use-simple-attributes

type Props = {
  messageId: string;
};

export type MessageQuoteSelectorProps = Pick<MessageRenderingProps, 'quote' | 'direction'>;

export const MessageQuote = (props: Props) => {
  const selected = useSelector((state: StateType) => getMessageQuoteProps(state, props.messageId));
  const direction = useMessageDirection(props.messageId);
  const multiSelectMode = useSelector(isMessageSelectionMode);
  const isMessageDetailViewMode = useSelector(isMessageDetailView);

  if (!selected || isEmpty(selected)) {
    return null;
  }

  const quote = selected ? selected.quote : undefined;

  if (!quote || isEmpty(quote)) {
    return null;
  }

  const quoteNotFound = Boolean(
    quote.referencedMessageNotFound || !quote?.author || !quote.id || !quote.convoId
  );

  const onQuoteClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!quote) {
        ToastUtils.pushOriginalNotFound();
        window.log.warn('onQuoteClick: quote not valid');
        return;
      }

      if (isMessageDetailViewMode) {
        // trying to scroll while in the container while the message detail view is shown has unknown effects
        return;
      }

      let conversationKey = String(quote.convoId);
      let messageIdToNavigateTo = String(quote.id);
      let quoteNotFoundInDB = false;

      // If the quote is not found in memory, we try to find it in the DB
      if (quoteNotFound && quote.id && quote.author) {
        const quotedMessagesCollection = await Data.getMessagesBySenderAndSentAt([
          { timestamp: toNumber(quote.id), source: quote.author },
        ]);

        if (quotedMessagesCollection?.length) {
          const quotedMessage = quotedMessagesCollection.at(0);
          // If found, we navigate to the quoted message which also refreshes the message quote component
          if (quotedMessage) {
            conversationKey = String(quotedMessage.get('conversationId'));
            messageIdToNavigateTo = String(quotedMessage.id);
          } else {
            quoteNotFoundInDB = true;
          }
        } else {
          quoteNotFoundInDB = true;
        }
      }

      // For simplicity's sake, we show the 'not found' toast no matter what if we were
      // not able to find the referenced message when the quote was received or if the conversation no longer exists.
      if (quoteNotFoundInDB) {
        ToastUtils.pushOriginalNotFound();
        return;
      }

      void openConversationToSpecificMessage({
        conversationKey,
        messageIdToNavigateTo,
        shouldHighlightMessage: true,
      });
    },
    [isMessageDetailViewMode, multiSelectMode, quote, quoteNotFound]
  );

  return (
    <Quote
      onClick={onQuoteClick}
      text={quote?.text}
      attachment={quote?.attachment}
      isIncoming={direction === 'incoming'}
      author={quote.author}
      referencedMessageNotFound={quoteNotFound}
      isFromMe={Boolean(quote.isFromMe)}
    />
  );
};
