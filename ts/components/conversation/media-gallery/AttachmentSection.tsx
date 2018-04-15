/**
 * @prettier
 */
import React from 'react';

import { DocumentListItem } from './DocumentListItem';
import { ItemClickEvent } from './events/ItemClickEvent';
import { MediaGridItem } from './MediaGridItem';
import { Message } from './propTypes/Message';
import { missingCaseError } from '../../../util/missingCaseError';

const styles = {
  container: {
    width: '100%',
  },
  header: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: '28px',
  } as React.CSSProperties,
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
  onItemClick?: (event: ItemClickEvent) => void;
}

export class AttachmentSection extends React.Component<Props, {}> {
  public render() {
    const { header } = this.props;

    return (
      <div style={styles.container}>
        <h2 style={styles.header}>{header}</h2>
        <div style={styles.itemContainer}>{this.renderItems()}</div>
      </div>
    );
  }

  private renderItems() {
    const { i18n, messages, type } = this.props;

    return messages.map(message => {
      const { attachments } = message;
      const firstAttachment = attachments[0];

      const onClick = this.createClickHandler(message);
      switch (type) {
        case 'media':
          return (
            <MediaGridItem
              key={message.received_at}
              message={message}
              onClick={onClick}
            />
          );
        case 'documents':
          return (
            <DocumentListItem
              key={message.received_at}
              i18n={i18n}
              fileSize={firstAttachment.size}
              fileName={firstAttachment.fileName}
              timestamp={message.received_at}
              onClick={onClick}
            />
          );
        default:
          return missingCaseError(type);
      }
    });
  }

  private createClickHandler = (message: Message) => () => {
    const { onItemClick } = this.props;
    if (!onItemClick) {
      return;
    }

    onItemClick({ message });
  };
}
