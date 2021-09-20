import React from 'react';

import _ from 'lodash';
import uuid from 'uuid';
import { QuoteClickOptions } from '../../models/messageType';
import { GenericReadableMessage } from './message/GenericReadableMessage';
import { useSelector } from 'react-redux';
import { getGenericReadableMessageSelectorProps } from '../../state/selectors/conversations';

// Same as MIN_WIDTH in ImageGrid.tsx
export const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;

type Props = {
  messageId: string;
  isDetailView?: boolean; // when the detail is shown for a message, we disble click and some other stuff
  onQuoteClick?: (options: QuoteClickOptions) => Promise<void>;
};

export const Message = (props: Props) => {
  const msgProps = useSelector(state =>
    getGenericReadableMessageSelectorProps(state as any, props.messageId)
  );

  const ctxMenuID = `ctx-menu-message-${uuid()}`;
  const onQuoteClick = (quote: QuoteClickOptions) => {
    void props.onQuoteClick?.(quote);
  };

  if (msgProps?.isDeleted && msgProps.direction === 'outgoing') {
    return null;
  }

  return (
    <GenericReadableMessage
      onQuoteClick={onQuoteClick}
      ctxMenuID={ctxMenuID}
      messageId={props.messageId}
      isDetailView={props.isDetailView}
    />
  );
};
