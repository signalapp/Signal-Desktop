import classNames from 'classnames';
import moment from 'moment';
import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import { isEmpty } from 'lodash';
import { MessageRenderingProps } from '../../../../models/messageType';
import {
  getMessageContentSelectorProps,
  getMessageTextProps,
  getQuotedMessageToAnimate,
  getShouldHighlightMessage,
} from '../../../../state/selectors/conversations';
import {
  canDisplayImage,
  getGridDimensions,
  getImageDimensionsInAttachment,
  hasImage,
  hasVideoScreenshot,
  isImage,
  isImageAttachment,
  isVideo,
} from '../../../../types/Attachment';
import { Flex } from '../../../basic/Flex';
import { MINIMUM_LINK_PREVIEW_IMAGE_WIDTH } from '../message-item/Message';
import { MessageAttachment } from './MessageAttachment';
import { MessagePreview } from './MessagePreview';
import { MessageQuote } from './MessageQuote';
import { MessageText } from './MessageText';
import { ScrollToLoadedMessageContext } from '../../SessionMessagesListContainer';

export type MessageContentSelectorProps = Pick<
  MessageRenderingProps,
  | 'text'
  | 'direction'
  | 'timestamp'
  | 'serverTimestamp'
  | 'firstMessageOfSeries'
  | 'lastMessageOfSeries'
  | 'previews'
  | 'quote'
  | 'attachments'
>;

type Props = {
  messageId: string;
  isDetailView?: boolean;
};

function getIsShowingImage(
  props: Pick<MessageRenderingProps, 'attachments' | 'previews' | 'text'> & { imageBroken: boolean }
): boolean {
  const { attachments, previews, text, imageBroken } = props;

  if (imageBroken) {
    return false;
  }

  if (attachments && attachments.length) {
    const displayImage = canDisplayImage(attachments);
    const hasText = text?.length;
    return Boolean(
      displayImage &&
        !hasText &&
        ((isImage(attachments) && hasImage(attachments)) ||
          (isVideo(attachments) && hasVideoScreenshot(attachments)))
    );
  }

  if (previews && previews.length) {
    const first = previews[0];
    const { image } = first;

    if (!image) {
      return false;
    }

    return isImageAttachment(image);
  }

  return false;
}

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

export const IsMessageVisibleContext = createContext(false);

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

  const {
    direction,
    text,
    timestamp,
    serverTimestamp,
    firstMessageOfSeries,
    lastMessageOfSeries,
    previews,
    quote,
    attachments,
  } = contentProps;

  const selectedMsg = useSelector(state => getMessageTextProps(state as any, props.messageId));

  let isDeleted = false;
  if (selectedMsg && selectedMsg.isDeleted !== undefined) {
    isDeleted = selectedMsg.isDeleted;
  }

  const width = getWidth({ previews, attachments });
  const isShowingImage = getIsShowingImage({ attachments, imageBroken, previews, text });
  const hasText = Boolean(text);
  const hasQuote = !isEmpty(quote);
  const hasContentAfterAttachmentAndQuote = !isEmpty(previews) || !isEmpty(text);

  const bgShouldBeTransparent = isShowingImage && !hasText && !hasQuote;
  const toolTipTitle = moment(serverTimestamp || timestamp).format('llll');

  return (
    <div
      className={classNames(
        'module-message__container',
        `module-message__container--${direction}`,
        bgShouldBeTransparent
          ? `module-message__container--${direction}--transparent`
          : `module-message__container--${direction}--opaque`,
        firstMessageOfSeries || props.isDetailView
          ? `module-message__container--${direction}--first-of-series`
          : '',
        lastMessageOfSeries || props.isDetailView
          ? `module-message__container--${direction}--last-of-series`
          : '',
        flashGreen && 'flash-green-once'
      )}
      style={{
        width: isShowingImage ? width : undefined,
      }}
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
      >
        <IsMessageVisibleContext.Provider value={isMessageVisible}>
          {!isDeleted && (
            <>
              <MessageQuote messageId={props.messageId} />
              <MessageAttachment
                messageId={props.messageId}
                imageBroken={imageBroken}
                handleImageError={handleImageError}
              />
            </>
          )}
          {hasContentAfterAttachmentAndQuote ? (
            <>
              {!isDeleted && (
                <MessagePreview messageId={props.messageId} handleImageError={handleImageError} />
              )}
              <Flex padding="7px" container={true} flexDirection="column">
                <MessageText messageId={props.messageId} />
              </Flex>
            </>
          ) : null}
        </IsMessageVisibleContext.Provider>
      </InView>
    </div>
  );
};

function getWidth(
  props: Pick<MessageRenderingProps, 'attachments' | 'previews'>
): number | undefined {
  const { attachments, previews } = props;

  if (attachments && attachments.length) {
    const dimensions = getGridDimensions(attachments);
    if (dimensions) {
      return dimensions.width;
    }
  }

  if (previews && previews.length) {
    const first = previews[0];

    if (!first || !first.image) {
      return;
    }
    const { width } = first.image;

    if (isImageAttachment(first.image) && width && width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH) {
      const dimensions = getImageDimensionsInAttachment(first.image);
      if (dimensions) {
        return dimensions.width;
      }
    }
  }

  return;
}
