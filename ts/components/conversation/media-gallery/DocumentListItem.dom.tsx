// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import type { ReadonlyDeep } from 'type-fest';

import { formatFileSize } from '../../../util/formatFileSize.std.ts';
import type {
  GenericMediaItemType,
  MediaItemType,
} from '../../../types/MediaItem.std.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { FileThumbnail } from '../../FileThumbnail.dom.tsx';
import {
  useAttachmentStatus,
  type AttachmentStatusType,
} from '../../../hooks/useAttachmentStatus.std.ts';
import { ListItem } from './ListItem.dom.tsx';

export type Props = {
  i18n: LocalizerType;
  mediaItem: MediaItemType;
  authorTitle: string;
  onClick: (status: AttachmentStatusType['state']) => void;
  showMessage: () => void;
  renderContextMenu: (
    mediaItem: ReadonlyDeep<GenericMediaItemType>,
    children: ReactNode
  ) => React.JSX.Element;
};

export function DocumentListItem({
  i18n,
  mediaItem,
  authorTitle,
  onClick,
  showMessage,
  renderContextMenu,
}: Props): React.JSX.Element {
  const { attachment } = mediaItem;

  const { fileName, size: fileSize } = attachment;

  const status = useAttachmentStatus(attachment);

  let glyph: React.JSX.Element | undefined;
  if (status.state !== 'ReadyToShow') {
    glyph = (
      <>
        <AxoSymbol.InlineGlyph symbol="arrow-down" label={null} />
        &nbsp;
      </>
    );
  }

  const subtitle = (
    <>
      {glyph}
      {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
    </>
  );

  const title = new Array<string>();
  if (fileName) {
    title.push(fileName);
  }
  title.push(authorTitle);

  return (
    <ListItem
      i18n={i18n}
      mediaItem={mediaItem}
      thumbnail={<FileThumbnail {...attachment} />}
      title={title.join(' · ')}
      subtitle={subtitle}
      readyLabel={i18n('icu:startDownload')}
      onClick={onClick}
      showMessage={showMessage}
      renderContextMenu={renderContextMenu}
    />
  );
}
