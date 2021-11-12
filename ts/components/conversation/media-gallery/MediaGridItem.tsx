// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../../util/GoogleChrome';
import type { LocalizerType } from '../../../types/Util';
import type { MediaItemType } from '../../../types/MediaItem';
import * as log from '../../../logging/log';

export type Props = {
  mediaItem: MediaItemType;
  onClick?: () => void;
  i18n: LocalizerType;
};

type State = {
  imageBroken: boolean;
};

export class MediaGridItem extends React.Component<Props, State> {
  private readonly onImageErrorBound: () => void;

  constructor(props: Props) {
    super(props);

    this.state = {
      imageBroken: false,
    };

    this.onImageErrorBound = this.onImageError.bind(this);
  }

  public onImageError(): void {
    log.info(
      'MediaGridItem: Image failed to load; failing over to placeholder'
    );
    this.setState({
      imageBroken: true,
    });
  }

  public renderContent(): JSX.Element | null {
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
    }
    if (contentType && isVideoTypeSupported(contentType)) {
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

  public override render(): JSX.Element {
    const { onClick } = this.props;

    return (
      <button
        type="button"
        className="module-media-grid-item"
        onClick={onClick}
      >
        {this.renderContent()}
      </button>
    );
  }
}
