import React, { useState } from 'react';
import classNames from 'classnames';

import { isImageTypeSupported, isVideoTypeSupported } from '../../../util/GoogleChrome';
import { useEncryptedFileFetch } from '../../../hooks/useEncryptedFileFetch';
import { showLightBox } from '../../../state/ducks/conversations';
import { useDisableDrag } from '../../../hooks/useDisableDrag';
import { LightBoxOptions } from '../SessionConversation';
import { MediaItemType } from '../../lightbox/LightboxGallery';

type Props = {
  mediaItem: MediaItemType;
  mediaItems: Array<MediaItemType>;
};

const MediaGridItemContent = (props: Props) => {
  const { mediaItem } = props;
  const i18n = window.i18n;
  const { attachment, contentType } = mediaItem;

  const urlToDecrypt = mediaItem.thumbnailObjectUrl || '';
  const [imageBroken, setImageBroken] = useState(false);

  const { loading, urlToLoad } = useEncryptedFileFetch(urlToDecrypt, contentType, false);

  // data will be url if loading is finished and '' if not
  const srcData = !loading ? urlToLoad : '';
  const disableDrag = useDisableDrag();

  const onImageError = () => {
    window.log.info('MediaGridItem: Image failed to load; failing over to placeholder');
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
        onDragStart={disableDrag}
      />
    );
  }
  if (contentType && isVideoTypeSupported(contentType)) {
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
          onDragStart={disableDrag}
        />
        <div className="module-media-grid-item__circle-overlay">
          <div className="module-media-grid-item__play-overlay" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames('module-media-grid-item__icon', 'module-media-grid-item__icon-generic')}
    />
  );
};

export const MediaGridItem = (props: Props) => {
  return (
    <div
      className="module-media-grid-item"
      role="button"
      onClick={() => {
        const lightBoxOptions: LightBoxOptions = {
          media: props.mediaItems,
          attachment: props.mediaItem.attachment,
        };

        window.inboxStore?.dispatch(showLightBox(lightBoxOptions));
      }}
    >
      <MediaGridItemContent {...props} />
    </div>
  );
};
