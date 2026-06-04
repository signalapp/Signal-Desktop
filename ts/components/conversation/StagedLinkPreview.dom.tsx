// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';
import lodash from 'lodash';

import { CurveType, Image } from './Image.dom.tsx';
import { LinkPreviewDate } from './LinkPreviewDate.dom.tsx';

import type { LinkPreviewForUIType } from '../../types/message/LinkPreviews.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { getClassNamesFor } from '../../util/getClassNamesFor.std.ts';
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
  moduleClassName?: string;
  onClose?: () => void;
};

export function StagedLinkPreview(props: Props): JSX.Element {
  const {
    date,
    description,
    domain,
    i18n,
    isStickerPack,
    moduleClassName,
    onClose,
    title,
  } = props;
  const isLoaded = Boolean(domain);

  const getClassName = getClassNamesFor(
    'module-staged-link-preview',
    moduleClassName
  );

  let maybeContent: JSX.Element | undefined;
  if (isLoaded) {
    if (isStickerPack) {
      maybeContent = (
        <div className={tw('ms-3 flex grow flex-col')}>
          <div
            className={tw(
              'mbs-1 mbe-0.5 type-body-medium font-semibold text-label-primary'
            )}
          >
            {title}
          </div>
          {description && (
            <div className={tw('mbe-0.5 type-body-medium text-label-primary')}>
              {unescape(description)}
            </div>
          )}
          <div className={tw('type-body-small text-label-secondary')}>
            {domain}
          </div>
        </div>
      );
    } else if (!title && !description) {
      // No title, no description - display only domain
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

  if (isStickerPack) {
    return (
      <div
        dir="auto"
        className={tw('m-1.5 flex rounded-xl bg-background-primary py-2')}
      >
        <Thumbnail {...props} />
        {maybeContent}
        {onClose && (
          <div className={tw('me-2 flex flex-col')}>
            <AxoIconButton.Root
              size="sm"
              variant="secondary"
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

function Thumbnail({
  domain,
  i18n,
  image,
  imageSize,
  isStickerPack,
  moduleClassName,
  title,
  url,
}: Pick<
  Props,
  | 'domain'
  | 'i18n'
  | 'image'
  | 'imageSize'
  | 'isStickerPack'
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
          i18n={i18n}
          url={image.url}
          width={isStickerPack ? 64 : imageSize || 72}
          height={isStickerPack ? 64 : imageSize || 72}
        />
      </div>
    );
  }

  return <div className={getClassName('__no-image')} />;
}
