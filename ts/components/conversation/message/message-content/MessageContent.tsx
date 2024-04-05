import classNames from 'classnames';
import { isEmpty } from 'lodash';
import moment from 'moment';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useScrollToLoadedMessage } from '../../../../contexts/ScrollToLoadedMessage';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { IsMessageVisibleContext } from '../../../../contexts/isMessageVisibleContext';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import { StateType } from '../../../../state/reducer';
import {
  useHideAvatarInMsgList,
  useMessageIsDeleted,
  useMessageSelected,
} from '../../../../state/selectors';
import {
  getMessageContentSelectorProps,
  getQuotedMessageToAnimate,
  getShouldHighlightMessage,
} from '../../../../state/selectors/conversations';
import { useSelectedIsPrivate } from '../../../../state/selectors/selectedConversation';
import { canDisplayImagePreview } from '../../../../types/Attachment';
import { MessageAttachment } from './MessageAttachment';
import { MessageAvatar } from './MessageAvatar';
import { MessageHighlighter } from './MessageHighlighter';
import { MessageLinkPreview } from './MessageLinkPreview';
import { MessageQuote } from './MessageQuote';
import { MessageText } from './MessageText';

export type MessageContentSelectorProps = Pick<
  MessageRenderingProps,
  'text' | 'direction' | 'timestamp' | 'serverTimestamp' | 'previews' | 'quote' | 'attachments'
>;

type Props = {
  messageId: string;
};

// TODO not too sure what is this doing? It is not preventDefault()
// or stopPropagation() so I think this is never cancelling a click event?
function onClickOnMessageInnerContainer(event: React.MouseEvent<HTMLDivElement>) {
  const selection = window.getSelection();
  // Text is being selected
  if (selection && selection.type === 'Range') {
    return;
  }

  // User clicked on message body
  const target = event.target as HTMLDivElement;
  if (target.className === 'text-selectable' || window.contextMenuShown) {
    // eslint-disable-next-line no-useless-return
    return;
  }
}

const StyledMessageContent = styled.div<{ msgDirection: MessageModelType }>`
  display: flex;
  align-self: ${props => (props.msgDirection === 'incoming' ? 'flex-start' : 'flex-end')};
`;

const StyledMessageOpaqueContent = styled(MessageHighlighter)<{
  isIncoming: boolean;
  highlight: boolean;
  selected: boolean;
}>`
  background: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-background-color)'
      : 'var(--message-bubbles-sent-background-color)'};
  align-self: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  padding: var(--padding-message-content);
  border-radius: var(--border-radius-message-box);
  width: 100%;

  ${props => props.selected && `box-shadow: var(--drop-shadow);`}
`;

const StyledAvatarContainer = styled.div`
  align-self: flex-end;
`;

export const MessageContent = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const [highlight, setHighlight] = useState(false);
  const [didScroll, setDidScroll] = useState(false);
  const contentProps = useSelector((state: StateType) =>
    getMessageContentSelectorProps(state, props.messageId)
  );
  const isDeleted = useMessageIsDeleted(props.messageId);
  const [isMessageVisible, setMessageIsVisible] = useState(false);

  const scrollToLoadedMessage = useScrollToLoadedMessage();
  const selectedIsPrivate = useSelectedIsPrivate();
  const hideAvatar = useHideAvatarInMsgList(props.messageId, isDetailView);

  const [imageBroken, setImageBroken] = useState(false);

  const onVisible = (inView: boolean, _: IntersectionObserverEntry) => {
    if (inView) {
      if (isMessageVisible !== true) {
        setMessageIsVisible(true);
      }
    }
  };

  const handleImageError = useCallback(() => {
    setImageBroken(true);
  }, [setImageBroken]);

  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);
  const shouldHighlightMessage = useSelector(getShouldHighlightMessage);
  const isQuotedMessageToAnimate = quotedMessageToAnimate === props.messageId;
  const selected = useMessageSelected(props.messageId);

  useLayoutEffect(() => {
    if (isQuotedMessageToAnimate) {
      if (!highlight && !didScroll) {
        // scroll to me and flash me
        scrollToLoadedMessage(props.messageId, 'quote-or-search-result');
        setDidScroll(true);
        if (shouldHighlightMessage) {
          setHighlight(true);
        }
      }
      return;
    }
    if (highlight) {
      setHighlight(false);
    }

    if (didScroll) {
      setDidScroll(false);
    }
  }, [
    isQuotedMessageToAnimate,
    highlight,
    didScroll,
    scrollToLoadedMessage,
    props.messageId,
    shouldHighlightMessage,
  ]);

  if (!contentProps) {
    return null;
  }

  const { direction, text, timestamp, serverTimestamp, previews, quote, attachments } =
    contentProps;

  const hasContentBeforeAttachment = !isEmpty(previews) || !isEmpty(quote) || !isEmpty(text);

  const toolTipTitle = moment(serverTimestamp || timestamp).format('llll');

  const isDetailViewAndSupportsAttachmentCarousel =
    isDetailView && canDisplayImagePreview(attachments);

  return (
    <StyledMessageContent
      className={classNames('module-message__container', `module-message__container--${direction}`)}
      role="button"
      onClick={onClickOnMessageInnerContainer}
      title={toolTipTitle}
      msgDirection={direction}
    >
      {hideAvatar ? null : (
        <StyledAvatarContainer>
          <MessageAvatar messageId={props.messageId} isPrivate={selectedIsPrivate} />
        </StyledAvatarContainer>
      )}

      <InView
        id={`inview-content-${props.messageId}`}
        as={'div'}
        onChange={onVisible}
        threshold={0}
        rootMargin="500px 0px 500px 0px"
        triggerOnce={false}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--margins-xs)',
          maxWidth: '100%',
        }}
      >
        <IsMessageVisibleContext.Provider value={isMessageVisible}>
          {hasContentBeforeAttachment && (
            <StyledMessageOpaqueContent
              isIncoming={direction === 'incoming'}
              highlight={highlight}
              selected={selected}
            >
              {!isDeleted && (
                <>
                  <MessageQuote messageId={props.messageId} />
                  <MessageLinkPreview
                    messageId={props.messageId}
                    handleImageError={handleImageError}
                  />
                </>
              )}
              <MessageText messageId={props.messageId} />
            </StyledMessageOpaqueContent>
          )}
          {!isDeleted && isDetailViewAndSupportsAttachmentCarousel && !imageBroken ? null : (
            <MessageAttachment
              messageId={props.messageId}
              imageBroken={imageBroken}
              handleImageError={handleImageError}
              highlight={highlight}
            />
          )}
        </IsMessageVisibleContext.Provider>
      </InView>
    </StyledMessageContent>
  );
};
