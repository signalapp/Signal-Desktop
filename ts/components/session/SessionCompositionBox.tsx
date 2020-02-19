import React from 'react';

import TextareaAutosize from 'react-autosize-textarea';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';


interface Props {
  placeholder?: string;
  onSendMessage: any;
}

interface State {
    message: string;
    showEmojiPanel: boolean;
}

export class SessionCompositionBox extends React.Component<Props, State> {
  private textarea: React.RefObject<HTMLTextAreaElement>;

  constructor(props: any) {
    super(props);

    this.state = {
        message: '',
        showEmojiPanel: false,
    };

    this.textarea = React.createRef();
    this.toggleEmojiPanel = this.toggleEmojiPanel.bind(this);
  }

  render() {
    const { placeholder } = this.props;
    const { showEmojiPanel } = this.state;

    return (
      <div className="composition-container">
        <SessionIconButton
          iconType={SessionIconType.CirclePlus}
          iconSize={SessionIconSize.Large}
        />
        <SessionIconButton
          iconType={SessionIconType.Microphone}
          iconSize={SessionIconSize.Large}
        />

        <div className="send-message-input">
          <TextareaAutosize
            rows={1}
            maxRows={6}
            ref={this.textarea}
            placeholder={placeholder}
            maxLength={window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH}
          />
        </div>

        <SessionIconButton
          iconType={SessionIconType.Emoji}
          iconSize={SessionIconSize.Large}
          onClick={this.toggleEmojiPanel}
        />
        <div className="send-message-button">
          <SessionIconButton
            iconType={SessionIconType.Send}
            iconSize={SessionIconSize.Large}
            iconColor={'#FFFFFF'}
            iconRotation={90}
          />
        </div>

        { showEmojiPanel && 
          ( <SessionEmojiPanel/> )
        }

      </div>
    );
  }

  public toggleEmojiPanel() {
    this.setState({
      showEmojiPanel: !this.state.showEmojiPanel,
    })
  }
}
