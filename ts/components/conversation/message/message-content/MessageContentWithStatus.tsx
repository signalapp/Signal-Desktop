import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { toggleSelectedMessageId } from '../../../../state/ducks/conversations';
import {
  getMessageContentWithStatusesSelectorProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';

import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageStatus } from './MessageStatus';

export type MessageContentWithStatusSelectorProps = Pick<
  MessageRenderingProps,
  'direction' | 'isDeleted' | 'isTrustedForAttachmentDownload'
> & { hasAttachments: boolean };

type Props = {
  messageId: string;
  ctxMenuID: string;
  isDetailView?: boolean;
  dataTestId?: string;
};

export const MessageContentWithStatuses = (props: Props) => {
  const contentProps = useSelector(state =>
    getMessageContentWithStatusesSelectorProps(state as any, props.messageId)
  );
  const dispatch = useDispatch();

  const multiSelectMode = useSelector(isMessageSelectionMode);

  const onClickOnMessageOuterContainer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (multiSelectMode && messageId) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleSelectedMessageId(messageId));
      }
    },
    [window.contextMenuShown, props?.messageId, multiSelectMode, props?.isDetailView]
  );

  const onDoubleClickReplyToMessage = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentSelection = window.getSelection();
    const currentSelectionString = currentSelection?.toString() || undefined;

    // if multiple word are selected, consider that this double click was actually NOT used to reply to
    // but to select
    if (
      !currentSelectionString ||
      currentSelectionString.length === 0 ||
      !currentSelectionString.includes(' ')
    ) {
      void replyToMessage(messageId);
      currentSelection?.empty();
      e.preventDefault();
      return;
    }
  };

  const { messageId, ctxMenuID, isDetailView, dataTestId } = props;
  if (!contentProps) {
    return null;
  }
  const { direction, isDeleted, hasAttachments, isTrustedForAttachmentDownload } = contentProps;
  const isIncoming = direction === 'incoming';

  return (
    <div
      className={classNames('module-message', `module-message--${direction}`)}
      role="button"
      onClick={onClickOnMessageOuterContainer}
      onDoubleClickCapture={onDoubleClickReplyToMessage}
      style={{ width: hasAttachments && isTrustedForAttachmentDownload ? 'min-content' : 'auto' }}
      data-testid={dataTestId}
    >
      <MessageStatus
        dataTestId="msg-status-incoming"
        messageId={messageId}
        isCorrectSide={isIncoming}
      />
      <div>
        <MessageAuthorText messageId={messageId} />

        <MessageContent messageId={messageId} isDetailView={isDetailView} />
      </div>
      <MessageStatus
        dataTestId="msg-status-outgoing"
        messageId={messageId}
        isCorrectSide={!isIncoming}
      />
      {!isDeleted && <MessageContextMenu messageId={messageId} contextMenuId={ctxMenuID} />}
    </div>
  );
};
