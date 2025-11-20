// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { formatFileSize } from '../../../util/formatFileSize.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import { FileThumbnail } from '../../FileThumbnail.dom.js';
import {
  useAttachmentStatus,
  type AttachmentStatusType,
} from '../../../hooks/useAttachmentStatus.std.js';
import { ListItem } from './ListItem.dom.js';

export type Props = {
  i18n: LocalizerType;
  mediaItem: MediaItemType;
  authorTitle: string;
  onClick: (status: AttachmentStatusType['state']) => void;
  onShowMessage: () => void;
};

export function DocumentListItem({
  i18n,
  mediaItem,
  authorTitle,
  onClick,
  onShowMessage,
}: Props): JSX.Element {
  const { attachment } = mediaItem;

  const { fileName, size: fileSize } = attachment;

  const status = useAttachmentStatus(attachment);

  let glyph: JSX.Element | undefined;
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
      onShowMessage={onShowMessage}
    />
  );
}
