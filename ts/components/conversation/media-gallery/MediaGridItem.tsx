// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import classNames from 'classnames';

import type { ReadonlyDeep } from 'type-fest';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../../util/GoogleChrome';
import type { LocalizerType } from '../../../types/Util';
import type { MediaItemType } from '../../../types/MediaItem';
import { createLogger } from '../../../logging/log';

const log = createLogger('MediaGridItem');

export type Props = {
  mediaItem: ReadonlyDeep<MediaItemType>;
  onClick?: () => void;
  i18n: LocalizerType;
};

function MediaGridItemContent(props: Props) {
  const { mediaItem, i18n } = props;
  const { attachment, contentType } = mediaItem;

  const [imageBroken, setImageBroken] = useState(false);

  const handleImageError = useCallback(() => {
    log.info('Image failed to load; failing over to placeholder');
    setImageBroken(true);
  }, []);

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
        alt={i18n('icu:lightboxImageAlt')}
        className="module-media-grid-item__image"
        src={mediaItem.thumbnailObjectUrl}
        onError={handleImageError}
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
          alt={i18n('icu:lightboxImageAlt')}
          className="module-media-grid-item__image"
          src={mediaItem.thumbnailObjectUrl}
          onError={handleImageError}
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

export function MediaGridItem(props: Props): JSX.Element {
  const { onClick } = props;
  return (
    <button type="button" className="module-media-grid-item" onClick={onClick}>
      <MediaGridItemContent {...props} />
    </button>
  );
}
