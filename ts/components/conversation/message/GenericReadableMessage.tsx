import classNames from 'classnames';
import React, { useCallback } from 'react';
import { contextMenu } from 'react-contexify';
import { useSelector } from 'react-redux';
import _ from 'underscore';
import { MessageRenderingProps, QuoteClickOptions } from '../../../models/messageType';
import {
  getGenericReadableMessageSelectorProps,
  getIsMessageSelected,
  getQuotedMessageToAnimate,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';
import { ExpireTimer } from '../ExpireTimer';
import { ReadableMessage } from '../ReadableMessage';
import { MessageAvatar } from './MessageAvatar';
import { MessageContentWithStatuses } from './MessageContentWithStatus';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  | 'direction'
  | 'conversationType'
  | 'receivedAt'
  | 'isUnread'
  | 'expirationLength'
  | 'expirationTimestamp'
  | 'isKickedFromGroup'
>;

type Props = {
  messageId: string;
  expired: boolean;
  expiring: boolean;
  onQuoteClick: (quote: QuoteClickOptions) => void;
  ctxMenuID: string;
  isDetailView?: boolean;
};

export const GenericReadableMessage = (props: Props) => {
  const msgProps = useSelector(state =>
    getGenericReadableMessageSelectorProps(state as any, props.messageId)
  );

  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);
  const isMessageSelected = useSelector(state =>
    getIsMessageSelected(state as any, props.messageId)
  );
  const multiSelectMode = useSelector(isMessageSelectionMode);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const enableContextMenu = !multiSelectMode && !msgProps?.isKickedFromGroup;

      if (enableContextMenu) {
        contextMenu.hideAll();
        contextMenu.show({
          id: props.ctxMenuID,
          event: e,
        });
      }
    },
    [props.ctxMenuID, multiSelectMode, msgProps?.isKickedFromGroup]
  );

  const { messageId, expired, isDetailView } = props;

  if (!msgProps) {
    return null;
  }
  const {
    direction,
    conversationType,
    receivedAt,
    isUnread,
    expirationLength,
    expirationTimestamp,
  } = msgProps;

  if (expired) {
    return null;
  }

  const selected = isMessageSelected || false;
  const isGroup = conversationType === 'group';
  const isQuotedMessageToAnimate = quotedMessageToAnimate === messageId;
  const isIncoming = direction === 'incoming';

  return (
    <ReadableMessage
      messageId={messageId}
      className={classNames(
        'session-message-wrapper',
        selected && 'message-selected',
        isGroup && 'public-chat-message-wrapper',
        isQuotedMessageToAnimate && 'flash-green-once',
        isIncoming ? 'session-message-wrapper-incoming' : 'session-message-wrapper-outgoing'
      )}
      onContextMenu={handleContextMenu}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <MessageAvatar messageId={messageId} />
      <ExpireTimer
        isCorrectSide={!isIncoming}
        expirationLength={expirationLength}
        expirationTimestamp={expirationTimestamp}
      />
      <MessageContentWithStatuses
        ctxMenuID={props.ctxMenuID}
        messageId={messageId}
        expiring={props.expiring}
        onQuoteClick={props.onQuoteClick}
        isDetailView={isDetailView}
      />
      <ExpireTimer
        isCorrectSide={isIncoming}
        expirationLength={expirationLength}
        expirationTimestamp={expirationTimestamp}
      />
    </ReadableMessage>
  );
};
