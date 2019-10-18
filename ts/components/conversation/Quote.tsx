// tslint:disable:react-this-binding-issue

import React from 'react';
import classNames from 'classnames';

import * as MIME from '../../../ts/types/MIME';
import * as GoogleChrome from '../../../ts/util/GoogleChrome';

import { MessageBody } from './MessageBody';
import { ColorType, LocalizerType } from '../../types/Util';
import { ContactName } from './ContactName';

interface Props {
  attachment?: QuotedAttachmentType;
  authorPhoneNumber: string;
  authorProfileName?: string;
  authorName?: string;
  authorColor?: ColorType;
  i18n: LocalizerType;
  isFromMe: boolean;
  isIncoming: boolean;
  conversationType: 'group' | 'direct';
  convoId: string;
  isPublic?: boolean;
  withContentAbove: boolean;
  onClick?: () => void;
  onClose?: () => void;
  text: string;
  referencedMessageNotFound: boolean;
}

interface State {
  imageBroken: boolean;
}

export interface QuotedAttachmentType {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: Attachment;
}

interface Attachment {
  contentType: MIME.MIMEType;
  /** Not included in protobuf, and is loaded asynchronously */
  objectUrl?: string;
}

function validateQuote(quote: Props): boolean {
  if (quote.text) {
    return true;
  }

  if (quote.attachment) {
    return true;
  }

  return false;
}

function getObjectUrl(thumbnail: Attachment | undefined): string | undefined {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return;
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
  if (MIME.isAudio(contentType)) {
    return i18n('audio');
  }

  return;
}

export class Quote extends React.Component<Props, State> {
  public handleImageErrorBound: () => void;

  public constructor(props: Props) {
    super(props);

    this.handleImageErrorBound = this.handleImageError.bind(this);

    this.state = {
      imageBroken: false,
    };
  }

  public handleImageError() {
    // tslint:disable-next-line no-console
    console.log('Message: Image failed to load; failing over to placeholder');
    this.setState({
      imageBroken: true,
    });
  }

  public renderImage(url: string, i18n: LocalizerType, icon?: string) {
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
      <div className="module-quote__icon-container">
        <img
          src={url}
          alt={i18n('quoteThumbnailAlt')}
          onError={this.handleImageErrorBound}
        />
        {iconElement}
      </div>
    );
  }

  public renderIcon(icon: string) {
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

  public renderGenericFile() {
    const { attachment, isIncoming } = this.props;

    if (!attachment) {
      return;
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

  public renderIconContainer() {
    const { attachment, i18n } = this.props;
    const { imageBroken } = this.state;

    if (!attachment) {
      return null;
    }

    const { contentType, thumbnail } = attachment;
    const objectUrl = getObjectUrl(thumbnail);

    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return objectUrl && !imageBroken
        ? this.renderImage(objectUrl, i18n, 'play')
        : this.renderIcon('movie');
    }
    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return objectUrl && !imageBroken
        ? this.renderImage(objectUrl, i18n)
        : this.renderIcon('image');
    }
    if (MIME.isAudio(contentType)) {
      return this.renderIcon('microphone');
    }

    return null;
  }

  public renderText() {
    const {
      i18n,
      text,
      attachment,
      isIncoming,
      conversationType,
      convoId,
    } = this.props;

    if (text) {
      return (
        <div
          dir="auto"
          className={classNames(
            'module-quote__primary__text',
            isIncoming ? 'module-quote__primary__text--incoming' : null
          )}
        >
          <MessageBody
            isGroup={conversationType === 'group'}
            convoId={convoId}
            text={text}
            disableLinks={true}
            i18n={i18n}
          />
        </div>
      );
    }

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

  public renderClose() {
    const { onClose } = this.props;

    if (!onClose) {
      return null;
    }

    // We don't want the overall click handler for the quote to fire, so we stop
    //   propagation before handing control to the caller's callback.
    const onClick = (e: React.MouseEvent<{}>): void => {
      e.stopPropagation();
      onClose();
    };

    // We need the container to give us the flexibility to implement the iOS design.
    return (
      <div className="module-quote__close-container">
        <div
          className="module-quote__close-button"
          role="button"
          onClick={onClick}
        />
      </div>
    );
  }

  public renderAuthor() {
    const {
      authorProfileName,
      authorPhoneNumber,
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
            i18n={i18n}
            compact={true}
          />
        )}
      </div>
    );
  }

  public renderReferenceWarning() {
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

  public render() {
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
        <div
          onClick={onClick}
          role="button"
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
        </div>
        {this.renderReferenceWarning()}
      </div>
    );
  }
}
