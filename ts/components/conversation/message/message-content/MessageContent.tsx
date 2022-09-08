import classNames from 'classnames';
import moment from 'moment';
import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import { isEmpty } from 'lodash';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import {
  getMessageContentSelectorProps,
  getMessageTextProps,
  getQuotedMessageToAnimate,
  getShouldHighlightMessage,
} from '../../../../state/selectors/conversations';
import { MessageAttachment } from './MessageAttachment';
import { MessageLinkPreview } from './MessageLinkPreview';
import { MessageQuote } from './MessageQuote';
import { MessageText } from './MessageText';
import { ScrollToLoadedMessageContext } from '../../SessionMessagesListContainer';
import styled from 'styled-components';

export type MessageContentSelectorProps = Pick<
  MessageRenderingProps,
  'text' | 'direction' | 'timestamp' | 'serverTimestamp' | 'previews' | 'quote' | 'attachments'
>;

type Props = {
  messageId: string;
  isDetailView?: boolean;
};

function onClickOnMessageInnerContainer(event: React.MouseEvent<HTMLDivElement>) {
  const selection = window.getSelection();
  // Text is being selected
  if (selection && selection.type === 'Range') {
    return;
  }

  // User clicked on message body
  const target = event.target as HTMLDivElement;
  if (target.className === 'text-selectable' || window.contextMenuShown) {
    return;
  }
}

const StyledMessageOpaqueContent = styled.div<{ messageDirection: MessageModelType }>`
  background: ${props =>
    props.messageDirection === 'incoming'
      ? 'var(--color-received-message-background)'
      : 'var(--color-sent-message-background)'};
  align-self: ${props => (props.messageDirection === 'incoming' ? 'flex-start' : 'flex-end')};

  padding: var(--padding-message-content);
  border-radius: var(--border-radius-message-box);
`;

export const IsMessageVisibleContext = createContext(false);
// tslint:disable: use-simple-attributes

export const MessageContent = (props: Props) => {
  const [flashGreen, setFlashGreen] = useState(false);
  const [didScroll, setDidScroll] = useState(false);
  const contentProps = useSelector(state =>
    getMessageContentSelectorProps(state as any, props.messageId)
  );
  const [isMessageVisible, setMessageIsVisible] = useState(false);

  const scrollToLoadedMessage = useContext(ScrollToLoadedMessageContext);

  const [imageBroken, setImageBroken] = useState(false);

  const onVisible = (inView: boolean | Object) => {
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
      if (!flashGreen && !didScroll) {
        //scroll to me and flash me
        scrollToLoadedMessage(props.messageId, 'quote-or-search-result');
        setDidScroll(true);
        if (shouldHighlightMessage) {
          setFlashGreen(true);
        }
      }
      return;
    }
    if (flashGreen) {
      setFlashGreen(false);
    }

    if (didScroll) {
      setDidScroll(false);
    }
    return;
  });

  if (!contentProps) {
    return null;
  }

  const { direction, text, timestamp, serverTimestamp, previews } = contentProps;

  const selectedMsg = useSelector(state => getMessageTextProps(state as any, props.messageId));

  let isDeleted = false;
  if (selectedMsg && selectedMsg.isDeleted !== undefined) {
    isDeleted = selectedMsg.isDeleted;
  }

  const hasContentAfterAttachmentAndQuote = !isEmpty(previews) || !isEmpty(text);

  const toolTipTitle = moment(serverTimestamp || timestamp).format('llll');

  return (
    <div
      className={classNames(
        'module-message__container',
        `module-message__container--${direction}`,
        flashGreen && 'flash-green-once'
      )}
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
          {hasContentAfterAttachmentAndQuote && (
            <StyledMessageOpaqueContent messageDirection={direction}>
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
            />
          )}
        </IsMessageVisibleContext.Provider>
      </InView>
    </div>
  );
};
