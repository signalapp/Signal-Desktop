// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import moment from 'moment';
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

export type DataProps = Readonly<{
  // Required
  mediaItem: LinkPreviewMediaItemType;

  // Optional
  onClick?: (status: AttachmentStatusType['state']) => void;
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
}: Props): JSX.Element {
  const { preview, message } = mediaItem;

  const timestamp = message.receivedAtMs || message.receivedAt;

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      onClick?.('ReadyToShow');
    },
    [onClick]
  );

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
          'overflow-hidden rounded-sm bg-elevated-background-tertiary'
        )}
      >
        <AxoSymbol.Icon symbol="link" size={20} label={null} />
      </div>
    );
  }

  return (
    <button
      className={tw('flex w-full flex-row gap-3 py-2')}
      type="button"
      onClick={handleClick}
      aria-label={i18n('icu:LinkPreviewItem__alt')}
    >
      <div className={tw('shrink-0')}>{imageOrPlaceholder}</div>
      <div className={tw('grow overflow-hidden text-start')}>
        <h3 className={tw('truncate type-body-large')}>
          {preview.title ?? ''}
        </h3>
        <div
          className={tw(
            'truncate type-body-small leading-4 text-label-secondary'
          )}
        >
          <a
            className={tw('type-body-medium text-label-secondary underline')}
            href={preview.url}
            rel="noreferrer"
            target="_blank"
          >
            {preview.url}
          </a>
        </div>
        <div className={tw('truncate type-body-small text-label-secondary')}>
          {authorTitle} · {preview.domain}
        </div>
      </div>
      <div className={tw('shrink-0 type-body-small text-label-secondary')}>
        {moment(timestamp).format('MMM D')}
      </div>
    </button>
  );
}
