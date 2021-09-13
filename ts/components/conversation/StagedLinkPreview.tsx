import React from 'react';
import classNames from 'classnames';

import { Image } from './Image';

import { AttachmentType, isImageAttachment } from '../../types/Attachment';
import { SessionSpinner } from '../session/SessionSpinner';

type Props = {
  isLoaded: boolean;
  title: null | string;
  url: null | string;
  description: null | string;
  domain: null | string;
  image?: AttachmentType;

  onClose: (url: string) => void;
};

export const StagedLinkPreview = (props: Props) => {
  const { isLoaded, onClose, title, image, domain, description, url } = props;

  const isImage = image && isImageAttachment(image);
  if (isLoaded && !(title && domain)) {
    return <></>;
  }

  const isLoading = !isLoaded;

  return (
    <div
      className={classNames(
        'module-staged-link-preview',
        isLoading ? 'module-staged-link-preview--is-loading' : null
      )}
    >
      {isLoading ? <SessionSpinner loading={isLoading} /> : null}
      {isLoaded && image && isImage ? (
        <div className="module-staged-link-preview__icon-container">
          <Image
            alt={window.i18n('stagedPreviewThumbnail', [domain])}
            softCorners={true}
            height={72}
            width={72}
            url={image.url}
            attachment={image}
          />
        </div>
      ) : null}
      {isLoaded ? (
        <div className="module-staged-link-preview__content">
          <div className="module-staged-link-preview__title">{title}</div>
          {description && (
            <div className="module-staged-link-preview__description">{description}</div>
          )}
          <div className="module-staged-link-preview__footer">
            <div className="module-staged-link-preview__location">{domain}</div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="module-staged-link-preview__close-button"
        onClick={() => {
          onClose(url || '');
        }}
        aria-label={window.i18n('close')}
      />
    </div>
  );
};
