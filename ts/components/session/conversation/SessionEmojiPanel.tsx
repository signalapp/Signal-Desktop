import React from 'react';
import classNames from 'classnames';
import { Picker } from 'emoji-mart';

interface Props {
  onEmojiClicked: (emoji: any) => void;
  show: boolean;
}

interface State {
  // FIXME Use Emoji-Mart categories
  category: null;
}

export class SessionEmojiPanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      category: null,
    };
  }

  public render() {
    const { onEmojiClicked, show } = this.props;

    return (
      <div className={classNames('session-emoji-panel', show && 'show')}>
        <Picker
          backgroundImageFn={() => './images/emoji/emoji-sheet-twitter-32.png'}
          set={'twitter'}
          sheetSize={32}
          darkMode={true}
          color={'#00F782'}
          showPreview={true}
          title={''}
          onSelect={onEmojiClicked}
          autoFocus={true}
        />
      </div>
    );
  }
}
