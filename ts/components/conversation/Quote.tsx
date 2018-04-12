import React from 'react';
import classnames from 'classnames';

// @ts-ignore
import Mime from '../../../js/modules/types/mime';


interface Props {
  attachments: Array<QuotedAttachment>;
  authorColor: string;
  authorProfileName?: string;
  authorTitle: string;
  i18n: (key: string, values?: Array<string>) => string;
  isIncoming: boolean;
  openQuotedMessage?: () => void;
  quoterAuthorColor?: string;
  text: string;
}

interface QuotedAttachment {
  contentType: string;
  fileName: string;
  /* Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: Attachment;
}

interface Attachment {
  contentType: string;
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
    const iconElement = icon
      ? <div className={classnames('icon', icon)} />
      : null;

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
    const { authorColor, isIncoming, quoterAuthorColor } = this.props;

    const backgroundColor = isIncoming ? 'white' : authorColor;
    const iconColor = isIncoming ? quoterAuthorColor : 'white';

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

    if (Mime.isVideo(contentType)) {
      return objectUrl
        ? this.renderImage(objectUrl, 'play')
        : this.renderIcon('play');
    }
    if (Mime.isImage(contentType)) {
      return objectUrl
        ? this.renderImage(objectUrl)
        : this.renderIcon('image');
    }
    if (Mime.isAudio(contentType)) {
      return this.renderIcon('microphone');
    }

    return this.renderIcon('file');
  }

  public renderText() {
    const { i18n, text, attachments } = this.props;

    if (text) {
      return <div className="text">{text}</div>;
    }

    if (!attachments || attachments.length === 0) {
      return null;
    }

    const first = attachments[0];
    const { contentType, fileName, isVoiceMessage } = first;

    if (Mime.isVideo(contentType)) {
      return <div className="type-label">{i18n('video')}</div>;
    }
    if (Mime.isImage(contentType)) {
      return <div className="type-label">{i18n('photo')}</div>;
    }
    if (Mime.isAudio(contentType) && isVoiceMessage) {
      return <div className="type-label">{i18n('voiceMessage')}</div>;
    }
    if (Mime.isAudio(contentType)) {
      return <div className="type-label">{i18n('audio')}</div>;
    }

    return <div className="filename-label">{fileName}</div>;
  }

  public render() {
    const {
      authorTitle,
      authorProfileName,
      authorColor,
      openQuotedMessage,
    } = this.props;

    if (!validateQuote(this.props)) {
      return null;
    }

    const authorProfileElement = authorProfileName
      ? <span className="profile-name">~{authorProfileName}</span>
      : null;

    return (
      <div onClick={openQuotedMessage} className={classnames(authorColor, 'quote')} >
        <div className="primary">
          <div className={classnames(authorColor, 'author')}>
            {authorTitle}{' '}{authorProfileElement}
           </div>
          {this.renderText()}
        </div>
        {this.renderIconContainer()}
      </div>
    );
  }
}
