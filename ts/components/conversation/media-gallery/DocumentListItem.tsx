import React from 'react';
import classNames from 'classnames';

import moment from 'moment';
// tslint:disable-next-line:match-default-export-name
import formatFileSize from 'filesize';

type Props = {
  // Required
  timestamp: number;

  // Optional
  fileName?: string;
  fileSize?: number | null;
  onClick?: () => void;
  shouldShowSeparator?: boolean;
};

export const DocumentListItem = (props: Props) => {
  const { shouldShowSeparator, fileName, fileSize, timestamp } = props;

  const defaultShowSeparator = shouldShowSeparator === undefined ? true : shouldShowSeparator;

  return (
    <div
      className={classNames(
        'module-document-list-item',
        defaultShowSeparator ? 'module-document-list-item--with-separator' : null
      )}
    >
      <div className="module-document-list-item__content" role="button" onClick={props.onClick}>
        <div className="module-document-list-item__icon" />
        <div className="module-document-list-item__metadata">
          <span className="module-document-list-item__file-name">{fileName}</span>
          <span className="module-document-list-item__file-size">
            {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
          </span>
        </div>
        <div className="module-document-list-item__date">
          {moment(timestamp).format('ddd, MMM D, Y')}
        </div>
      </div>
    </div>
  );
};
