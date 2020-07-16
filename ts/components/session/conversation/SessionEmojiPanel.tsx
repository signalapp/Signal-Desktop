import React from 'react';
import classNames from 'classnames';

import 'emoji-mart/css/emoji-mart.css'
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
          backgroundImageFn={(_set, sheetSize) =>
            `./images/emoji/emoji-sheet-${sheetSize}.png`
          }
          sheetSize={64}
          darkMode={true}
          color={'#00F782'}
          showPreview={true}
          title={''}
          onSelect={onEmojiClicked}
          autoFocus={true}
          // set="apple"
        />
      </div>
    );
  }
}
