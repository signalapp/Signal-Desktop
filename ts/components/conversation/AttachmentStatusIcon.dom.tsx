// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import classNames from 'classnames';

import { SpinnerV2 } from '../SpinnerV2.dom.js';

import type { AttachmentForUIType } from '../../types/Attachment.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { useAttachmentStatus } from '../../hooks/useAttachmentStatus.std.js';

export type PropsType = {
  attachment: AttachmentForUIType;
  isIncoming: boolean;
  children?: ReactNode;
};

export function AttachmentStatusIcon({
  attachment,
  isIncoming,
  children,
}: PropsType): JSX.Element | null {
  const status = useAttachmentStatus(attachment);

  if (status.state === 'NeedsDownload') {
    return (
      <div className="AttachmentStatusIcon__container">
        <div
          className={classNames(
            'AttachmentStatusIcon__circle-icon-container',
            isIncoming
              ? 'AttachmentStatusIcon__circle-icon-container--incoming'
              : undefined
          )}
        >
          <div
            className={classNames(
              'AttachmentStatusIcon__circle-icon',
              isIncoming
                ? 'AttachmentStatusIcon__circle-icon--incoming'
                : undefined,
              'AttachmentStatusIcon__circle-icon--arrow-down'
            )}
          />
        </div>
      </div>
    );
  }

  if (status.state === 'Downloading') {
    const { size, totalDownloaded: spinnerValue } = status;

    return (
      <div className="AttachmentStatusIcon__container">
        <div
          className={classNames(
            'AttachmentStatusIcon__circle-icon-container',
            isIncoming
              ? 'AttachmentStatusIcon__circle-icon-container--incoming'
              : undefined
          )}
        >
          <div
            className={classNames(
              'AttachmentStatusIcon__progress-container',
              isIncoming
                ? 'AttachmentStatusIcon__progress-container--incoming'
                : undefined
            )}
          >
            <SpinnerV2
              min={0}
              max={size}
              value={spinnerValue}
              variant={isIncoming ? 'no-background-incoming' : 'no-background'}
              size={36}
              strokeWidth={2}
              marginRatio={1}
            />
          </div>
          <div
            className={classNames(
              'AttachmentStatusIcon__circle-icon',
              isIncoming
                ? 'AttachmentStatusIcon__circle-icon--incoming'
                : undefined,
              'AttachmentStatusIcon__circle-icon--x'
            )}
          />
        </div>
      </div>
    );
  }

  if (status.state === 'ReadyToShow') {
    return <div className="AttachmentStatusIcon__container">{children}</div>;
  }

  throw missingCaseError(status);
}
