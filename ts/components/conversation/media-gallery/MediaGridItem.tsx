import React from 'react';

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

    if (!message.objectURL) {
      return null;
    }

    return (
      <img
        alt={i18n('lightboxImageAlt')}
        className="module-media-grid-item__image"
        src={message.objectURL}
      />
    );
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
