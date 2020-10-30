// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Image } from './Image';
import { LinkPreviewDate } from './LinkPreviewDate';

import { AttachmentType, isImageAttachment } from '../../types/Attachment';
import { LocalizerType } from '../../types/Util';

export interface Props {
  isLoaded: boolean;
  title: string;
  description: null | string;
  date: null | number;
  domain: string;
  image?: AttachmentType;

  i18n: LocalizerType;
  onClose?: () => void;
}

export const StagedLinkPreview: React.FC<Props> = ({
  isLoaded,
  onClose,
  i18n,
  title,
  description,
  image,
  date,
  domain,
}: Props) => {
  const isImage = image && isImageAttachment(image);

  return (
    <div
      className={classNames(
        'module-staged-link-preview',
        !isLoaded ? 'module-staged-link-preview--is-loading' : null
      )}
    >
      {!isLoaded ? (
        <div className="module-staged-link-preview__loading">
          {i18n('loadingPreview')}
        </div>
      ) : null}
      {isLoaded && image && isImage ? (
        <div className="module-staged-link-preview__icon-container">
          <Image
            alt={i18n('stagedPreviewThumbnail', [domain])}
            softCorners
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
            <LinkPreviewDate
              date={date}
              className="module-message__link-preview__date"
            />
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
