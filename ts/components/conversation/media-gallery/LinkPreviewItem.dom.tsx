// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import type { ReadonlyDeep } from 'type-fest';

import {
  getAlt,
  getUrl,
  defaultBlurHash,
} from '../../../util/Attachment.std.ts';
import type {
  GenericMediaItemType,
  LinkPreviewMediaItemType,
} from '../../../types/MediaItem.std.ts';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import type { AttachmentStatusType } from '../../../hooks/useAttachmentStatus.std.ts';
import { ImageOrBlurhash } from '../../ImageOrBlurhash.dom.tsx';
import { ListItem } from './ListItem.dom.tsx';

export type DataProps = Readonly<{
  mediaItem: LinkPreviewMediaItemType;
  onClick: (status: AttachmentStatusType['state']) => void;
  showMessage: () => void;
  renderContextMenu: (
    mediaItem: ReadonlyDeep<GenericMediaItemType>,
    children: ReactNode
  ) => React.JSX.Element;
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
  showMessage,
  renderContextMenu,
}: Props): React.JSX.Element {
  const { preview } = mediaItem;

  const url = preview.image == null ? undefined : getUrl(preview.image);
  let imageOrPlaceholder: React.JSX.Element;
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
      showMessage={showMessage}
      renderContextMenu={renderContextMenu}
    />
  );
}
