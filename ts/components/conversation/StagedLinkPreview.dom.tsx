// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';
import lodash from 'lodash';

import { CurveType, Image } from './Image.dom.tsx';
import { LinkPreviewDate } from './LinkPreviewDate.dom.tsx';

import type { LinkPreviewForUIType } from '../../types/message/LinkPreviews.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { isImageAttachment } from '../../util/Attachment.std.ts';
import { isCallLink } from '../../types/LinkPreview.std.ts';
import { Avatar } from '../Avatar.dom.tsx';
import { getColorForCallLink } from '../../util/getColorForCallLink.std.ts';
import { getKeyFromCallLink } from '../../util/callLinks.std.ts';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';

const { unescape } = lodash;

export type Props = LinkPreviewForUIType & {
  i18n: LocalizerType;
  imageSize?: number;
  /** @deprecated */
  className?: string;
  onClose?: () => void;
};

export function StagedLinkPreview(props: Props): JSX.Element {
  const {
    date,
    description,
    domain,
    i18n,
    isStickerPack,
    className,
    onClose,
    title,
  } = props;
  const isLoaded = Boolean(domain);

  let maybeContent: JSX.Element | undefined;
  if (isLoaded) {
    if (isStickerPack) {
      maybeContent = (
        <div className={tw('ms-3 flex grow flex-col')}>
          <div
            className={tw(
              'mbs-1 mbe-0.5 type-body-medium font-semibold text-primary'
            )}
          >
            {title}
          </div>
          {description && (
            <div className={tw('mbe-0.5 type-body-medium text-primary')}>
              {unescape(description)}
            </div>
          )}
          <div className={tw('type-body-small text-secondary')}>{domain}</div>
        </div>
      );
    } else if (!title && !description) {
      // No title, no description - display only domain
      maybeContent = (
        <div
          className={classNames(
            'module-staged-link-preview__content',
            'module-staged-link-preview__content--only-url'
          )}
        >
          <div className="module-staged-link-preview__title">{domain}</div>
        </div>
      );
    } else {
      maybeContent = (
        <div className="module-staged-link-preview__content">
          <div className="module-staged-link-preview__title">{title}</div>
          {description && (
            <div className="module-staged-link-preview__description">
              {unescape(description)}
            </div>
          )}
          <div className="module-staged-link-preview__footer">
            <div className="module-staged-link-preview__location">{domain}</div>
            <LinkPreviewDate
              date={date}
              className="module-staged-link-preview__date"
            />
          </div>
        </div>
      );
    }
  }

  if (isStickerPack) {
    return (
      <div
        dir="auto"
        className={tw('m-1.5 flex rounded-xl bg-surface-primary py-2')}
      >
        <Thumbnail {...props} />
        {maybeContent}
        {onClose && (
          <div className={tw('me-2 flex flex-col')}>
            <AxoIconButton.Root
              size="sm"
              variant="strong-secondary"
              symbol="x"
              label={i18n('icu:close')}
              tooltip={false}
              onClick={onClose}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      dir="auto"
      className={classNames(
        'module-staged-link-preview',
        !isLoaded ? 'module-staged-link-preview--is-loading' : null,
        className
      )}
    >
      <Thumbnail {...props} />
      {maybeContent}
      {onClose && (
        <button
          aria-label={i18n('icu:close')}
          className="module-staged-link-preview__close-button"
          onClick={onClose}
          type="button"
        />
      )}
    </div>
  );
}

function Thumbnail({
  domain,
  i18n,
  image,
  imageSize,
  isStickerPack,
  title,
  url,
}: Pick<
  Props,
  'domain' | 'i18n' | 'image' | 'imageSize' | 'isStickerPack' | 'title' | 'url'
>): JSX.Element {
  const isImage = isImageAttachment(image);

  if (!domain) {
    return (
      <div className="module-staged-link-preview__loading">
        {i18n('icu:loadingPreview')}
      </div>
    );
  }

  if (isCallLink(url)) {
    return (
      <div className="module-staged-link-preview__icon-container-call-link">
        <Avatar
          badge={undefined}
          color={getColorForCallLink(getKeyFromCallLink(url))}
          conversationType="callLink"
          i18n={i18n}
          size={64}
          title={title ?? i18n('icu:calling__call-link-default-title')}
        />
      </div>
    );
  }

  if (image && isImage) {
    return (
      <div className="module-staged-link-preview__icon-container">
        <Image
          alt={i18n('icu:stagedPreviewThumbnail', {
            domain,
          })}
          attachment={image}
          curveBottomLeft={CurveType.Tiny}
          curveBottomRight={CurveType.Tiny}
          curveTopLeft={CurveType.Tiny}
          curveTopRight={CurveType.Tiny}
          i18n={i18n}
          url={image.url}
          width={isStickerPack ? 64 : imageSize || 72}
          height={isStickerPack ? 64 : imageSize || 72}
        />
      </div>
    );
  }

  return <div className="module-staged-link-preview__no-image" />;
}
