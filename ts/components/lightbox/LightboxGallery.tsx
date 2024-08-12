import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';

import useMount from 'react-use/lib/useMount';
import { Lightbox } from './Lightbox';

import { updateLightBoxOptions } from '../../state/ducks/modalDialog';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { MIME } from '../../types';
import { AttachmentTypeWithPath } from '../../types/Attachment';
import { saveAttachmentToDisk } from '../../util/attachmentsUtil';
import { saveURLAsFile } from '../../util/saveURLAsFile';

export interface MediaItemType {
  objectURL?: string;
  thumbnailObjectUrl?: string;
  contentType: MIME.MIMEType;
  index: number;
  attachment: AttachmentTypeWithPath;
  messageTimestamp: number;
  messageSender: string;
  messageId: string;
}

type Props = {
  media: Array<MediaItemType>;
  selectedIndex?: number;
  onClose?: () => void;
};

export const LightboxGallery = (props: Props) => {
  const { media, selectedIndex = -1, onClose } = props;
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);
  const selectedConversation = useSelectedConversationKey();

  const dispatch = useDispatch();

  // just run once, when the component is mounted. It's to show the lightbox on the specified index at start.
  useMount(() => {
    setCurrentIndex(selectedIndex);
  });

  const selectedMedia = media[currentIndex];
  const objectURL = selectedMedia?.objectURL || 'images/alert-outline.svg';
  const isDataBlob = objectURL.startsWith('data:');

  const firstIndex = 0;
  const lastIndex = media.length - 1;

  const hasPrevious = currentIndex > firstIndex;
  const hasNext = currentIndex < lastIndex;

  const onPrevious = useCallback(() => {
    setCurrentIndex(Math.max(currentIndex - 1, 0));
  }, [currentIndex]);

  const onNext = useCallback(() => {
    setCurrentIndex(Math.min(currentIndex + 1, lastIndex));
  }, [currentIndex, lastIndex]);

  const handleSave = useCallback(() => {
    const mediaItem = media[currentIndex];

    if (isDataBlob && mediaItem.objectURL) {
      saveURLAsFile({
        filename: mediaItem.attachment.fileName,
        url: mediaItem.objectURL,
        document,
      });
    } else {
      if (!selectedConversation) {
        return;
      }

      void saveAttachmentToDisk({ ...mediaItem, conversationId: selectedConversation });
    }
  }, [currentIndex, isDataBlob, media, selectedConversation]);

  useKey(
    'ArrowRight',
    () => {
      onNext?.();
    },
    undefined,
    [onNext, currentIndex]
  );
  useKey(
    'ArrowLeft',
    () => {
      onPrevious?.();
    },
    undefined,
    [onPrevious, currentIndex]
  );
  useKey(
    'Escape',
    () => {
      if (onClose) {
        onClose();
      }
      dispatch(updateLightBoxOptions(null));
    },
    undefined,
    [currentIndex, updateLightBoxOptions, dispatch, onClose]
  );

  if (!isDataBlob && !selectedConversation) {
    return null;
  }

  // just to avoid to render the first element during the first render when the user selected another item
  if (currentIndex === -1) {
    return null;
  }

  const { attachment } = selectedMedia;

  const caption = attachment?.caption;
  return (
    <Lightbox
      onPrevious={hasPrevious ? onPrevious : undefined}
      onNext={hasNext ? onNext : undefined}
      onSave={handleSave}
      onClose={onClose}
      objectURL={objectURL}
      caption={caption}
      contentType={selectedMedia.contentType}
    />
  );
};
