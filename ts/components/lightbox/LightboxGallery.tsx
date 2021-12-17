/**
 * @prettier
 */
import React, { useCallback, useEffect, useState } from 'react';

import { Lightbox } from './Lightbox';

// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
import { AttachmentTypeWithPath } from '../../types/Attachment';
import { useDispatch, useSelector } from 'react-redux';
import { showLightBox } from '../../state/ducks/conversations';
import { getSelectedConversationKey } from '../../state/selectors/conversations';
import { MIME } from '../../types';
import { saveAttachmentToDisk } from '../../util/attachmentsUtil';

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
  selectedIndex: number;
};

export const LightboxGallery = (props: Props) => {
  const { media } = props;
  const [currentIndex, setCurrentIndex] = useState(-1);
  const selectedConversation = useSelector(getSelectedConversationKey) as string;

  const dispatch = useDispatch();

  // just run once, when the component is mounted. It's to show the lightbox on the specified index at start.
  useEffect(() => {
    setCurrentIndex(props.selectedIndex);
  }, []);

  const selectedMedia = media[currentIndex];
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
    void saveAttachmentToDisk({ ...mediaItem, conversationId: selectedConversation });
  }, [currentIndex, media]);

  useKey(
    'ArrowRight',
    () => {
      onNext?.();
    },
    undefined,
    [currentIndex]
  );
  useKey(
    'ArrowLeft',
    () => {
      onPrevious?.();
    },
    undefined,
    [currentIndex]
  );

  useKey(
    'Escape',
    () => {
      dispatch(showLightBox(undefined));
    },
    undefined,
    [currentIndex]
  );
  // just to avoid to render the first element during the first render when the user selected another item
  if (currentIndex === -1) {
    return null;
  }
  const objectURL = selectedMedia?.objectURL || 'images/alert-outline.svg';
  const { attachment } = selectedMedia;

  const caption = attachment?.caption;
  return (
    // tslint:disable: use-simple-attributes
    <Lightbox
      onPrevious={hasPrevious ? onPrevious : undefined}
      onNext={hasNext ? onNext : undefined}
      onSave={handleSave}
      objectURL={objectURL}
      caption={caption}
      contentType={selectedMedia.contentType}
    />
  );
};
