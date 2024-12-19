// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useRef, useState, useEffect } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';

import * as MIME from '../../types/MIME';
import * as GoogleChrome from '../../util/GoogleChrome';

import { MessageBody } from './MessageBody';
import type { AttachmentType, ThumbnailType } from '../../types/Attachment';
import type { HydratedBodyRangesType } from '../../types/BodyRange';
import type { LocalizerType } from '../../types/Util';
import type {
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { ContactName } from './ContactName';
import { Emojify } from './Emojify';
import { TextAttachment } from '../TextAttachment';
import { getClassNamesFor } from '../../util/getClassNamesFor';
import { getCustomColorStyle } from '../../util/getCustomColorStyle';
import type { AnyPaymentEvent } from '../../types/Payment';
import { PaymentEventKind } from '../../types/Payment';
import {
  getPaymentEventNotificationText,
  shouldTryToCopyFromQuotedMessage,
} from '../../messages/helpers';
import { RenderLocation } from './MessageTextRenderer';
import type { QuotedAttachmentType } from '../../model-types';

const EMPTY_OBJECT = Object.freeze(Object.create(null));

export type QuotedAttachmentForUIType = QuotedAttachmentType &
  Pick<AttachmentType, 'isVoiceMessage' | 'fileName' | 'textAttachment'>;

export type Props = {
  authorTitle: string;
  conversationColor: ConversationColorType;
  conversationTitle: string;
  customColor?: CustomColorType;
  bodyRanges?: HydratedBodyRangesType;
  i18n: LocalizerType;
  isFromMe: boolean;
  isIncoming?: boolean;
  isCompose?: boolean;
  isStoryReply?: boolean;
  moduleClassName?: string;
  onClick?: () => void;
  onClose?: () => void;
  text: string;
  rawAttachment?: QuotedAttachmentForUIType;
  payment?: AnyPaymentEvent;
  isGiftBadge: boolean;
  isViewOnce: boolean;
  reactionEmoji?: string;
  referencedMessageNotFound: boolean;
  doubleCheckMissingQuoteReference?: () => unknown;
};

function validateQuote(quote: Props): boolean {
  if (
    quote.isStoryReply &&
    (quote.referencedMessageNotFound || quote.reactionEmoji)
  ) {
    return true;
  }

  if (quote.isGiftBadge) {
    return true;
  }

  if (quote.text) {
    return true;
  }

  if (quote.rawAttachment) {
    return true;
  }

  if (quote.payment?.kind === PaymentEventKind.Notification) {
    return true;
  }

  return false;
}

// Long message attachments should not be shown.
function getAttachment<T extends Pick<QuotedAttachmentType, 'contentType'>>(
  rawAttachment: T | undefined
): T | undefined {
  return rawAttachment && !MIME.isLongMessage(rawAttachment.contentType)
    ? rawAttachment
    : undefined;
}

function getUrl(thumbnail?: ThumbnailType): string | undefined {
  if (!thumbnail) {
    return;
  }

  return thumbnail.objectUrl || thumbnail.url;
}

function getTypeLabel({
  i18n,
  isViewOnce = false,
  contentType,
  isVoiceMessage,
}: {
  i18n: LocalizerType;
  isViewOnce?: boolean;
  contentType: MIME.MIMEType;
  isVoiceMessage?: boolean;
}): string | undefined {
  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    if (isViewOnce) {
      return i18n('icu:message--getDescription--disappearing-video');
    }
    return i18n('icu:video');
  }
  if (GoogleChrome.isImageTypeSupported(contentType)) {
    if (isViewOnce) {
      return i18n('icu:message--getDescription--disappearing-photo');
    }
    return i18n('icu:photo');
  }

  if (isViewOnce) {
    return i18n('icu:message--getDescription--disappearing-media');
  }

  if (MIME.isAudio(contentType) && isVoiceMessage) {
    return i18n('icu:voiceMessage');
  }

  return MIME.isAudio(contentType) ? i18n('icu:audio') : undefined;
}

export function Quote(props: Props): JSX.Element | null {
  const {
    conversationColor,
    customColor,
    isStoryReply,
    onClose,
    text,
    bodyRanges,
    authorTitle,
    conversationTitle,
    isFromMe,
    i18n,
    payment,
    isViewOnce,
    isGiftBadge,
    rawAttachment,
    isIncoming,
    moduleClassName,
    referencedMessageNotFound,
    doubleCheckMissingQuoteReference,
    onClick,
    isCompose,
    reactionEmoji,
  } = props;
  const [imageBroken, setImageBroken] = useState(false);

  const getClassName = getClassNamesFor('module-quote', moduleClassName);

  useEffect(() => {
    if (
      shouldTryToCopyFromQuotedMessage({
        referencedMessageNotFound,
        quoteAttachment: rawAttachment,
      })
    ) {
      doubleCheckMissingQuoteReference?.();
    }
  }, [
    referencedMessageNotFound,
    rawAttachment,
    doubleCheckMissingQuoteReference,
  ]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    // This is important to ensure that using this quote to navigate to the referenced
    //   message doesn't also trigger its parent message's keydown.
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (onClick) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }
  }

  function handleImageError() {
    window.console.info(
      'Message: Image failed to load; failing over to placeholder'
    );
    setImageBroken(true);
  }

  function renderImage(
    url: string,
    icon: string | undefined,
    asGiftBadge?: boolean
  ): JSX.Element {
    const iconElement = icon ? (
      <div className={getClassName('__icon-container__inner')}>
        <div className={getClassName('__icon-container__circle-background')}>
          <div
            className={classNames(
              getClassName('__icon-container__icon'),
              getClassName(`__icon-container__icon--${icon}`)
            )}
          />
        </div>
      </div>
    ) : null;

    return (
      <ThumbnailImage
        className={classNames(
          getClassName('__icon-container'),
          isIncoming === false &&
            asGiftBadge &&
            getClassName('__icon-container__outgoing-gift-badge')
        )}
        src={url}
        onError={handleImageError}
      >
        {iconElement}
      </ThumbnailImage>
    );
  }

  function renderIcon(icon: string) {
    return (
      <div className={getClassName('__icon-container')}>
        <div className={getClassName('__icon-container__inner')}>
          <div className={getClassName('__icon-container__circle-background')}>
            <div
              className={classNames(
                getClassName('__icon-container__icon'),
                getClassName(`__icon-container__icon--${icon}`)
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderGenericFile() {
    const attachment = getAttachment(rawAttachment);

    if (!attachment) {
      return null;
    }

    const { fileName, contentType, textAttachment } = attachment;
    const isGenericFile =
      !GoogleChrome.isVideoTypeSupported(contentType) &&
      !GoogleChrome.isImageTypeSupported(contentType) &&
      !textAttachment &&
      !MIME.isAudio(contentType);

    if (!isGenericFile) {
      return null;
    }

    return (
      <div className={getClassName('__generic-file')}>
        <div className={getClassName('__generic-file__icon')} />
        <div
          className={classNames(
            getClassName('__generic-file__text'),
            isIncoming ? getClassName('__generic-file__text--incoming') : null
          )}
        >
          {fileName}
        </div>
      </div>
    );
  }

  function renderPayment() {
    if (payment == null) {
      return null;
    }

    return (
      <>
        <Emojify text="💳" />
        {getPaymentEventNotificationText(
          payment,
          authorTitle,
          conversationTitle,
          isFromMe,
          i18n
        )}
      </>
    );
  }

  function renderIconContainer() {
    const attachment = getAttachment(rawAttachment);

    if (isGiftBadge) {
      return renderImage('images/gift-thumbnail.svg', undefined, true);
    }

    if (!attachment) {
      return null;
    }

    const { contentType, textAttachment, thumbnail } = attachment;
    const url = getUrl(thumbnail);

    if (isViewOnce) {
      return renderIcon('view-once');
    }

    if (textAttachment) {
      return (
        <div className={getClassName('__icon-container')}>
          <TextAttachment
            i18n={i18n}
            isThumbnail
            textAttachment={textAttachment}
          />
        </div>
      );
    }

    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return url && !imageBroken
        ? renderImage(url, 'play')
        : renderIcon('movie');
    }
    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return url && !imageBroken
        ? renderImage(url, undefined)
        : renderIcon('image');
    }
    if (MIME.isAudio(contentType)) {
      return renderIcon('microphone');
    }

    return null;
  }

  function renderText() {
    if (text && !isGiftBadge) {
      return (
        <div
          dir="auto"
          className={classNames(
            getClassName('__primary__text'),
            isIncoming ? getClassName('__primary__text--incoming') : null
          )}
        >
          <MessageBody
            bodyRanges={bodyRanges}
            disableLinks
            disableJumbomoji
            i18n={i18n}
            isSpoilerExpanded={EMPTY_OBJECT}
            renderLocation={RenderLocation.Quote}
            text={text}
          />
        </div>
      );
    }

    const attachment = getAttachment(rawAttachment);

    let typeLabel;

    if (isGiftBadge) {
      typeLabel = i18n('icu:quote--donation');
    } else if (attachment) {
      const { contentType, isVoiceMessage } = attachment;
      typeLabel = getTypeLabel({
        i18n,
        isViewOnce,
        contentType,
        isVoiceMessage,
      });
    } else {
      return null;
    }

    if (typeLabel) {
      return (
        <div
          className={classNames(
            getClassName('__primary__type-label'),
            isIncoming ? getClassName('__primary__type-label--incoming') : null
          )}
        >
          {typeLabel}
        </div>
      );
    }

    return null;
  }

  function renderClose() {
    if (!onClose) {
      return null;
    }

    const clickHandler = (e: React.MouseEvent): void => {
      e.stopPropagation();
      e.preventDefault();

      onClose();
    };
    const keyDownHandler = (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();

        onClose();
      }
    };

    // We need the container to give us the flexibility to implement the iOS design.
    return (
      <div className={getClassName('__close-container')}>
        <div
          tabIndex={0}
          // We can't be a button because the overall quote is a button; can't nest them
          role="button"
          className={getClassName('__close-button')}
          aria-label={i18n('icu:close')}
          onKeyDown={keyDownHandler}
          onClick={clickHandler}
        />
      </div>
    );
  }

  function renderAuthor() {
    const title = isFromMe ? (
      i18n('icu:you')
    ) : (
      <ContactName title={authorTitle} />
    );
    const author = isStoryReply ? (
      <>
        {title} &middot; {i18n('icu:Quote__story')}
      </>
    ) : (
      title
    );

    return (
      <div
        dir="auto"
        className={classNames(
          getClassName('__primary__author'),
          isIncoming ? getClassName('__primary__author--incoming') : null
        )}
      >
        {author}
      </div>
    );
  }

  const customColorStyle = getCustomColorStyle(customColor, true);

  // We don't set a custom color for outgoing quotes
  const borderInlineStartColor =
    isIncoming || isCompose
      ? customColorStyle?.borderInlineStartColor
      : undefined;

  function renderReferenceWarning() {
    if (!referencedMessageNotFound || isStoryReply) {
      return null;
    }

    return (
      <div
        className={classNames(
          getClassName('__reference-warning'),
          isIncoming
            ? getClassName(`--incoming-${conversationColor}`)
            : getClassName(`--outgoing-${conversationColor}`)
        )}
        style={{ ...customColorStyle, borderInlineStartColor }}
      >
        <div
          className={classNames(
            getClassName('__reference-warning__icon'),
            isIncoming
              ? getClassName('__reference-warning__icon--incoming')
              : null
          )}
        />
        <div
          className={classNames(
            getClassName('__reference-warning__text'),
            isIncoming
              ? getClassName('__reference-warning__text--incoming')
              : null
          )}
        >
          {i18n('icu:originalMessageNotFound')}
        </div>
      </div>
    );
  }

  if (!validateQuote(props)) {
    return null;
  }

  let colorClassName: string;
  let directionClassName: string;
  if (isCompose) {
    directionClassName = getClassName('--compose');
    colorClassName = getClassName(`--compose-${conversationColor}`);
  } else if (isIncoming) {
    directionClassName = getClassName('--incoming');
    colorClassName = getClassName(`--incoming-${conversationColor}`);
  } else {
    directionClassName = getClassName('--outgoing');
    colorClassName = getClassName(`--outgoing-${conversationColor}`);
  }

  return (
    <div className={getClassName('__container')}>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={classNames(
          getClassName(''),
          directionClassName,
          colorClassName,
          !onClick && getClassName('--no-click'),
          referencedMessageNotFound && getClassName('--with-reference-warning')
        )}
        style={customColorStyle}
      >
        <div
          className={getClassName('__primary')}
          style={
            borderInlineStartColor ? { borderInlineStartColor } : undefined
          }
        >
          {renderAuthor()}
          {renderGenericFile()}
          {renderPayment()}
          {renderText()}
        </div>
        {reactionEmoji && (
          <div
            className={
              rawAttachment
                ? getClassName('__reaction-emoji')
                : getClassName('__reaction-emoji--story-unavailable')
            }
          >
            <Emojify text={reactionEmoji} />
          </div>
        )}
        {renderIconContainer()}
        {renderClose()}
      </button>
      {renderReferenceWarning()}
    </div>
  );
}

function ThumbnailImage({
  className,
  src,
  onError,
  children,
}: Readonly<{
  className: string;
  src: string;
  onError: () => void;
  children: ReactNode;
}>): JSX.Element {
  const imageRef = useRef(new Image());
  const [loadedSrc, setLoadedSrc] = useState<null | string>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setLoadedSrc(src);
    };
    image.src = src;
    imageRef.current = image;
    return () => {
      image.onload = noop;
    };
  }, [src]);

  useEffect(() => {
    setLoadedSrc(null);
  }, [src]);

  useEffect(() => {
    const image = imageRef.current;
    image.onerror = onError;
    return () => {
      image.onerror = noop;
    };
  }, [onError]);

  return (
    <div
      className={className}
      style={loadedSrc ? { backgroundImage: `url('${loadedSrc}')` } : {}}
    >
      {children}
    </div>
  );
}
