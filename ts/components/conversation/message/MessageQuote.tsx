import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { MessageRenderingProps, QuoteClickOptions } from '../../../models/messageType';
import { PubKey } from '../../../session/types';
import { toggleSelectedMessageId } from '../../../state/ducks/conversations';
import {
  getMessageQuoteProps,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';
import { Quote } from '../Quote';

type Props = {
  onQuoteClick?: (quote: QuoteClickOptions) => void;
  messageId: string;
};

export type MessageQuoteSelectorProps = Pick<MessageRenderingProps, 'quote' | 'direction'>;

export const MessageQuote = (props: Props) => {
  const { onQuoteClick: scrollToQuote } = props;

  const selected = useSelector(state => getMessageQuoteProps(state as any, props.messageId));
  const dispatch = useDispatch();
  const multiSelectMode = useSelector(isMessageSelectionMode);

  const onQuoteClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!selected?.quote) {
        window.log.warn('onQuoteClick: quote not valid');
        return;
      }
      if (multiSelectMode && props.messageId) {
        dispatch(toggleSelectedMessageId(props.messageId));

        return;
      }
      const { authorPhoneNumber, referencedMessageNotFound, messageId } = selected.quote;
      const quoteId = _.toNumber(messageId);

      scrollToQuote?.({
        quoteAuthor: authorPhoneNumber,
        quoteId,
        referencedMessageNotFound,
      });
    },
    [scrollToQuote, selected?.quote, multiSelectMode, props.messageId]
  );
  if (!selected) {
    return null;
  }

  const { quote, direction } = selected;

  if (!quote || !quote.authorPhoneNumber || !quote.messageId) {
    return null;
  }
  const shortenedPubkey = PubKey.shorten(quote.authorPhoneNumber);

  const displayedPubkey = quote.authorProfileName ? shortenedPubkey : quote.authorPhoneNumber;

  return (
    <Quote
      onClick={onQuoteClick}
      text={quote.text}
      attachment={quote.attachment}
      isIncoming={direction === 'incoming'}
      authorPhoneNumber={displayedPubkey}
      authorProfileName={quote.authorProfileName}
      authorName={quote.authorName}
      referencedMessageNotFound={quote.referencedMessageNotFound}
      isFromMe={quote.isFromMe}
    />
  );
};
