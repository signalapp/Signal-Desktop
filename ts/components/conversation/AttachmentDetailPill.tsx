// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { formatFileSize } from '../../util/formatFileSize';
import { ProgressCircle } from '../ProgressCircle';

import type { AttachmentForUIType } from '../../types/Attachment';
import type { LocalizerType } from '../../types/I18N';
import { Spinner } from '../Spinner';
import { isKeyboardActivation } from '../../hooks/useKeyboardShortcuts';

export type PropsType = {
  attachments: ReadonlyArray<AttachmentForUIType>;
  i18n: LocalizerType;
  isGif?: boolean;
  startDownload: () => void;
  cancelDownload: () => void;
};

export function AttachmentDetailPill({
  attachments,
  cancelDownload,
  i18n,
  isGif,
  startDownload,
}: PropsType): JSX.Element | null {
  const areAllDownloaded = attachments.every(attachment => attachment.path);
  const totalSize = attachments.reduce(
    (total: number, attachment: AttachmentForUIType) => {
      return total + (attachment.size ?? 0);
    },
    0
  );

  const startDownloadClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (startDownload) {
        event.preventDefault();
        event.stopPropagation();
        startDownload();
      }
    },
    [startDownload]
  );
  const startDownloadKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (startDownload && isKeyboardActivation(event.nativeEvent)) {
        event.preventDefault();
        event.stopPropagation();
        startDownload();
      }
    },
    [startDownload]
  );
  const cancelDownloadClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (cancelDownload) {
        event.preventDefault();
        event.stopPropagation();
        cancelDownload();
      }
    },
    [cancelDownload]
  );
  const cancelDownloadKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (cancelDownload && (event.key === 'Enter' || event.key === 'Space')) {
        event.preventDefault();
        event.stopPropagation();
        cancelDownload();
      }
    },
    [cancelDownload]
  );

  if (areAllDownloaded || totalSize === 0) {
    return null;
  }

  const areAnyIncremental = attachments.some(
    attachment => attachment.incrementalMac && attachment.chunkSize
  );
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

  if (areAnyIncremental) {
    let ariaLabel: string;
    let onClick: (event: React.MouseEvent) => void;
    let onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    let control: JSX.Element;
    let text: JSX.Element;

    if (!areAnyPending && totalDownloadedSize > 0) {
      ariaLabel = i18n('icu:AttachmentDetailPill__retryDownload');
      onClick = startDownloadClick;
      onKeyDown = startDownloadKeyDown;
      control = (
        <div className="AttachmentDetailPill__icon-wrapper">
          <div className="AttachmentDetailPill__download-icon" />
        </div>
      );
      text = (
        <div className="AttachmentDetailPill__text-wrapper">
          {i18n('icu:AttachmentDetailPill__retryDownloadShort')}
        </div>
      );
    } else if (!areAnyPending) {
      ariaLabel = i18n('icu:startDownload');
      onClick = startDownloadClick;
      onKeyDown = startDownloadKeyDown;
      control = (
        <div className="AttachmentDetailPill__icon-wrapper">
          <div className="AttachmentDetailPill__download-icon" />
        </div>
      );
      text = (
        <div className="AttachmentDetailPill__text-wrapper">
          {formatFileSize(totalSize)}
        </div>
      );
    } else if (totalDownloadedSize > 0) {
      const downloadFraction = totalDownloadedSize / totalSize;

      ariaLabel = i18n('icu:cancelDownload');
      onClick = cancelDownloadClick;
      onKeyDown = cancelDownloadKeyDown;
      control = (
        <div className="AttachmentDetailPill__spinner-wrapper">
          <ProgressCircle
            fractionComplete={downloadFraction}
            width={24}
            strokeWidth={2}
          />
          <div className="AttachmentDetailPill__stop-icon" />
        </div>
      );
      text = (
        <div className="AttachmentDetailPill__text-wrapper">
          {totalDownloadedSize > 0 && areAnyPending
            ? `${formatFileSize(totalDownloadedSize)} / `
            : undefined}
          {formatFileSize(totalSize)}
        </div>
      );
    } else {
      ariaLabel = i18n('icu:cancelDownload');
      onClick = cancelDownloadClick;
      onKeyDown = cancelDownloadKeyDown;
      control = (
        <div className="AttachmentDetailPill__spinner-wrapper">
          <Spinner svgSize="small" size="24px" />
          <div className="AttachmentDetailPill__stop-icon" />
        </div>
      );
      text = (
        <div className="AttachmentDetailPill__text-wrapper">
          {formatFileSize(totalSize)}
        </div>
      );
    }

    return (
      <button
        type="button"
        className={classNames(
          'AttachmentDetailPill',
          'AttachmentDetailPill--interactive'
        )}
        aria-label={ariaLabel}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {control}
        {text}
      </button>
    );
  }

  return (
    <div className="AttachmentDetailPill">
      <div className="AttachmentDetailPill__text-wrapper">
        {totalDownloadedSize > 0 && areAnyPending
          ? `${formatFileSize(totalDownloadedSize)} / `
          : undefined}
        {formatFileSize(totalSize)}
        {isGif ? ' · GIF' : undefined}
      </div>
    </div>
  );
}
