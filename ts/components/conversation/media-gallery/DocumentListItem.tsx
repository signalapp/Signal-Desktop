import React from 'react';
import classNames from 'classnames';

import moment from 'moment';
// tslint:disable-next-line:match-default-export-name
import formatFileSize from 'filesize';

interface Props {
  // Required
  timestamp: number;

  // Optional
  fileName?: string | null;
  fileSize?: number;
  onClick?: () => void;
  shouldShowSeparator?: boolean;
}

export class DocumentListItem extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    shouldShowSeparator: true,
  };

  public render() {
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
    const { fileName, fileSize, timestamp } = this.props;

    return (
      <div
        className="module-document-list-item__content"
        role="button"
        onClick={this.props.onClick}
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
      </div>
    );
  }
}
