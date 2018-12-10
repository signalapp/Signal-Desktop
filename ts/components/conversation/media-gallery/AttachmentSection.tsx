import React from 'react';

import { DocumentListItem } from './DocumentListItem';
import { ItemClickEvent } from './types/ItemClickEvent';
import { MediaGridItem } from './MediaGridItem';
import { MediaItemType } from '../../LightboxGallery';
import { missingCaseError } from '../../../util/missingCaseError';
import { Localizer } from '../../../types/Util';

interface Props {
  i18n: Localizer;
  header?: string;
  type: 'media' | 'documents';
  mediaItems: Array<MediaItemType>;
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
    const { i18n, mediaItems, type } = this.props;

    return mediaItems.map((mediaItem, position, array) => {
      const shouldShowSeparator = position < array.length - 1;
      const { message, index, attachment } = mediaItem;

      const onClick = this.createClickHandler(mediaItem);
      switch (type) {
        case 'media':
          return (
            <MediaGridItem
              key={`${message.id}-${index}`}
              mediaItem={mediaItem}
              onClick={onClick}
              i18n={i18n}
            />
          );
        case 'documents':
          return (
            <DocumentListItem
              key={`${message.id}-${index}`}
              fileName={attachment.fileName}
              fileSize={attachment.size}
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

  private createClickHandler = (mediaItem: MediaItemType) => () => {
    const { onItemClick, type } = this.props;
    const { message, attachment } = mediaItem;

    if (!onItemClick) {
      return;
    }

    onItemClick({ type, message, attachment });
  };
}
