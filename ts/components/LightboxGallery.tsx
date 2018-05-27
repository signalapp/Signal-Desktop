/**
 * @prettier
 */
import React from 'react';

import * as MIME from '../types/MIME';
import { Lightbox } from './Lightbox';
import { Message } from './conversation/media-gallery/types/Message';

import { Localizer } from '../types/Util';

interface Item {
  objectURL?: string;
  contentType: MIME.MIMEType | undefined;
}

interface Props {
  close: () => void;
  i18n: Localizer;
  messages: Array<Message>;
  onSave?: ({ message }: { message: Message }) => void;
  selectedIndex: number;
}

interface State {
  selectedIndex: number;
}

const messageToItem = (message: Message): Item => ({
  objectURL: message.objectURL,
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
    const { close, messages, onSave, i18n } = this.props;
    const { selectedIndex } = this.state;

    const selectedMessage: Message = messages[selectedIndex];
    const selectedItem = messageToItem(selectedMessage);

    const firstIndex = 0;
    const onPrevious =
      selectedIndex > firstIndex ? this.handlePrevious : undefined;

    const lastIndex = messages.length - 1;
    const onNext = selectedIndex < lastIndex ? this.handleNext : undefined;

    const objectURL = selectedItem.objectURL || 'images/alert-outline.svg';

    return (
      <Lightbox
        close={close}
        onPrevious={onPrevious}
        onNext={onNext}
        onSave={onSave ? this.handleSave : undefined}
        objectURL={objectURL}
        contentType={selectedItem.contentType}
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
