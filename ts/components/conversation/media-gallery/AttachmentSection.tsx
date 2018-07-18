import React from 'react';

import { AttachmentType } from './types/AttachmentType';
import { DocumentListItem } from './DocumentListItem';
import { ItemClickEvent } from './types/ItemClickEvent';
import { MediaGridItem } from './MediaGridItem';
import { Message } from './types/Message';
import { missingCaseError } from '../../../util/missingCaseError';
import { Localizer } from '../../../types/Util';

interface Props {
  i18n: Localizer;
  header?: string;
  type: AttachmentType;
  messages: Array<Message>;
  onItemClick?: (event: ItemClickEvent) => void;
}

export class AttachmentSection extends React.Component<Props> {
  public render() {
    const { header } = this.props;

    return (
      <div className="module-attachment-section">
        <h2 className="module-attachment-section__header">{header}</h2>
        <div className="module-attachment-section__items">
          {this.renderItems()}
        </div>
      </div>
    );
  }

  private renderItems() {
    const { i18n, messages, type } = this.props;

    return messages.map((message, index, array) => {
      const shouldShowSeparator = index < array.length - 1;
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
              i18n={i18n}
            />
          );
        case 'documents':
          return (
            <DocumentListItem
              key={message.id}
              fileName={firstAttachment.fileName}
              fileSize={firstAttachment.size}
              shouldShowSeparator={shouldShowSeparator}
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
