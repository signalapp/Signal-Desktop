// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import moment from 'moment';
import { formatFileSize } from '../../../util/formatFileSize';
import type { MediaItemType } from '../../../types/MediaItem';
import { tw } from '../../../axo/tw';
import { FileThumbnail } from '../../FileThumbnail';

export type Props = {
  // Required
  mediaItem: MediaItemType;

  // Optional
  onClick?: (ev: React.MouseEvent) => void;
};

export function DocumentListItem({ mediaItem, onClick }: Props): JSX.Element {
  const { attachment, message } = mediaItem;

  const { fileName, size: fileSize } = attachment;

  const timestamp = message.receivedAtMs || message.receivedAt;

  return (
    <button
      className={tw('flex w-full flex-row items-center gap-3 py-2')}
      type="button"
      onClick={onClick}
    >
      <div className={tw('shrink-0')}>
        <FileThumbnail {...attachment} />
      </div>
      <div className={tw('grow overflow-hidden text-start')}>
        <h3 className={tw('truncate')}>{fileName}</h3>
        <div className={tw('type-body-small leading-4 text-label-secondary')}>
          {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
        </div>
      </div>
      <div className={tw('shrink-0 type-body-small text-label-secondary')}>
        {moment(timestamp).format('MMM D')}
      </div>
    </button>
  );
}
