import React from 'react';
import classNames from 'classnames';

import { Image } from './Image';

import { SessionSpinner } from '../basic/SessionSpinner';
import { StagedLinkPreviewImage } from './composition/CompositionBox';
import { isImage } from '../../types/MIME';
import { fromArrayBufferToBase64 } from '../../session/utils/String';

type Props = {
  isLoaded: boolean;
  title: null | string;
  url: null | string;
  domain: null | string;
  image?: StagedLinkPreviewImage;

  onClose: (url: string) => void;
};

export const StagedLinkPreview = (props: Props) => {
  const { isLoaded, onClose, title, image, domain, url } = props;

  const isContentTypeImage = image && isImage(image.contentType);
  if (isLoaded && !(title && domain)) {
    return null;
  }

  const isLoading = !isLoaded;

  const dataToRender = image?.data
    ? `data:image/jpeg;base64, ${fromArrayBufferToBase64(image?.data)}`
    : '';

  return (
    <div
      className={classNames(
        'module-staged-link-preview',
        isLoading ? 'module-staged-link-preview--is-loading' : null
      )}
    >
      {isLoading ? <SessionSpinner loading={isLoading} /> : null}
      {isLoaded && image && isContentTypeImage ? (
        <div className="module-staged-link-preview__icon-container">
          <Image
            alt={window.i18n('stagedPreviewThumbnail', [domain || ''])}
            softCorners={true}
            height={72}
            width={72}
            url={dataToRender}
            attachment={image as any}
          />
        </div>
      ) : null}
      {isLoaded ? (
        <div className="module-staged-link-preview__content">
          <div className="module-staged-link-preview__title">{title}</div>

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
