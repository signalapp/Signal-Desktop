import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import _, { isEmpty } from 'lodash';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import { PubKey } from '../../../../session/types';
import { openConversationToSpecificMessage } from '../../../../state/ducks/conversations';
import {
  getMessageQuoteProps,
  isMessageDetailView,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { Quote } from './quote/Quote';
import { ToastUtils } from '../../../../session/utils';

// tslint:disable: use-simple-attributes

type Props = {
  messageId: string;
  // Note: this is the direction of the quote in case the quoted message is not found
  direction: MessageModelType;
};

export type MessageQuoteSelectorProps = Pick<MessageRenderingProps, 'quote' | 'direction'>;

export const MessageQuote = (props: Props) => {
  const selected = useSelector(state => getMessageQuoteProps(state as any, props.messageId));
  const multiSelectMode = useSelector(isMessageSelectionMode);
  const isMessageDetailViewMode = useSelector(isMessageDetailView);

  if (!selected || isEmpty(selected)) {
    return null;
  }

  const quote = selected ? selected.quote : undefined;
  const direction = selected ? selected.direction : props.direction ? props.direction : undefined;

  if (!quote || isEmpty(quote)) {
    return null;
  }

  const quoteNotFound = Boolean(
    !quote?.sender || !quote.messageId || !quote.convoId || quote.referencedMessageNotFound
  );

  const quoteText = quote?.text || null;
  const shortenedPubkey = quote?.sender ? PubKey.shorten(quote?.sender) : undefined;
  const displayedPubkey = String(quote?.authorProfileName ? shortenedPubkey : quote?.sender);

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

      // For simplicity's sake, we show the 'not found' toast no matter what if we were
      // not able to find the referenced message when the quote was received or if the conversation no longer exists.
      if (quoteNotFound) {
        ToastUtils.pushOriginalNotFound();
        return;
      } else {
        void openConversationToSpecificMessage({
          conversationKey: String(quote.convoId),
          messageIdToNavigateTo: String(quote.messageId),
          shouldHighlightMessage: true,
        });
      }
    },
    [isMessageDetailViewMode, multiSelectMode, quote, quoteNotFound]
  );

  return (
    <Quote
      onClick={onQuoteClick}
      text={quoteText}
      attachment={quote?.attachment}
      isIncoming={direction === 'incoming'}
      sender={displayedPubkey}
      authorProfileName={quote?.authorProfileName}
      authorName={quote?.authorName}
      referencedMessageNotFound={quoteNotFound}
      isFromMe={quote?.isFromMe || false}
    />
  );
};
