// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { unescape } from 'lodash';

import { CurveType, Image } from './Image';
import { LinkPreviewDate } from './LinkPreviewDate';

import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import type { LocalizerType } from '../../types/Util';
import { getClassNamesFor } from '../../util/getClassNamesFor';
import { isImageAttachment } from '../../types/Attachment';

export type Props = LinkPreviewType & {
  i18n: LocalizerType;
  imageSize?: number;
  moduleClassName?: string;
  onClose?: () => void;
};

export function StagedLinkPreview({
  date,
  description,
  domain,
  i18n,
  image,
  imageSize,
  moduleClassName,
  onClose,
  title,
}: Props): JSX.Element {
  const isImage = isImageAttachment(image);
  const isLoaded = Boolean(domain);

  const getClassName = getClassNamesFor(
    'module-staged-link-preview',
    moduleClassName
  );

  let maybeContent: JSX.Element | undefined;
  if (isLoaded) {
    // No title, no description - display only domain
    if (!title && !description) {
      maybeContent = (
        <div
          className={classNames(
            getClassName('__content'),
            getClassName('__content--only-url')
          )}
        >
          <div className={getClassName('__title')}>{domain}</div>
        </div>
      );
    } else {
      maybeContent = (
        <div className={getClassName('__content')}>
          <div className={getClassName('__title')}>{title}</div>
          {description && (
            <div className={getClassName('__description')}>
              {unescape(description)}
            </div>
          )}
          <div className={getClassName('__footer')}>
            <div className={getClassName('__location')}>{domain}</div>
            <LinkPreviewDate date={date} className={getClassName('__date')} />
          </div>
        </div>
      );
    }
  }

  return (
    <div
      className={classNames(
        getClassName(''),
        !isLoaded ? getClassName('--is-loading') : null
      )}
    >
      {!isLoaded ? (
        <div className={getClassName('__loading')}>
          {i18n('loadingPreview')}
        </div>
      ) : null}
      {isLoaded && image && isImage && domain ? (
        <div className={getClassName('__icon-container')}>
          <Image
            alt={i18n('stagedPreviewThumbnail', {
              domain,
            })}
            attachment={image}
            curveBottomLeft={CurveType.Tiny}
            curveBottomRight={CurveType.Tiny}
            curveTopLeft={CurveType.Tiny}
            curveTopRight={CurveType.Tiny}
            height={imageSize || 72}
            i18n={i18n}
            url={image.url}
            width={imageSize || 72}
          />
        </div>
      ) : null}
      {isLoaded && !image && <div className={getClassName('__no-image')} />}
      {maybeContent}
      {onClose && (
        <button
          aria-label={i18n('close')}
          className={getClassName('__close-button')}
          onClick={onClose}
          type="button"
        />
      )}
    </div>
  );
}
