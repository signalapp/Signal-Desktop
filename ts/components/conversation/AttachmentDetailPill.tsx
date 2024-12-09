// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { formatFileSize } from '../../util/formatFileSize';

import type { AttachmentForUIType } from '../../types/Attachment';
import type { LocalizerType } from '../../types/I18N';

export type PropsType = {
  attachments: ReadonlyArray<AttachmentForUIType>;
  i18n: LocalizerType;
  isGif?: boolean;
  startDownload: () => void;
  cancelDownload: () => void;
};

export function AttachmentDetailPill({
  attachments,
  isGif,
}: PropsType): JSX.Element | null {
  const areAllDownloaded = attachments.every(attachment => attachment.path);
  const totalSize = attachments.reduce(
    (total: number, attachment: AttachmentForUIType) => {
      return total + (attachment.size ?? 0);
    },
    0
  );

  if (areAllDownloaded || totalSize === 0) {
    return null;
  }

  const totalDownloadedSize = attachments.reduce(
    (total: number, attachment: AttachmentForUIType) => {
      return (
        total +
        (attachment.path ? attachment.size : (attachment.totalDownloaded ?? 0))
      );
    },
    0
  );
  const areAnyPending = attachments.some(attachment => attachment.pending);

  return (
    <div className="AttachmentDetailPill">
      <div className="AttachmentDetailPill__text-wrapper">
        {totalDownloadedSize > 0 && areAnyPending
          ? `${formatFileSize(totalDownloadedSize, 2)} / `
          : undefined}
        {formatFileSize(totalSize, 2)}
        {isGif ? ' · GIF' : undefined}
      </div>
    </div>
  );
}
