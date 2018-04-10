import React from 'react';
import classnames from 'classnames';

// @ts-ignore
import Mime from '../../../js/modules/types/mime';


interface Props {
  i18n: (key: string, values?: Array<string>) => string;
  authorName: string;
  authorColor: string;
  attachments: Array<QuotedAttachment>;
  text: string;
}

interface QuotedAttachment {
  fileName: string;
  contentType: string;
  isVoiceMessage: boolean;
  objectUrl: string;
  thumbnail: {
    contentType: string;
    data: ArrayBuffer;
  }
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

function getContentType(attachments: Array<QuotedAttachment>): string | null {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const first = attachments[0];
  return first.contentType;
}

export class Quote extends React.Component<Props, {}> {
  public renderIcon(first: QuotedAttachment) {
    const contentType = first.contentType;
    const objectUrl = first.objectUrl;

    if (Mime.isVideo(contentType)) {
      // Render play icon on top of thumbnail
      // We'd have to generate our own thumbnail from a local video??
      return <div className='inner play'>Video</div>;
    } else if (Mime.isImage(contentType)) {
      if (objectUrl) {
        return <div className='inner'><img src={objectUrl} /></div>;
      } else {
        return <div className='inner'>Loading Widget</div>
      }
    } else if (Mime.isAudio(contentType)) {
      // Show microphone inner in circle
      return <div className='inner microphone'>Audio</div>;
    } else {
      // Show file icon
      return <div className='inner file'>File</div>;
    }
  }

  public renderIconContainer() {
    const { attachments } = this.props;

    if (!attachments || attachments.length === 0) {
      return null;
    }

    const first = attachments[0];

    return <div className='icon-container'>
      {this.renderIcon(first)}
    </div>
  }

  public renderText() {
    const { i18n, text, attachments } = this.props;

    if (text) {
      return <div className='text'>{text}</div>;
    }

    if (!attachments || attachments.length === 0) {
      return null;
    }

    const contentType = getContentType(attachments);
    const first = attachments[0];
    const fileName = first.fileName;

    console.log(contentType);

    if (Mime.isVideo(contentType)) {
      return <div className='type-label'>{i18n('video')}</div>;
    } else if (Mime.isImage(contentType)) {
      return <div className='type-label'>{i18n('photo')}</div>;
    } else if (Mime.isAudio(contentType) && first.isVoiceMessage) {
      return <div className='type-label'>{i18n('voiceMessage')}</div>;
    } else if (Mime.isAudio(contentType)) {
      console.log(first);
      return <div className='type-label'>{i18n('audio')}</div>;
    }

    return <div className='filename-label'>{fileName}</div>;
  }

  public render() {
    const { authorName, authorColor } = this.props;

    if (!validateQuote(this.props)) {
      return null;
    }

    return (
      <div className={classnames(authorColor, 'quote')} >
        <div className="primary">
          <div className="author">{authorName}</div>
          {this.renderText()}
        </div>
        {this.renderIconContainer()}
      </div>
    );
  }
}
