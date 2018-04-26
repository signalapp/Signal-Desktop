/**
 * @prettier
 */
import React from 'react';

import * as MIME from '../types/MIME';
import { Lightbox } from './Lightbox';
import { Message } from './conversation/media-gallery/types/Message';

interface Item {
  objectURL?: string;
  contentType: MIME.MIMEType | undefined;
}

interface Props {
  close: () => void;
  getAbsoluteAttachmentPath: (relativePath: string) => string;
  messages: Array<Message>;
  onSave?: ({ message }: { message: Message }) => void;
  selectedIndex: number;
}

interface State {
  selectedIndex: number;
}

const messageToItem = (message: Message): Item => ({
  objectURL: message.attachments[0].path,
  contentType: message.attachments[0].contentType,
});

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
    const { close, getAbsoluteAttachmentPath, messages, onSave } = this.props;
    const { selectedIndex } = this.state;

    const selectedMessage: Message = messages[selectedIndex];
    const selectedItem = messageToItem(selectedMessage);

    const firstIndex = 0;
    const onPrevious =
      selectedIndex > firstIndex ? this.handlePrevious : undefined;

    const lastIndex = messages.length - 1;
    const onNext = selectedIndex < lastIndex ? this.handleNext : undefined;

    const objectURL = selectedItem.objectURL
      ? getAbsoluteAttachmentPath(selectedItem.objectURL)
      : 'images/video.svg';

    return (
      <Lightbox
        close={close}
        onPrevious={onPrevious}
        onNext={onNext}
        onSave={onSave ? this.handleSave : undefined}
        objectURL={objectURL}
        contentType={selectedItem.contentType}
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
        props.messages.length - 1
      ),
    }));
  };

  private handleSave = () => {
    const { messages, onSave } = this.props;
    if (!onSave) {
      return;
    }

    const { selectedIndex } = this.state;
    const message = messages[selectedIndex];
    onSave({ message });
  };
}
