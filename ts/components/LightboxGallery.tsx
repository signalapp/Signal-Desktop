/**
 * @prettier
 */
import React from 'react';

import * as MIME from '../types/MIME';
import { Lightbox } from './Lightbox';

interface Item {
  objectURL: string;
  contentType: MIME.MIMEType | undefined;
}

interface Props {
  close: () => void;
  items: Array<Item>;
  // onNext?: () => void;
  // onPrevious?: () => void;
  onSave?: () => void;
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
    const { close, items, onSave } = this.props;
    const { selectedIndex } = this.state;

    const selectedItem: Item = items[selectedIndex];

    const firstIndex = 0;
    const onPrevious =
      selectedIndex > firstIndex ? this.handlePrevious : undefined;

    const lastIndex = items.length - 1;
    const onNext = selectedIndex < lastIndex ? this.handleNext : undefined;

    return (
      <Lightbox
        close={close}
        onPrevious={onPrevious}
        onNext={onNext}
        onSave={onSave}
        objectURL={selectedItem.objectURL}
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
        props.items.length - 1
      ),
    }));
  };
}
