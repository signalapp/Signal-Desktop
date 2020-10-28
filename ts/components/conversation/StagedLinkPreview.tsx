import React from 'react';
import classNames from 'classnames';

import { Image } from './Image';

import { AttachmentType, isImageAttachment } from '../../types/Attachment';

type Props = {
  isLoaded: boolean;
  title: null | string;
  description: null | string;
  domain: null | string;
  image?: AttachmentType;

  onClose: () => void;
};

export const StagedLinkPreview = (props: Props) => {
  const { isLoaded, onClose, title, image, domain, description } = props;

  const isImage = image && isImageAttachment(image);
  const i18n = window.i18n;
  if (isLoaded && !(title && domain)) {
    return <></>;
  }

  return (
    <div
      className={classNames(
        'module-staged-link-preview',
        !isLoaded ? 'module-staged-link-preview--is-loading' : null
      )}
    >
      {!isLoaded ? (
        <div className="module-staged-link-preview__loading">
          {i18n('loading')}
        </div>
      ) : null}
      {isLoaded && image && isImage ? (
        <div className="module-staged-link-preview__icon-container">
          <Image
            alt={i18n('stagedPreviewThumbnail', [domain])}
            softCorners={true}
            height={72}
            width={72}
            url={image.url}
            attachment={image}
            i18n={i18n}
          />
        </div>
      ) : null}
      {isLoaded ? (
        <div className="module-staged-link-preview__content">
          <div className="module-staged-link-preview__title">{title}</div>
          {description && (
            <div className="module-staged-link-preview__description">
              {description}
            </div>
          )}
          <div className="module-staged-link-preview__footer">
            <div className="module-staged-link-preview__location">{domain}</div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="module-staged-link-preview__close-button"
        onClick={onClose}
        aria-label={i18n('close')}
      />
    </div>
  );
};
