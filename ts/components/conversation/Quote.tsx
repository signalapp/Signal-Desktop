import React from 'react';
import classnames from 'classnames';

import * as MIME from '../../../ts/types/MIME';
import * as GoogleChrome from '../../../ts/util/GoogleChrome';

import { Emojify } from './Emojify';
import { MessageBody } from './MessageBody';

interface Props {
  attachments: Array<QuotedAttachment>;
  authorColor: string;
  authorProfileName?: string;
  authorTitle: string;
  i18n: (key: string, values?: Array<string>) => string;
  isFromMe: string;
  isIncoming: boolean;
  onClick?: () => void;
  onClose?: () => void;
  text: string;
}

interface QuotedAttachment {
  contentType: MIME.MIMEType;
  fileName: string;
  /* Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: Attachment;
}

interface Attachment {
  contentType: MIME.MIMEType;
  /* Not included in protobuf, and is loaded asynchronously */
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

export class Quote extends React.Component<Props, {}> {
  public renderImage(url: string, icon?: string) {
    const iconElement = icon ? (
      <div className={classnames('icon', 'with-image', icon)} />
    ) : null;

    return (
      <div className="icon-container">
        <div className="inner">
          <img src={url} />
          {iconElement}
        </div>
      </div>
    );
  }

  public renderIcon(icon: string) {
    const { authorColor, isIncoming } = this.props;

    const backgroundColor = isIncoming ? 'white' : authorColor;
    const iconColor = isIncoming ? authorColor : 'white';

    return (
      <div className="icon-container">
        <div className={classnames('circle-background', backgroundColor)} />
        <div className={classnames('icon', icon, iconColor)} />
      </div>
    );
  }

  public renderIconContainer() {
    const { attachments } = this.props;
    if (!attachments || attachments.length === 0) {
      return null;
    }

    const first = attachments[0];
    const { contentType, thumbnail } = first;
    const objectUrl = getObjectUrl(thumbnail);

    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return objectUrl
        ? this.renderImage(objectUrl, 'play')
        : this.renderIcon('movie');
    }
    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return objectUrl ? this.renderImage(objectUrl) : this.renderIcon('image');
    }
    if (MIME.isAudio(contentType)) {
      return this.renderIcon('microphone');
    }

    return this.renderIcon('file');
  }

  public renderText() {
    const { i18n, text, attachments } = this.props;

    if (text) {
      return (
        <div className="text">
          <MessageBody text={text} />
        </div>
      );
    }

    if (!attachments || attachments.length === 0) {
      return null;
    }

    const first = attachments[0];
    const { contentType, fileName, isVoiceMessage } = first;

    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return <div className="type-label">{i18n('video')}</div>;
    }
    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return <div className="type-label">{i18n('photo')}</div>;
    }
    if (MIME.isAudio(contentType) && isVoiceMessage) {
      return <div className="type-label">{i18n('voiceMessage')}</div>;
    }
    if (MIME.isAudio(contentType)) {
      return <div className="type-label">{i18n('audio')}</div>;
    }

    return <div className="filename-label">{fileName}</div>;
  }

  public renderIOSLabel() {
    const {
      i18n,
      isIncoming,
      isFromMe,
      authorTitle,
      authorProfileName,
    } = this.props;

    const profileString = authorProfileName ? ` ~${authorProfileName}` : '';
    const authorName = `${authorTitle}${profileString}`;

    const label = isFromMe
      ? isIncoming
        ? i18n('replyingToYou')
        : i18n('replyingToYourself')
      : i18n('replyingTo', [authorName]);

    return <div className="ios-label">{label}</div>;
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
      <div className="close-container">
        <div className="close-button" onClick={onClick} />
      </div>
    );
  }

  public renderAuthor() {
    const {
      authorColor,
      authorProfileName,
      authorTitle,
      i18n,
      isFromMe,
    } = this.props;

    const authorProfileElement = authorProfileName ? (
      <span className="profile-name">
        ~<Emojify text={authorProfileName} />
      </span>
    ) : null;

    return (
      <div className={classnames(authorColor, 'author')}>
        {isFromMe ? (
          i18n('you')
        ) : (
          <span>
            <Emojify text={authorTitle} /> {authorProfileElement}
          </span>
        )}
      </div>
    );
  }

  public render() {
    const { authorColor, onClick, isFromMe } = this.props;

    if (!validateQuote(this.props)) {
      return null;
    }

    const classes = classnames(
      authorColor,
      'quoted-message',
      isFromMe ? 'from-me' : null,
      !onClick ? 'no-click' : null
    );

    return (
      <div onClick={onClick} className={classes}>
        <div className="primary">
          {this.renderIOSLabel()}
          {this.renderAuthor()}
          {this.renderText()}
        </div>
        {this.renderIconContainer()}
        {this.renderClose()}
      </div>
    );
  }
}
