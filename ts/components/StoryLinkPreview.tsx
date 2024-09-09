// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { unescape } from 'lodash';

import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { LocalizerType } from '../types/Util';
import { CurveType, Image } from './conversation/Image';
import { isImageAttachment } from '../types/Attachment';
import { getSafeDomain } from '../types/LinkPreview';

export type Props = LinkPreviewType & {
  forceCompactMode?: boolean;
  i18n: LocalizerType;
};

export function StoryLinkPreview({
  description,
  domain,
  forceCompactMode,
  i18n,
  image,
  title,
  url,
}: Props): JSX.Element {
  const isImage = isImageAttachment(image);
  const location = domain || getSafeDomain(String(url));
  const isCompact = forceCompactMode || !image;

  let content: JSX.Element | undefined;
  if (!title && !description) {
    content = (
      <div
        className={classNames(
          'StoryLinkPreview__content',
          'StoryLinkPreview__content--only-url'
        )}
      >
        <div className="StoryLinkPreview__title">{location}</div>
      </div>
    );
  } else {
    content = (
      <div className="StoryLinkPreview__content">
        <div className="StoryLinkPreview__title">{title}</div>
        {description && (
          <div className="StoryLinkPreview__description">
            {unescape(description)}
          </div>
        )}
        <div className="StoryLinkPreview__footer">
          <div className="StoryLinkPreview__location">{location}</div>
        </div>
      </div>
    );
  }

  const imageWidth = isCompact ? 176 : 560;
  const imageHeight =
    !isCompact && image
      ? imageWidth / ((image.width || 1) / (image.height || 1))
      : 176;

  return (
    <div
      className={classNames('StoryLinkPreview', {
        'StoryLinkPreview--tall': !isCompact,
        'StoryLinkPreview--tiny': !title && !description && !image,
      })}
    >
      {isImage && image ? (
        <div className="StoryLinkPreview__icon-container">
          <Image
            alt={i18n('icu:stagedPreviewThumbnail', {
              domain: location || '',
            })}
            attachment={image}
            curveBottomLeft={CurveType.Tiny}
            curveBottomRight={CurveType.Tiny}
            curveTopLeft={CurveType.Tiny}
            curveTopRight={CurveType.Tiny}
            height={imageHeight}
            i18n={i18n}
            url={image.url}
            width={imageWidth}
          />
        </div>
      ) : null}
      {!isImage && <div className="StoryLinkPreview__no-image" />}
      {content}
    </div>
  );
}
