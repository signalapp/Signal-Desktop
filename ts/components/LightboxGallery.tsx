/**
 * @prettier
 */
import React from 'react';

import * as MIME from '../types/MIME';
import { Lightbox } from './Lightbox';
import { Message } from './conversation/media-gallery/types/Message';
import { AttachmentType } from './conversation/types';

import { Localizer } from '../types/Util';

export interface MediaItemType {
  objectURL?: string;
  thumbnailObjectUrl?: string;
  contentType?: MIME.MIMEType;
  index: number;
  attachment: AttachmentType;
  message: Message;
}

interface Props {
  close: () => void;
  i18n: Localizer;
  media: Array<MediaItemType>;
  onSave?: (
    { attachment, message }: { attachment: AttachmentType; message: Message }
  ) => void;
  selectedIndex: number;
}

interface State {
  selectedIndex: number;
}

export class LightboxGallery extends React.Component<Props, State> {
  public static defaultProps: Partial<Props> = {
    selectedIndex: 0,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      selectedIndex: this.props.selectedIndex,
    };
  }

  public render() {
    const { close, media, onSave, i18n } = this.props;
    const { selectedIndex } = this.state;

    const selectedMedia = media[selectedIndex];
    const firstIndex = 0;
    const lastIndex = media.length - 1;

    const onPrevious =
      selectedIndex > firstIndex ? this.handlePrevious : undefined;
    const onNext = selectedIndex < lastIndex ? this.handleNext : undefined;

    const objectURL = selectedMedia.objectURL || 'images/alert-outline.svg';
    const { attachment } = selectedMedia;

    return (
      <Lightbox
        close={close}
        onPrevious={onPrevious}
        onNext={onNext}
        onSave={onSave ? this.handleSave : undefined}
        objectURL={objectURL}
        caption={attachment ? attachment.caption : undefined}
        contentType={selectedMedia.contentType}
        i18n={i18n}
      />
    );
  }

  private handlePrevious = () => {
    this.setState(prevState => ({
      selectedIndex: Math.max(prevState.selectedIndex - 1, 0),
    }));
  };

  private handleNext = () => {
    this.setState((prevState, props) => ({
      selectedIndex: Math.min(
        prevState.selectedIndex + 1,
        props.media.length - 1
      ),
    }));
  };

  private handleSave = () => {
    const { media, onSave } = this.props;
    if (!onSave) {
      return;
    }

    const { selectedIndex } = this.state;
    const mediaItem = media[selectedIndex];
    const { attachment, message } = mediaItem;

    onSave({ attachment, message });
  };
}
