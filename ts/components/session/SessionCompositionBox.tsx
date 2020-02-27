import React from 'react';

import TextareaAutosize from 'react-autosize-textarea';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';

interface Props {
  placeholder?: string;
  sendMessage: any;
}

interface State {
  message: string;
  showEmojiPanel: boolean;
}

export class SessionCompositionBox extends React.Component<Props, State> {
  private textarea: React.RefObject<HTMLTextAreaElement>;
  private fileInput: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);

    this.state = {
      message: '',
      showEmojiPanel: false,
    };

    this.textarea = React.createRef();
    this.fileInput = React.createRef();

    this.onKeyUp = this.onKeyUp.bind(this);

    this.onChooseAttachment = this.onChooseAttachment.bind(this);
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
          onClick={this.onChooseAttachment}
        />

        <input
          ref={this.fileInput}
          type='file'
        />
        
        <SessionIconButton
          iconType={SessionIconType.Microphone}
          iconSize={SessionIconSize.Large}
        />

        <div className="send-message-input">
          <TextareaAutosize
            rows={1}
            maxRows={3}
            ref={this.textarea}
            placeholder={placeholder}
            maxLength={window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH}
            onKeyUp={this.onKeyUp}
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

        {showEmojiPanel && <SessionEmojiPanel />}
      </div>
    );
  }

  public toggleEmojiPanel() {
    this.setState({
      showEmojiPanel: !this.state.showEmojiPanel,
    });
  }
  

  private onChooseAttachment() {
    this.fileInput.current?.click();
  }

  private onChoseAttachment() {

  }

  private onKeyUp(event: any) {
    console.log(`[vince][msg] Event: `, event);
    console.log(`[vince][msg] Key `, event.key);
    console.log(`[vince][msg] KeyCode `, event.keyCode);
    console.log(`[vince][msg] AltKey `, event.altKey);
    console.log(`[vince][msg] Ctrl: `, event.ctrlKey);
    console.log(`[vince][msg] Shift: `, event.shiftKey);
    
    if (event.key === 'Enter' && !event.shiftKey) {
      // If shift, newline. Else send message.
      event.preventDefault();

      // FIXME VINCE: Get emoiji, attachments, etc
      const messageBody = this.textarea.current?.value;
      const attachments = this.fileInput.current?.value;

      

      // this.props.sendMessage(

      // );      
    }

  }



}
