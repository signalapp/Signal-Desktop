// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import moment from 'moment';
import { formatFileSize } from '../../../util/formatFileSize.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { SpinnerV2 } from '../../SpinnerV2.dom.js';
import { tw } from '../../../axo/tw.dom.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import { FileThumbnail } from '../../FileThumbnail.dom.js';
import {
  useAttachmentStatus,
  type AttachmentStatusType,
} from '../../../hooks/useAttachmentStatus.std.js';

export type Props = {
  i18n: LocalizerType;
  // Required
  mediaItem: MediaItemType;

  // Optional
  onClick?: (status: AttachmentStatusType['state']) => void;
};

export function DocumentListItem({
  i18n,
  mediaItem,
  onClick,
}: Props): JSX.Element {
  const { attachment, message } = mediaItem;

  const { fileName, size: fileSize } = attachment;

  const timestamp = message.receivedAtMs || message.receivedAt;

  let label: string;

  const status = useAttachmentStatus(attachment);

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      onClick?.(status.state);
    },
    [onClick, status.state]
  );

  if (status.state === 'NeedsDownload') {
    label = i18n('icu:downloadAttachment');
  } else if (status.state === 'Downloading') {
    label = i18n('icu:cancelDownload');
  } else if (status.state === 'ReadyToShow') {
    label = i18n('icu:startDownload');
  } else {
    throw missingCaseError(status);
  }

  let glyph: JSX.Element | undefined;
  let button: JSX.Element | undefined;
  if (status.state !== 'ReadyToShow') {
    glyph = (
      <>
        <AxoSymbol.InlineGlyph symbol="arrow-down" label={null} />
        &nbsp;
      </>
    );
    button = (
      <div
        className={tw(
          'relative -ms-1 size-7 shrink-0 rounded-full bg-fill-secondary',
          'flex items-center justify-center'
        )}
      >
        {status.state === 'Downloading' && (
          <SpinnerV2
            variant="no-background-incoming"
            size={28}
            strokeWidth={1}
            marginRatio={1}
            min={0}
            max={status.size}
            value={status.totalDownloaded}
          />
        )}
        <div className={tw('absolute text-label-primary')}>
          <AxoSymbol.Icon
            symbol={status.state === 'Downloading' ? 'x' : 'arrow-down'}
            size={16}
            label={null}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      className={tw('flex w-full flex-row items-center gap-3 py-2')}
      type="button"
      onClick={handleClick}
      aria-label={label}
    >
      <div className={tw('shrink-0')}>
        <FileThumbnail {...attachment} />
      </div>
      <div className={tw('grow overflow-hidden text-start')}>
        <h3 className={tw('truncate')}>{fileName}</h3>
        <div className={tw('type-body-small leading-4 text-label-secondary')}>
          {glyph}
          {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
        </div>
      </div>
      <div className={tw('shrink-0 type-body-small text-label-secondary')}>
        {moment(timestamp).format('MMM D')}
      </div>
      {button}
    </button>
  );
}
