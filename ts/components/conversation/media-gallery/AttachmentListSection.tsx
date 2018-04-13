import React from 'react';

import { ImageThumbnail } from './ImageThumbnail';
import { DocumentListEntry } from './DocumentListEntry';
import { Message } from './propTypes/Message';

const styles = {
  container: {
    width: '100%',
  },
  header: {
  },
  itemContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  } as React.CSSProperties,
};

interface Props {
  i18n: (value: string) => string;
  header?: string;
  type: 'media' | 'documents';
  messages: Array<Message>;
}

export class AttachmentListSection extends React.Component<Props, {}> {
  public renderItems() {
    const { i18n, messages, type } = this.props;
    const Component = type === 'media' ? ImageThumbnail : DocumentListEntry;

    return messages.map((message) => (
      <Component
        key={message.id}
        i18n={i18n}
        message={message}
      />
    ));
  }

  public render() {
    const { header } = this.props;

    return (
      <div style={styles.container}>
        <div style={styles.header}>{header}</div>
        <div style={styles.itemContainer}>
          {this.renderItems()}
        </div>
      </div>
    );
  }
}
