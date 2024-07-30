// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import moment from 'moment';
import { formatFileSize } from '../../../util/formatFileSize';

export type Props = {
  // Required
  timestamp: number;

  // Optional
  fileName?: string;
  fileSize?: number;
  onClick?: () => void;
  shouldShowSeparator?: boolean;
};

export function DocumentListItem({
  shouldShowSeparator = true,
  fileName,
  fileSize,
  onClick,
  timestamp,
}: Props): JSX.Element {
  return (
    <div
      className={classNames(
        'module-document-list-item',
        shouldShowSeparator ? 'module-document-list-item--with-separator' : null
      )}
    >
      <button
        type="button"
        className="module-document-list-item__content"
        onClick={onClick}
      >
        <div className="module-document-list-item__icon" />
        <div className="module-document-list-item__metadata">
          <span className="module-document-list-item__file-name">
            {fileName}
          </span>
          <span className="module-document-list-item__file-size">
            {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
          </span>
        </div>
        <div className="module-document-list-item__date">
          {moment(timestamp).format('ddd, MMM D, Y')}
        </div>
      </button>
    </div>
  );
}
