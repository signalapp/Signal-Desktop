// tslint:disable:react-this-binding-issue

import React from 'react';
import classnames from 'classnames';

import * as MIME from '../../../ts/types/MIME';
import * as GoogleChrome from '../../../ts/util/GoogleChrome';

import { Emojify } from './Emojify';
import { MessageBody } from './MessageBody';
import { Localizer } from '../../types/Util';

interface Props {
  attachments: Array<QuotedAttachment>;
  color: string;
  authorProfileName?: string;
  authorTitle: string;
  i18n: Localizer;
  isFromMe: boolean;
  isIncoming: boolean;
  withContentAbove: boolean;
  onClick?: () => void;
  onClose?: () => void;
  text: string;
}

export interface QuotedAttachment {
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

  if (quote.attachments && quote.attachments.length > 0) {
    return true;
  }

  return false;
}

function getObjectUrl(thumbnail: Attachment | undefined): string | null {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return null;
}

function getTypeLabel({
  i18n,
  contentType,
  isVoiceMessage,
}: {
  i18n: Localizer;
  contentType: MIME.MIMEType;
  isVoiceMessage: boolean;
}): string | null {
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

  return null;
}

export class Quote extends React.Component<Props> {
  public renderImage(url: string, i18n: Localizer, icon?: string) {
    const iconElement = icon ? (
      <div className="module-quote__icon-container__inner">
        <div className="module-quote__icon-container__circle-background">
          <div
            className={classnames(
              'module-quote__icon-container__icon',
              `module-quote__icon-container__icon--${icon}`
            )}
          />
        </div>
      </div>
    ) : null;

    return (
      <div className="module-quote__icon-container">
        <img src={url} alt={i18n('quoteThumbnailAlt')} />
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
              className={classnames(
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
    const { attachments } = this.props;

    if (!attachments || !attachments.length) {
      return;
    }

    const first = attachments[0];
    const { fileName, contentType } = first;
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
        <div className="module-quote__generic-file__text">{fileName}</div>
      </div>
    );
  }

  public renderIconContainer() {
    const { attachments, i18n } = this.props;
    if (!attachments || attachments.length === 0) {
      return null;
    }

    const first = attachments[0];
    const { contentType, thumbnail } = first;
    const objectUrl = getObjectUrl(thumbnail);

    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return objectUrl
        ? this.renderImage(objectUrl, i18n, 'play')
        : this.renderIcon('movie');
    }
    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return objectUrl
        ? this.renderImage(objectUrl, i18n)
        : this.renderIcon('image');
    }
    if (MIME.isAudio(contentType)) {
      return this.renderIcon('microphone');
    }

    return null;
  }

  public renderText() {
    const { i18n, text, attachments } = this.props;

    if (text) {
      return (
        <div className="module-quote__primary__text">
          <MessageBody text={text} i18n={i18n} />
        </div>
      );
    }

    if (!attachments || attachments.length === 0) {
      return null;
    }

    const first = attachments[0];
    const { contentType, isVoiceMessage } = first;

    const typeLabel = getTypeLabel({ i18n, contentType, isVoiceMessage });
    if (typeLabel) {
      return (
        <div className="module-quote__primary__type-label">{typeLabel}</div>
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
    const { authorProfileName, authorTitle, i18n, isFromMe } = this.props;

    const authorProfileElement = authorProfileName ? (
      <span className="module-quote__primary__profile-name">
        ~<Emojify text={authorProfileName} i18n={i18n} />
      </span>
    ) : null;

    return (
      <div className="module-quote__primary__author">
        {isFromMe ? (
          i18n('you')
        ) : (
          <span>
            <Emojify text={authorTitle} i18n={i18n} /> {authorProfileElement}
          </span>
        )}
      </div>
    );
  }

  public render() {
    const { color, isIncoming, onClick, withContentAbove } = this.props;

    if (!validateQuote(this.props)) {
      return null;
    }

    return (
      <div
        onClick={onClick}
        role="button"
        className={classnames(
          'module-quote',
          isIncoming ? 'module-quote--incoming' : 'module-quote--outgoing',
          !isIncoming ? `module-quote--outgoing-${color}` : null,
          !onClick ? 'module-quote--no-click' : null,
          withContentAbove ? 'module-quote--with-content-above' : null
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
    );
  }
}
