import React from 'react';

import moment from 'moment';
import formatFileSize from 'filesize';

// import { LoadingIndicator } from './LoadingIndicator';


interface Props {
  fileName: string | null;
  fileSize?: number;
  i18n: (key: string, values?: Array<string>) => string;
  timestamp: number;
}

const styles = {
  container: {
    width: '100%',
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
  },
  itemContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    height: '100%',
  } as React.CSSProperties,
  itemMetadata: {
    display: 'inline-flex',
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 0,
    marginLeft: 8,
    marginRight: 8,
  } as React.CSSProperties,
  itemDate: {
    display: 'inline-block',
    flexShrink: 0,
  },
  itemIcon: {
    flexShrink: 0,
  },
  itemFileSize: {
    display: 'inline-block',
    marginTop: 8,
    fontSize: '80%',
  },
};

export class DocumentListEntry extends React.Component<Props, {}> {
  public renderContent() {
    const { fileName, fileSize, timestamp } = this.props;

    // if (!attachment.data) {
    //   return <LoadingIndicator />;
    // }

    return (
      <div
        style={styles.itemContainer}
      >
        <img
          src="images/file.svg"
          width="48"
          height="48"
          style={styles.itemIcon}
        />
        <div
          style={styles.itemMetadata}
        >
          <strong>{fileName}</strong>
          <span
            style={styles.itemFileSize}
          >
            {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
          </span>
        </div>
        <div
          style={styles.itemDate}
        >
          {moment(timestamp).format('ddd, MMM D, Y')}
        </div>
      </div>
    );
  }

  public render() {
    return (
      <div style={styles.container}>
        {this.renderContent()}
      </div>
    );
  }
}
