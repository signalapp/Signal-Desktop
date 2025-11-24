// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import {
  getAlt,
  getUrl,
  defaultBlurHash,
} from '../../../util/Attachment.std.js';
import type { LinkPreviewMediaItemType } from '../../../types/MediaItem.std.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import { tw } from '../../../axo/tw.dom.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import type { AttachmentStatusType } from '../../../hooks/useAttachmentStatus.std.js';
import { ImageOrBlurhash } from '../../ImageOrBlurhash.dom.js';
import { ListItem } from './ListItem.dom.js';

export type DataProps = Readonly<{
  mediaItem: LinkPreviewMediaItemType;
  onClick: (status: AttachmentStatusType['state']) => void;
  onShowMessage: () => void;
}>;

// Provided by smart layer
export type Props = DataProps &
  Readonly<{
    i18n: LocalizerType;
    theme?: ThemeType;
    authorTitle: string;
  }>;

export function LinkPreviewItem({
  i18n,
  theme,
  mediaItem,
  authorTitle,
  onClick,
  onShowMessage,
}: Props): JSX.Element {
  const { preview } = mediaItem;

  const url = preview.image == null ? undefined : getUrl(preview.image);
  let imageOrPlaceholder: JSX.Element;
  if (preview.image != null && url != null) {
    const resolvedBlurHash = preview.image.blurHash || defaultBlurHash(theme);

    const { width, height } = preview.image;

    imageOrPlaceholder = (
      <div className={tw('size-9 overflow-hidden rounded-sm')}>
        <ImageOrBlurhash
          className={tw('object-cover')}
          src={url}
          intrinsicWidth={width}
          intrinsicHeight={height}
          alt={getAlt(preview.image, i18n)}
          blurHash={resolvedBlurHash}
        />
      </div>
    );
  } else {
    imageOrPlaceholder = (
      <div
        className={tw(
          'flex size-9 items-center justify-center',
          'overflow-hidden rounded-sm',
          'bg-elevated-background-tertiary text-label-secondary'
        )}
      >
        <AxoSymbol.Icon symbol="link" size={20} label={null} />
      </div>
    );
  }

  const subtitle = (
    <>
      <a
        className={tw('type-body-medium text-label-secondary underline')}
        href={preview.url}
        rel="noreferrer"
        target="_blank"
      >
        {preview.url}
      </a>
      <br />
      {authorTitle} · {preview.domain}
    </>
  );

  return (
    <ListItem
      i18n={i18n}
      mediaItem={mediaItem}
      thumbnail={imageOrPlaceholder}
      title={preview.title ?? ''}
      subtitle={subtitle}
      readyLabel={i18n('icu:LinkPreviewItem__alt')}
      onClick={onClick}
      onShowMessage={onShowMessage}
    />
  );
}
