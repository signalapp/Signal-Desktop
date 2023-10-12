import classNames from 'classnames';
import { isEmpty } from 'lodash';
import moment from 'moment';
import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import styled, { css, keyframes } from 'styled-components';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import { StateType } from '../../../../state/reducer';
import { useMessageIsDeleted } from '../../../../state/selectors';
import {
  getMessageContentSelectorProps,
  getQuotedMessageToAnimate,
  getShouldHighlightMessage,
} from '../../../../state/selectors/conversations';
import { ScrollToLoadedMessageContext } from '../../SessionMessagesListContainer';
import { MessageAttachment } from './MessageAttachment';
import { MessageLinkPreview } from './MessageLinkPreview';
import { MessageQuote } from './MessageQuote';
import { MessageText } from './MessageText';

export type MessageContentSelectorProps = Pick<
  MessageRenderingProps,
  'text' | 'direction' | 'timestamp' | 'serverTimestamp' | 'previews' | 'quote' | 'attachments'
>;

type Props = {
  messageId: string;
  isDetailView?: boolean;
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

const StyledMessageContent = styled.div``;

const opacityAnimation = keyframes`
    0% {
      opacity: 1;
    }
    25% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    75% {
      opacity: 0.2;
    }
    100% {
      opacity: 1;
    }
`;

export const StyledMessageHighlighter = styled.div<{
  highlight: boolean;
}>`
  ${props =>
    props.highlight &&
    css`
      animation: ${opacityAnimation} 1s linear;
    `}
`;

const StyledMessageOpaqueContent = styled(StyledMessageHighlighter)<{
  messageDirection: MessageModelType;
  highlight: boolean;
}>`
  background: ${props =>
    props.messageDirection === 'incoming'
      ? 'var(--message-bubbles-received-background-color)'
      : 'var(--message-bubbles-sent-background-color)'};
  align-self: ${props => (props.messageDirection === 'incoming' ? 'flex-start' : 'flex-end')};
  padding: var(--padding-message-content);
  border-radius: var(--border-radius-message-box);
  width: 100%;
`;

export const IsMessageVisibleContext = createContext(false);

export const MessageContent = (props: Props) => {
  const [highlight, setHighlight] = useState(false);
  const [didScroll, setDidScroll] = useState(false);
  const contentProps = useSelector((state: StateType) =>
    getMessageContentSelectorProps(state, props.messageId)
  );
  const isDeleted = useMessageIsDeleted(props.messageId);
  const [isMessageVisible, setMessageIsVisible] = useState(false);

  const scrollToLoadedMessage = useContext(ScrollToLoadedMessageContext);

  const [imageBroken, setImageBroken] = useState(false);

  const onVisible = (inView: boolean | object) => {
    if (
      inView === true ||
      ((inView as any).type === 'focus' && (inView as any).returnValue === true)
    ) {
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

  const { direction, text, timestamp, serverTimestamp, previews, quote } = contentProps;

  const hasContentBeforeAttachment = !isEmpty(previews) || !isEmpty(quote) || !isEmpty(text);

  const toolTipTitle = moment(serverTimestamp || timestamp).format('llll');

  return (
    <StyledMessageContent
      className={classNames('module-message__container', `module-message__container--${direction}`)}
      role="button"
      onClick={onClickOnMessageInnerContainer}
      title={toolTipTitle}
    >
      <InView
        id={`inview-content-${props.messageId}`}
        onChange={onVisible}
        threshold={0}
        rootMargin="500px 0px 500px 0px"
        triggerOnce={false}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--margins-xs)',
        }}
      >
        <IsMessageVisibleContext.Provider value={isMessageVisible}>
          {hasContentBeforeAttachment && (
            <StyledMessageOpaqueContent messageDirection={direction} highlight={highlight}>
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
          {!isDeleted && (
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
