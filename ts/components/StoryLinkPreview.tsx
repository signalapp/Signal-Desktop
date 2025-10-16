// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import type { LinkPreviewForUIType } from '../types/message/LinkPreviews.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { CurveType, Image } from './conversation/Image.dom.js';
import { isImageAttachment } from '../util/Attachment.std.js';
import { getSafeDomain } from '../types/LinkPreview.std.js';

const { unescape } = lodash;

export type Props = LinkPreviewForUIType & {
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
