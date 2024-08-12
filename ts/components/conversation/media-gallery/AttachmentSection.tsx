import { missingCaseError } from '../../../util/missingCaseError';
import { MediaItemType } from '../../lightbox/LightboxGallery';
import { DocumentListItem } from './DocumentListItem';
import { MediaGridItem } from './MediaGridItem';

type Props = {
  type: 'media' | 'documents';
  mediaItems: Array<MediaItemType>;
};

const Items = (props: Props): JSX.Element => {
  const { mediaItems, type } = props;

  return (
    <>
      {mediaItems.map((mediaItem, position, array) => {
        const shouldShowSeparator = position < array.length - 1;
        const { index, attachment, messageTimestamp, messageId } = mediaItem;

        switch (type) {
          case 'media':
            return (
              <MediaGridItem
                key={`${messageId}-${index}`}
                mediaItem={mediaItem}
                mediaItems={mediaItems}
              />
            );
          case 'documents':
            return (
              <DocumentListItem
                key={`${messageId}-${index}`}
                fileName={attachment.fileName}
                fileSize={attachment.size}
                shouldShowSeparator={shouldShowSeparator}
                timestamp={messageTimestamp}
                mediaItem={mediaItem}
              />
            );
          default:
            return missingCaseError(type);
        }
      })}
    </>
  );
};

export const AttachmentSection = (props: Props) => {
  const { type } = props;

  return (
    <div className="module-attachment-section">
      <div className="module-attachment-section__items">
        <div className={`module-attachment-section__items-${type}`}>
          <Items {...props} />
        </div>
      </div>
    </div>
  );
};
