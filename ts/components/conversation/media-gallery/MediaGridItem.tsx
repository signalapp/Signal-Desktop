import React, { useState } from 'react';
import classNames from 'classnames';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../../util/GoogleChrome';
import { LocalizerType } from '../../../types/Util';
import { MediaItemType } from '../../LightboxGallery';
import { useEncryptedFileFetch } from '../../../hooks/useEncryptedFileFetch';

type Props = {
  mediaItem: MediaItemType;
  onClick?: () => void;
  i18n: LocalizerType;
};

const MediaGridItemContent = (props: Props) => {
  const { mediaItem, i18n } = props;
  const { attachment, contentType } = mediaItem;

  const urlToDecrypt = mediaItem.thumbnailObjectUrl || '';
  const [imageBroken, setImageBroken] = useState(false);

  const { loading, urlToLoad } = useEncryptedFileFetch(
    urlToDecrypt,
    contentType
  );
  // data will be url if loading is finished and '' if not
  const srcData = !loading ? urlToLoad : '';

  const onImageError = () => {
    // tslint:disable-next-line no-console
    console.log(
      'MediaGridItem: Image failed to load; failing over to placeholder'
    );
    setImageBroken(true);
  };

  if (!attachment) {
    return null;
  }

  if (contentType && isImageTypeSupported(contentType)) {
    if (imageBroken || !srcData) {
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
        src={srcData}
        onError={onImageError}
      />
    );
  } else if (contentType && isVideoTypeSupported(contentType)) {
    if (imageBroken || !srcData) {
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
          src={srcData}
          onError={onImageError}
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
};

export const MediaGridItem = (props: Props) => {
  return (
    <div
      className="module-media-grid-item"
      role="button"
      onClick={props.onClick}
    >
      <MediaGridItemContent {...props} />
    </div>
  );
};
