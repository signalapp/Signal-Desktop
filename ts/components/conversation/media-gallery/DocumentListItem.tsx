// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import moment from 'moment';
import formatFileSize from 'filesize';

type Props = {
  // Required
  timestamp: number;

  // Optional
  fileName?: string;
  fileSize?: number;
  onClick?: () => void;
  shouldShowSeparator?: boolean;
};

export class DocumentListItem extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    shouldShowSeparator: true,
  };

  public override render(): JSX.Element {
    const { shouldShowSeparator } = this.props;

    return (
      <div
        className={classNames(
          'module-document-list-item',
          shouldShowSeparator
            ? 'module-document-list-item--with-separator'
            : null
        )}
      >
        {this.renderContent()}
      </div>
    );
  }

  private renderContent() {
    const { fileName, fileSize, onClick, timestamp } = this.props;

    return (
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
            {typeof fileSize === 'number'
              ? formatFileSize(fileSize, { round: 0 })
              : ''}
          </span>
        </div>
        <div className="module-document-list-item__date">
          {moment(timestamp).format('ddd, MMM D, Y')}
        </div>
      </button>
    );
  }
}
