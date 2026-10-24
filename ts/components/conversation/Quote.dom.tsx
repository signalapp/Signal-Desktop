// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useState, useEffect } from 'react';
import lodash from 'lodash';
import classNames from 'classnames';

import type {
  ReactNode,
  JSX,
  KeyboardEvent,
  MouseEvent,
  CSSProperties,
} from 'react';

import * as MIME from '../../types/MIME.std.ts';
import * as GoogleChrome from '../../util/GoogleChrome.std.ts';
import { MessageBody } from './MessageBody.dom.tsx';
import { ContactName, GroupMemberLabel } from './ContactName.dom.tsx';
import { Emojify } from './Emojify.dom.tsx';
import { TextAttachment } from '../TextAttachment.dom.tsx';
import { PaymentEventKind } from '../../types/Payment.std.ts';
import { getPaymentEventNotificationText } from '../../messages/payments.std.ts';
import { shouldTryToCopyFromQuotedMessage } from '../../messages/helpers.std.ts';
import { RenderLocation } from './MessageTextRenderer.dom.tsx';

import type {
  AttachmentType,
  ThumbnailType,
} from '../../types/Attachment.std.ts';
import type { HydratedBodyRangesType } from '../../types/BodyRange.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { BubbleColorRenderData } from '../../types/ChatStyle.std.ts';
import type { AnyPaymentEvent } from '../../types/Payment.std.ts';
import type { QuotedAttachmentType } from '../../model-types.std.ts';
import type { MemberLabelType } from '../../types/GroupMemberLabels.std.ts';
import type { Emoji } from '../../axo/emoji.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { getChatBubbleColorData } from '../../util/getChatBubbleColorData.std.ts';

const { noop } = lodash;

const EMPTY_OBJECT = Object.freeze(Object.create(null));

type QuoteImageIcon = 'play';
type QuoteIcon = 'view-once' | 'movie' | 'image' | 'microphone';

const QUOTE_ICONS: Record<QuoteIcon, string> = {
  'view-once': 'module-quote__icon-container__icon--view-once',
  movie: 'module-quote__icon-container__icon--movie',
  image: 'module-quote__icon-container__icon--image',
  microphone: 'module-quote__icon-container__icon--microphone',
};

export type QuotedAttachmentForUIType = Pick<
  QuotedAttachmentType,
  'contentType' | 'thumbnail' | 'fileName'
> &
  Pick<AttachmentType, 'isVoiceMessage' | 'fileName' | 'textAttachment'>;

export type Props = {
  authorTitle: string;
  authorLabel?: MemberLabelType;
  bubbleColor: BubbleColorRenderData;
  conversationTitle: string;
  bodyRanges?: HydratedBodyRangesType;
  i18n: LocalizerType;
  isFromMe: boolean;
  isIncoming?: boolean;
  isCompose?: boolean;
  isStoryReply?: boolean;
  /** @deprecated */
  className?: string;
  onClick?: () => void;
  onClose?: () => void;
  text: string;
  rawAttachment?: QuotedAttachmentForUIType;
  payment?: AnyPaymentEvent;
  isGiftBadge: boolean;
  isViewOnce: boolean;
  reactionEmoji?: Emoji.Variant;
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

  return thumbnail.url;
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
    if (contentType === MIME.IMAGE_GIF) {
      return i18n('icu:message--getDescription--gif');
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
    bubbleColor,
    isStoryReply,
    onClose,
    text,
    bodyRanges,
    authorTitle,
    authorLabel,
    conversationTitle,
    isFromMe,
    i18n,
    payment,
    isViewOnce,
    isGiftBadge,
    rawAttachment,
    isIncoming,
    className,
    referencedMessageNotFound,
    doubleCheckMissingQuoteReference,
    onClick,
    isCompose,
    reactionEmoji,
  } = props;
  const [imageBroken, setImageBroken] = useState(false);

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

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // This is important to ensure that using this quote to navigate to the referenced
    //   message doesn't also trigger its parent message's keydown.
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
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
    icon: QuoteImageIcon | undefined,
    asGiftBadge?: boolean
  ): JSX.Element {
    const icons: Record<QuoteImageIcon, string> = {
      play: 'module-quote__icon-container__icon--play',
    };

    const iconElement = icon ? (
      <div className="module-quote__icon-container__inner">
        <div className="module-quote__icon-container__circle-background">
          <div
            className={classNames(
              'module-quote__icon-container__icon',
              icons[icon]
            )}
          />
        </div>
      </div>
    ) : null;

    return (
      <ThumbnailImage
        className={classNames(
          'module-quote__icon-container',
          isIncoming === false &&
            asGiftBadge &&
            'module-quote__icon-container__outgoing-gift-badge'
        )}
        src={url}
        onError={handleImageError}
      >
        {iconElement}
      </ThumbnailImage>
    );
  }

  function renderIcon(icon: QuoteIcon) {
    return (
      <div className="module-quote__icon-container">
        <div className="module-quote__icon-container__inner">
          <div className="module-quote__icon-container__circle-background">
            <div
              className={classNames(
                'module-quote__icon-container__icon',
                QUOTE_ICONS[icon]
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
      <div className="module-quote__generic-file">
        <div className="module-quote__generic-file__icon" />
        <div className="module-quote__generic-file__text">{fileName}</div>
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
        <div className="module-quote__icon-container">
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
        <div dir="auto" className="module-quote__primary__text">
          <MessageBody
            bodyRanges={bodyRanges}
            disableLinks
            disableJumbomoji
            i18n={i18n}
            isSpoilerExpanded={EMPTY_OBJECT}
            renderLocation={RenderLocation.Quote}
            text={text}
            originalText={text}
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
        <div className="module-quote__primary__type-label">{typeLabel}</div>
      );
    }

    return null;
  }

  function renderClose() {
    if (!onClose) {
      return null;
    }

    const clickHandler = (e: MouseEvent): void => {
      e.stopPropagation();
      e.preventDefault();

      onClose();
    };
    const keyDownHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();

        onClose();
      }
    };

    // We need the container to give us the flexibility to implement the iOS design.
    return (
      <div className="module-quote__close-container">
        <div
          tabIndex={0}
          // We can't be a button because the overall quote is a button; can't nest them
          role="button"
          className="module-quote__close-button"
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
      <>
        {title}
        {authorLabel ? (
          <>
            {' '}
            <GroupMemberLabel context="quote" contactLabel={authorLabel} />
          </>
        ) : undefined}
      </>
    );

    return (
      <div dir="auto" className="module-quote__primary__author">
        {author}
      </div>
    );
  }

  function renderReferenceWarning() {
    if (!referencedMessageNotFound || isStoryReply) {
      return null;
    }

    return (
      <div className="module-quote__reference-warning">
        <div className="module-quote__reference-warning__icon" />
        <div className="module-quote__reference-warning__text">
          {i18n('icu:originalMessageNotFound')}
        </div>
      </div>
    );
  }

  if (!validateQuote(props)) {
    return null;
  }

  let directionClassName: string;
  if (isCompose) {
    directionClassName = 'module-quote--compose';
  } else if (isIncoming) {
    directionClassName = 'module-quote--incoming';
  } else {
    directionClassName = 'module-quote--outgoing';
  }

  const color = getChatBubbleColorData(bubbleColor);

  let colorClassName: string | null;
  let colorStyle: CSSProperties | null;
  if (color == null) {
    colorClassName = null;
    colorStyle = null;
  } else if (color.kind === 'solid') {
    colorClassName = 'module-quote--color-solid';
    colorStyle = {
      '--module-quote-color-border': color.value,
      '--module-quote-color-solid': color.value,
    } as CSSProperties;
  } else if (color.kind === 'gradient') {
    colorClassName = 'module-quote--color-gradient';
    colorStyle = {
      '--module-quote-color-border': color.value.start,
      '--module-quote-color-gradient-deg': `${color.value.deg}deg`,
      '--module-quote-color-gradient-start': color.value.start,
      '--module-quote-color-gradient-end': color.value.end,
    } as CSSProperties;
  } else {
    throw missingCaseError(color);
  }

  return (
    <div
      className={classNames(
        'module-quote',
        directionClassName,
        !onClick && 'module-quote--no-click',
        colorClassName,
        className
      )}
      style={colorStyle ?? undefined}
    >
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="module-quote__button"
      >
        <div className="module-quote__primary">
          {renderAuthor()}
          {renderGenericFile()}
          {renderPayment()}
          {renderText()}
        </div>
        {reactionEmoji && (
          <div
            className={
              rawAttachment
                ? 'module-quote__reaction-emoji'
                : 'module-quote__reaction-emoji--story-unavailable'
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
    // oxlint-disable-next-line react/set-state-in-effect
    setLoadedSrc(null);
  }, [
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    src,
  ]);

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
