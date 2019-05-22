import React from 'react';
import classNames from 'classnames';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../../util/GoogleChrome';
import { Localizer } from '../../../types/Util';
import { MediaItemType } from '../../LightboxGallery';

interface Props {
  mediaItem: MediaItemType;
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
    const { mediaItem, i18n } = this.props;
    const { imageBroken } = this.state;
    const { attachment, contentType } = mediaItem;

    if (!attachment) {
      return null;
    }

    if (contentType && isImageTypeSupported(contentType)) {
      if (imageBroken || !mediaItem.thumbnailObjectUrl) {
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
          src={mediaItem.thumbnailObjectUrl}
          onError={this.onImageErrorBound}
        />
      );
    } else if (contentType && isVideoTypeSupported(contentType)) {
      if (imageBroken || !mediaItem.thumbnailObjectUrl) {
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
            src={mediaItem.thumbnailObjectUrl}
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
