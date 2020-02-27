import React from 'react';

import TextareaAutosize from 'react-autosize-textarea';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';

import { SessionRecording } from './SessionRecording';

interface Props {
  placeholder?: string;
  sendMessage: any;
  onStartedRecording: any;
  onStoppedRecording: any;
}

interface State {
  message: string;
  isRecording: boolean;
  showEmojiPanel: boolean;
}

export class SessionCompositionBox extends React.Component<Props, State> {
  private textarea: React.RefObject<HTMLTextAreaElement>;
  private fileInput: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);

    this.state = {
      message: '',
      isRecording: true,
      showEmojiPanel: false,
    };

    this.textarea = React.createRef();
    this.fileInput = React.createRef();

    this.onKeyDown = this.onKeyDown.bind(this);

    this.onChooseAttachment = this.onChooseAttachment.bind(this);
    this.toggleEmojiPanel = this.toggleEmojiPanel.bind(this);
    
    this.onSendMessage = this.onSendMessage.bind(this);
  }

  public componentWillReceiveProps(){
    console.log(`[vince][info] Here are my composition props: `, this.props);
  }

  render() {
    const { placeholder } = this.props;
    const { showEmojiPanel } = this.state;

    return (
      <div className="composition-container">
        { this.state.isRecording ? (
          <SessionRecording
            onStoppedRecording={this.props.onStoppedRecording}
          />
        ) : (
          <>
            <SessionIconButton
              iconType={SessionIconType.CirclePlus}
              iconSize={SessionIconSize.Large}
              onClick={this.onChooseAttachment}
            />

            <input
              className="hidden"
              multiple={true}
              ref={this.fileInput}
              type='file'
            />
            
            <SessionIconButton
              iconType={SessionIconType.Microphone}
              iconSize={SessionIconSize.Huge}
              onClick={this.onStartRecording}
            />

            <div className="send-message-input">
              <TextareaAutosize
                rows={1}
                maxRows={3}
                ref={this.textarea}
                placeholder={placeholder}
                maxLength={window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH}
                onKeyDown={this.onKeyDown}
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
                onClick={this.onSendMessage}
              />
            </div>

            {showEmojiPanel && <SessionEmojiPanel />}
          </>
        )}

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

  private onKeyDown(event: any) {    
    if (event.key === 'Enter' && !event.shiftKey) {
      // If shift, newline. Else send message.
      event.preventDefault();
      this.onSendMessage();
    }
  }

  private onSendMessage(){  
      // FIXME VINCE: Get emoiji, attachments, etc
      const messagePlaintext = this.textarea.current?.value;
      const attachments = this.fileInput.current?.files;

      console.log(`[vince][msg] Message:`, messagePlaintext);
      console.log(`[vince][msg] Attachments:`, attachments);


    if (false){
      this.props.sendMessage();
    }
  }

  private onStartRecording(){
    // Do stuff for component, then run callback to SessionConversation

    this.props.onStartedRecording();
  }

  private onStopRecording() {
    // Do stuff for component, then run callback to SessionConversation

    this.props.onStoppedRecording();
  }

}
