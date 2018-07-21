import React from 'react';
import classNames from 'classnames';

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

interface State {
  imageBroken: boolean;
}

export class MediaGridItem extends React.Component<Props, State> {
  private onImageErrorBound: () => void;

  constructor(props: Props) {
    super(props);

    this.state = {
      imageBroken: false,
    };

    this.onImageErrorBound = this.onImageError.bind(this);
  }

  public onImageError() {
    // tslint:disable-next-line no-console
    console.log(
      'MediaGridItem: Image failed to load; failing over to placeholder'
    );
    this.setState({
      imageBroken: true,
    });
  }

  public renderContent() {
    const { message, i18n } = this.props;
    const { imageBroken } = this.state;
    const { attachments } = message;

    if (!attachments || !attachments.length) {
      return null;
    }

    const first = attachments[0];
    const { contentType } = first;

    if (contentType && isImageTypeSupported(contentType)) {
      if (imageBroken || !message.thumbnailObjectUrl) {
        return (
          <div
            className={classNames(
              'module-media-grid-item__icon',
              'module-media-grid-item__icon-image'
            )}
          />
        );
      }

      return (
        <img
          alt={i18n('lightboxImageAlt')}
          className="module-media-grid-item__image"
          src={message.thumbnailObjectUrl}
          onError={this.onImageErrorBound}
        />
      );
    } else if (contentType && isVideoTypeSupported(contentType)) {
      if (imageBroken || !message.thumbnailObjectUrl) {
        return (
          <div
            className={classNames(
              'module-media-grid-item__icon',
              'module-media-grid-item__icon-video'
            )}
          />
        );
      }

      return (
        <div className="module-media-grid-item__image-container">
          <img
            alt={i18n('lightboxImageAlt')}
            className="module-media-grid-item__image"
            src={message.thumbnailObjectUrl}
            onError={this.onImageErrorBound}
          />
          <div className="module-media-grid-item__circle-overlay">
            <div className="module-media-grid-item__play-overlay" />
          </div>
        </div>
      );
    }

    return (
      <div
        className={classNames(
          'module-media-grid-item__icon',
          'module-media-grid-item__icon-generic'
        )}
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
