import { isEmpty, toNumber } from 'lodash';

import { MouseEvent } from 'react';
import { useSelector } from 'react-redux';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { Data } from '../../../../data/data';
import { MessageRenderingProps } from '../../../../models/messageType';
import { ToastUtils } from '../../../../session/utils';
import { openConversationToSpecificMessage } from '../../../../state/ducks/conversations';
import { StateType } from '../../../../state/reducer';
import { useMessageDirection } from '../../../../state/selectors';
import { getMessageQuoteProps } from '../../../../state/selectors/conversations';
import { Quote } from './quote/Quote';

type Props = {
  messageId: string;
};

export type MessageQuoteSelectorProps = Pick<MessageRenderingProps, 'quote' | 'direction'>;

export const MessageQuote = (props: Props) => {
  const selected = useSelector((state: StateType) => getMessageQuoteProps(state, props.messageId));
  const direction = useMessageDirection(props.messageId);
  const isMessageDetailView = useIsDetailMessageView();

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

  const onQuoteClick = async (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isMessageDetailView) {
      return;
    }

    if (!quote) {
      ToastUtils.pushOriginalNotFound();
      window.log.warn('onQuoteClick: quote not valid');
      return;
    }

    let conversationKey = String(quote.convoId);
    let messageIdToNavigateTo = String(quote.id);
    let quoteNotFoundInDB = false;

    // If the quote is not found in memory, we try to find it in the DB
    if (quoteNotFound && quote.id && quote.author) {
      // We always look for the quote by sentAt timestamp, for opengroups, closed groups and session chats
      // this will return an array of sent messages by id that we have locally.
      const quotedMessagesCollection = await Data.getMessagesBySenderAndSentAt([
        {
          timestamp: toNumber(quote.id),
          source: quote.author,
        },
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
  };

  return (
    <Quote
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
