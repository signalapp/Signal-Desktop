import React from 'react';

import { DocumentListItem } from './DocumentListItem';
import { ItemClickEvent } from './types/ItemClickEvent';
import { MediaGridItem } from './MediaGridItem';
import { MediaItemType } from '../../LightboxGallery';
import { missingCaseError } from '../../../util/missingCaseError';

interface Props {
  type: 'media' | 'documents';
  mediaItems: Array<MediaItemType>;
  onItemClick?: (event: ItemClickEvent) => void;
}

export class AttachmentSection extends React.Component<Props> {
  public render() {
    const { type } = this.props;

    return (
      <div className="module-attachment-section">
        <div className="module-attachment-section__items">
          <div className={`module-attachment-section__items-${type}`}>{this.renderItems()}</div>
        </div>
      </div>
    );
  }

  private renderItems() {
    const { mediaItems, type } = this.props;

    return mediaItems.map((mediaItem, position, array) => {
      const shouldShowSeparator = position < array.length - 1;
      const { index, attachment, messageTimestamp, messageId } = mediaItem;

      const onClick = this.createClickHandler(mediaItem);
      switch (type) {
        case 'media':
          return (
            <MediaGridItem key={`${messageId}-${index}`} mediaItem={mediaItem} onClick={onClick} />
          );
        case 'documents':
          return (
            <DocumentListItem
              key={`${messageId}-${index}`}
              fileName={attachment.fileName}
              fileSize={attachment.size}
              shouldShowSeparator={shouldShowSeparator}
              onClick={onClick}
              timestamp={messageTimestamp}
            />
          );
        default:
          return missingCaseError(type);
      }
    });
  }

  private readonly createClickHandler = (mediaItem: MediaItemType) => () => {
    const { onItemClick, type } = this.props;

    if (!onItemClick) {
      return;
    }

    onItemClick({ mediaItem, type });
  };
}
