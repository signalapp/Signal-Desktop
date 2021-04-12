// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';

import * as MIME from '../../types/MIME';
import * as GoogleChrome from '../../util/GoogleChrome';

import { MessageBody } from './MessageBody';
import { BodyRangesType, LocalizerType } from '../../types/Util';
import { ColorType } from '../../types/Colors';
import { ContactName } from './ContactName';
import { getTextWithMentions } from '../../util/getTextWithMentions';

export type Props = {
  authorTitle: string;
  authorPhoneNumber?: string;
  authorProfileName?: string;
  authorName?: string;
  authorColor?: ColorType;
  bodyRanges?: BodyRangesType;
  i18n: LocalizerType;
  isFromMe: boolean;
  isIncoming: boolean;
  withContentAbove: boolean;
  onClick?: () => void;
  onClose?: () => void;
  text: string;
  rawAttachment?: QuotedAttachmentType;
  referencedMessageNotFound: boolean;
};

type State = {
  imageBroken: boolean;
};

export type QuotedAttachmentType = {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: Attachment;
};

type Attachment = {
  contentType: MIME.MIMEType;
  /** Not included in protobuf, and is loaded asynchronously */
  objectUrl?: string;
};

function validateQuote(quote: Props): boolean {
  if (quote.text) {
    return true;
  }

  if (quote.rawAttachment) {
    return true;
  }

  return false;
}

// Long message attachments should not be shown.
function getAttachment(
  rawAttachment: undefined | QuotedAttachmentType
): undefined | QuotedAttachmentType {
  return rawAttachment && !MIME.isLongMessage(rawAttachment.contentType)
    ? rawAttachment
    : undefined;
}

function getObjectUrl(thumbnail: Attachment | undefined): string | undefined {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return undefined;
}

function getTypeLabel({
  i18n,
  contentType,
  isVoiceMessage,
}: {
  i18n: LocalizerType;
  contentType: MIME.MIMEType;
  isVoiceMessage: boolean;
}): string | undefined {
  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return i18n('video');
  }
  if (GoogleChrome.isImageTypeSupported(contentType)) {
    return i18n('photo');
  }
  if (MIME.isAudio(contentType) && isVoiceMessage) {
    return i18n('voiceMessage');
  }

  return MIME.isAudio(contentType) ? i18n('audio') : undefined;
}

export class Quote extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      imageBroken: false,
    };
  }

  public handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ): void => {
    const { onClick } = this.props;

    // This is important to ensure that using this quote to navigate to the referenced
    //   message doesn't also trigger its parent message's keydown.
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }
  };

  public handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const { onClick } = this.props;

    if (onClick) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }
  };

  public handleImageError = (): void => {
    window.console.info(
      'Message: Image failed to load; failing over to placeholder'
    );
    this.setState({
      imageBroken: true,
    });
  };

  public renderImage(url: string, icon?: string): JSX.Element {
    const iconElement = icon ? (
      <div className="module-quote__icon-container__inner">
        <div className="module-quote__icon-container__circle-background">
          <div
            className={classNames(
              'module-quote__icon-container__icon',
              `module-quote__icon-container__icon--${icon}`
            )}
          />
        </div>
      </div>
    ) : null;

    return (
      <ThumbnailImage src={url} onError={this.handleImageError}>
        {iconElement}
      </ThumbnailImage>
    );
  }

  // eslint-disable-next-line class-methods-use-this
  public renderIcon(icon: string): JSX.Element {
    return (
      <div className="module-quote__icon-container">
        <div className="module-quote__icon-container__inner">
          <div className="module-quote__icon-container__circle-background">
            <div
              className={classNames(
                'module-quote__icon-container__icon',
                `module-quote__icon-container__icon--${icon}`
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  public renderGenericFile(): JSX.Element | null {
    const { rawAttachment, isIncoming } = this.props;
    const attachment = getAttachment(rawAttachment);

    if (!attachment) {
      return null;
    }

    const { fileName, contentType } = attachment;
    const isGenericFile =
      !GoogleChrome.isVideoTypeSupported(contentType) &&
      !GoogleChrome.isImageTypeSupported(contentType) &&
      !MIME.isAudio(contentType);

    if (!isGenericFile) {
      return null;
    }

    return (
      <div className="module-quote__generic-file">
        <div className="module-quote__generic-file__icon" />
        <div
          className={classNames(
            'module-quote__generic-file__text',
            isIncoming ? 'module-quote__generic-file__text--incoming' : null
          )}
        >
          {fileName}
        </div>
      </div>
    );
  }

  public renderIconContainer(): JSX.Element | null {
    const { rawAttachment } = this.props;
    const { imageBroken } = this.state;
    const attachment = getAttachment(rawAttachment);

    if (!attachment) {
      return null;
    }

    const { contentType, thumbnail } = attachment;
    const objectUrl = getObjectUrl(thumbnail);

    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return objectUrl && !imageBroken
        ? this.renderImage(objectUrl, 'play')
        : this.renderIcon('movie');
    }
    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return objectUrl && !imageBroken
        ? this.renderImage(objectUrl)
        : this.renderIcon('image');
    }
    if (MIME.isAudio(contentType)) {
      return this.renderIcon('microphone');
    }

    return null;
  }

  public renderText(): JSX.Element | null {
    const { bodyRanges, i18n, text, rawAttachment, isIncoming } = this.props;

    if (text) {
      const quoteText = bodyRanges
        ? getTextWithMentions(bodyRanges, text)
        : text;

      return (
        <div
          dir="auto"
          className={classNames(
            'module-quote__primary__text',
            isIncoming ? 'module-quote__primary__text--incoming' : null
          )}
        >
          <MessageBody disableLinks text={quoteText} i18n={i18n} />
        </div>
      );
    }

    const attachment = getAttachment(rawAttachment);

    if (!attachment) {
      return null;
    }

    const { contentType, isVoiceMessage } = attachment;

    const typeLabel = getTypeLabel({ i18n, contentType, isVoiceMessage });
    if (typeLabel) {
      return (
        <div
          className={classNames(
            'module-quote__primary__type-label',
            isIncoming ? 'module-quote__primary__type-label--incoming' : null
          )}
        >
          {typeLabel}
        </div>
      );
    }

    return null;
  }

  public renderClose(): JSX.Element | null {
    const { i18n, onClose } = this.props;

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
      <div className="module-quote__close-container">
        <div
          tabIndex={0}
          // We can't be a button because the overall quote is a button; can't nest them
          role="button"
          className="module-quote__close-button"
          aria-label={i18n('close')}
          onKeyDown={keyDownHandler}
          onClick={clickHandler}
        />
      </div>
    );
  }

  public renderAuthor(): JSX.Element {
    const {
      authorProfileName,
      authorPhoneNumber,
      authorTitle,
      authorName,
      i18n,
      isFromMe,
      isIncoming,
    } = this.props;

    return (
      <div
        className={classNames(
          'module-quote__primary__author',
          isIncoming ? 'module-quote__primary__author--incoming' : null
        )}
      >
        {isFromMe ? (
          i18n('you')
        ) : (
          <ContactName
            phoneNumber={authorPhoneNumber}
            name={authorName}
            profileName={authorProfileName}
            title={authorTitle}
            i18n={i18n}
          />
        )}
      </div>
    );
  }

  public renderReferenceWarning(): JSX.Element | null {
    const { i18n, isIncoming, referencedMessageNotFound } = this.props;

    if (!referencedMessageNotFound) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-quote__reference-warning',
          isIncoming ? 'module-quote__reference-warning--incoming' : null
        )}
      >
        <div
          className={classNames(
            'module-quote__reference-warning__icon',
            isIncoming
              ? 'module-quote__reference-warning__icon--incoming'
              : null
          )}
        />
        <div
          className={classNames(
            'module-quote__reference-warning__text',
            isIncoming
              ? 'module-quote__reference-warning__text--incoming'
              : null
          )}
        >
          {i18n('originalMessageNotFound')}
        </div>
      </div>
    );
  }

  public render(): JSX.Element | null {
    const {
      authorColor,
      isIncoming,
      onClick,
      referencedMessageNotFound,
      withContentAbove,
    } = this.props;

    if (!validateQuote(this.props)) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-quote-container',
          withContentAbove ? 'module-quote-container--with-content-above' : null
        )}
      >
        <button
          type="button"
          onClick={this.handleClick}
          onKeyDown={this.handleKeyDown}
          className={classNames(
            'module-quote',
            isIncoming ? 'module-quote--incoming' : 'module-quote--outgoing',
            isIncoming
              ? `module-quote--incoming-${authorColor}`
              : `module-quote--outgoing-${authorColor}`,
            !onClick ? 'module-quote--no-click' : null,
            withContentAbove ? 'module-quote--with-content-above' : null,
            referencedMessageNotFound
              ? 'module-quote--with-reference-warning'
              : null
          )}
        >
          <div className="module-quote__primary">
            {this.renderAuthor()}
            {this.renderGenericFile()}
            {this.renderText()}
          </div>
          {this.renderIconContainer()}
          {this.renderClose()}
        </button>
        {this.renderReferenceWarning()}
      </div>
    );
  }
}

function ThumbnailImage({
  src,
  onError,
  children,
}: Readonly<{
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
      className="module-quote__icon-container"
      style={
        loadedSrc ? { backgroundImage: `url('${encodeURI(loadedSrc)}')` } : {}
      }
    >
      {children}
    </div>
  );
}
