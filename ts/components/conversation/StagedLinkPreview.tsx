// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import { CurveType, Image } from './Image.js';
import { LinkPreviewDate } from './LinkPreviewDate.js';

import type { LinkPreviewForUIType } from '../../types/message/LinkPreviews.js';
import type { LocalizerType } from '../../types/Util.js';
import { getClassNamesFor } from '../../util/getClassNamesFor.js';
import { isImageAttachment } from '../../types/Attachment.js';
import { isCallLink } from '../../types/LinkPreview.js';
import { Avatar } from '../Avatar.js';
import { getColorForCallLink } from '../../util/getColorForCallLink.js';
import { getKeyFromCallLink } from '../../util/callLinks.js';

const { unescape } = lodash;

export type Props = LinkPreviewForUIType & {
  i18n: LocalizerType;
  imageSize?: number;
  moduleClassName?: string;
  onClose?: () => void;
};

export function StagedLinkPreview(props: Props): JSX.Element {
  const { date, description, domain, i18n, moduleClassName, onClose, title } =
    props;
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
      dir="auto"
      className={classNames(
        getClassName(''),
        !isLoaded ? getClassName('--is-loading') : null
      )}
    >
      <Thumbnail {...props} />
      {maybeContent}
      {onClose && (
        <button
          aria-label={i18n('icu:close')}
          className={getClassName('__close-button')}
          onClick={onClose}
          type="button"
        />
      )}
    </div>
  );
}

export function Thumbnail({
  domain,
  i18n,
  image,
  imageSize,
  moduleClassName,
  title,
  url,
}: Pick<
  Props,
  | 'domain'
  | 'i18n'
  | 'image'
  | 'imageSize'
  | 'moduleClassName'
  | 'title'
  | 'url'
>): JSX.Element {
  const isImage = isImageAttachment(image);
  const getClassName = getClassNamesFor(
    'module-staged-link-preview',
    moduleClassName
  );

  if (!domain) {
    return (
      <div className={getClassName('__loading')}>
        {i18n('icu:loadingPreview')}
      </div>
    );
  }

  if (isCallLink(url)) {
    return (
      <div className={getClassName('__icon-container-call-link')}>
        <Avatar
          badge={undefined}
          color={getColorForCallLink(getKeyFromCallLink(url))}
          conversationType="callLink"
          i18n={i18n}
          sharedGroupNames={[]}
          size={64}
          title={title ?? i18n('icu:calling__call-link-default-title')}
        />
      </div>
    );
  }

  if (image && isImage) {
    return (
      <div className={getClassName('__icon-container')}>
        <Image
          alt={i18n('icu:stagedPreviewThumbnail', {
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
    );
  }

  return <div className={getClassName('__no-image')} />;
}
