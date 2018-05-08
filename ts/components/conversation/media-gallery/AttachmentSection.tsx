import React from 'react';

import { AttachmentType } from './types/AttachmentType';
import { DocumentListItem } from './DocumentListItem';
import { ItemClickEvent } from './types/ItemClickEvent';
import { MediaGridItem } from './MediaGridItem';
import { Message } from './types/Message';
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
  type: AttachmentType;
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

    return messages.map((message, index, array) => {
      const isLast = index === array.length - 1;
      const { attachments } = message;
      const firstAttachment = attachments[0];

      const onClick = this.createClickHandler(message);
      switch (type) {
        case 'media':
          return (
            <MediaGridItem
              key={message.id}
              message={message}
              onClick={onClick}
            />
          );
        case 'documents':
          return (
            <DocumentListItem
              key={message.id}
              fileName={firstAttachment.fileName}
              fileSize={firstAttachment.size}
              i18n={i18n}
              isLast={isLast}
              onClick={onClick}
              timestamp={message.received_at}
            />
          );
        default:
          return missingCaseError(type);
      }
    });
  }

  private createClickHandler = (message: Message) => () => {
    const { onItemClick, type } = this.props;
    if (!onItemClick) {
      return;
    }

    onItemClick({ type, message });
  };
}
