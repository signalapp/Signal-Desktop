/**
 * @prettier
 */
import React, { useEffect, useState } from 'react';

import * as MIME from '../types/MIME';
import { Lightbox } from './Lightbox';

import { AttachmentTypeWithPath } from '../types/Attachment';
// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
import { showLightBox } from '../state/ducks/conversations';
import { useDispatch } from 'react-redux';

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
  onSave?: (saveData: MediaItemType) => void;
  selectedIndex: number;
};

export const LightboxGallery = (props: Props) => {
  const { media, onSave } = props;
  const [currentIndex, setCurrentIndex] = useState(0);

  const dispatch = useDispatch();

  // just run once, when the component is mounted. It's to show the lightbox on the specified index at start.
  useEffect(() => {
    setCurrentIndex(props.selectedIndex);
  }, []);

  const selectedMedia = media[currentIndex];
  const firstIndex = 0;
  const lastIndex = media.length - 1;
  const onPrevious =
    currentIndex > firstIndex
      ? () => {
          setCurrentIndex(Math.max(currentIndex - 1, 0));
        }
      : undefined;
  const onNext =
    currentIndex < lastIndex
      ? () => {
          setCurrentIndex(Math.min(currentIndex + 1, lastIndex));
        }
      : undefined;

  const handleSave = () => {
    if (!onSave) {
      return;
    }

    const mediaItem = media[currentIndex];
    onSave(mediaItem);
  };

  const objectURL = selectedMedia?.objectURL || 'images/alert-outline.svg';
  const { attachment } = selectedMedia;

  const saveCallback = onSave ? handleSave : undefined;
  const captionCallback = attachment ? attachment.caption : undefined;

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

  useKey('Escape', () => {
    dispatch(showLightBox(undefined));
  });

  return (
    <Lightbox
      onPrevious={onPrevious}
      onNext={onNext}
      onSave={saveCallback}
      objectURL={objectURL}
      caption={captionCallback}
      contentType={selectedMedia.contentType}
    />
  );
};
