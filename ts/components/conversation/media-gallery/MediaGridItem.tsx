import React from 'react';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../../util/GoogleChrome';
import { Message } from './types/Message';
import { Localizer } from '../../../types/Util';

interface Props {
  message: Message;
  onClick?: () => void;
  i18n: Localizer;
}

export class MediaGridItem extends React.Component<Props> {
  public renderContent() {
    const { message, i18n } = this.props;
    const { attachments } = message;

    if (!message.thumbnailObjectUrl) {
      return null;
    }
    if (!attachments || !attachments.length) {
      return null;
    }

    const first = attachments[0];
    const { contentType } = first;

    if (contentType && isImageTypeSupported(contentType)) {
      return (
        <img
          alt={i18n('lightboxImageAlt')}
          className="module-media-grid-item__image"
          src={message.thumbnailObjectUrl}
        />
      );
    } else if (contentType && isVideoTypeSupported(contentType)) {
      return (
        <div className="module-media-grid-item__image-container">
          <img
            alt={i18n('lightboxImageAlt')}
            className="module-media-grid-item__image"
            src={message.thumbnailObjectUrl}
          />
          <div className="module-media-grid-item__circle-overlay">
            <div className="module-media-grid-item__play-overlay" />
          </div>
        </div>
      );
    }

    return null;
  }

  public render() {
    return (
      <div
        className="module-media-grid-item"
        role="button"
        onClick={this.props.onClick}
      >
        {this.renderContent()}
      </div>
    );
  }
}
