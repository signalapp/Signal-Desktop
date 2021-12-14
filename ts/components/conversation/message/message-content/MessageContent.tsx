import classNames from 'classnames';
import moment from 'moment';
import React, { createContext, useCallback, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import _ from 'underscore';
import { MessageRenderingProps, QuoteClickOptions } from '../../../../models/messageType';
import {
  getMessageContentSelectorProps,
  getMessageTextProps,
} from '../../../../state/selectors/conversations';
import {
  canDisplayImage,
  getGridDimensions,
  getImageDimensions,
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
  onQuoteClick?: (quote: QuoteClickOptions) => void;
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
  const contentProps = useSelector(state =>
    getMessageContentSelectorProps(state as any, props.messageId)
  );
  const [isMessageVisible, setMessageIsVisible] = useState(false);

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
  const hasQuote = !_.isEmpty(quote);
  const hasContentAfterAttachmentAndQuote = !_.isEmpty(previews) || !_.isEmpty(text);

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
          : ''
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
              <MessageQuote messageId={props.messageId} onQuoteClick={props.onQuoteClick} />
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
      const dimensions = getImageDimensions(first.image);
      if (dimensions) {
        return dimensions.width;
      }
    }
  }

  return;
}
