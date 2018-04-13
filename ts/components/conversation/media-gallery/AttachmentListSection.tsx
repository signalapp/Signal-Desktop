/**
 * @prettier
 */
import React from 'react';

import { DocumentListEntry } from './DocumentListEntry';
import { ImageThumbnail } from './ImageThumbnail';
import { Message } from './propTypes/Message';
import { missingCaseError } from '../../../missingCaseError';

const styles = {
  container: {
    width: '100%',
  },
  header: {},
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

    return messages.map(message => {
      const { attachments } = message;
      const firstAttachment = attachments[0];

      switch (type) {
        case 'media':
          return (
            <ImageThumbnail key={message.id} i18n={i18n} message={message} />
          );
        case 'documents':
          return (
            <DocumentListEntry
              key={message.id}
              i18n={i18n}
              fileSize={firstAttachment.size}
              fileName={firstAttachment.fileName}
              timestamp={message.received_at}
            />
          );
        default:
          return missingCaseError(type);
      }
    });
  }

  public render() {
    const { header } = this.props;

    return (
      <div style={styles.container}>
        <div style={styles.header}>{header}</div>
        <div style={styles.itemContainer}>{this.renderItems()}</div>
      </div>
    );
  }
}
