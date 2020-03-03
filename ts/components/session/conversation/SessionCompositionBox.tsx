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
  mediaSetting: boolean | null;
  showEmojiPanel: boolean;
  attachments: Array<File>;
  voiceRecording?: File;
}

export class SessionCompositionBox extends React.Component<Props, State> {
  private textarea: React.RefObject<HTMLTextAreaElement>;
  private fileInput: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);

    this.state = {
      message: '',
      attachments: [],
      voiceRecording: undefined,
      isRecording: false,
      mediaSetting: null,
      showEmojiPanel: false,
    };

    this.textarea = React.createRef();
    this.fileInput = React.createRef();

    this.toggleEmojiPanel = this.toggleEmojiPanel.bind(this);

    this.renderRecordingView = this.renderRecordingView.bind(this);
    this.renderCompositionView = this.renderCompositionView.bind(this);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onStartedRecording = this.onStartedRecording.bind(this);
    this.onStoppedRecording = this.onStoppedRecording.bind(this);
    this.onSendMessage = this.onSendMessage.bind(this);
    this.onChooseAttachment = this.onChooseAttachment.bind(this);
    
  }

  public componentWillReceiveProps(){
    console.log(`[vince][info] Here are my composition props: `, this.props);
  }

  public async componentWillMount(){
    const mediaSetting = await window.getMediaPermissions();
    this.setState({mediaSetting});
  }

  render() {
    const { isRecording } = this.state;

    return (
      <div className="composition-container">
        { isRecording ? (
          <>{this.renderRecordingView()}</>
        ) : (
          <>{this.renderCompositionView()}</>
        )}
      </div>
    );
  }

  public toggleEmojiPanel() {
    this.setState({
      showEmojiPanel: !this.state.showEmojiPanel,
    });
  }
  
  private renderRecordingView() {
    return (
      <SessionRecording
        onStartedRecording={this.onStartedRecording}
        onStoppedRecording={this.onStoppedRecording}
      />
      );
  }

  private renderCompositionView() {
    const { placeholder } = this.props;
    const { showEmojiPanel } = this.state;

    return (
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
          onClick={this.onStartedRecording}
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
    );
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
      console.log(`[vince][msg] Voice message:`, this.state.voiceRecording);

      
    if (false){
      this.props.sendMessage();
    }
  }

  private onStartedRecording(){
    // Do stuff for component, then run callback to SessionConversation
    const {mediaSetting} = this.state;

    if (mediaSetting){
      this.setState({ isRecording: true });
      this.props.onStartedRecording();
      return;
    }

    window.pushToast({
      id: window.generateID(),
      title: window.i18n('audioPermissionNeededTitle'),
      description: window.i18n('audioPermissionNeededDescription'),
      type: 'info',
    });
    
  }

  private onStoppedRecording() {
    // Do stuff for component, then run callback to SessionConversation
    this.setState({ isRecording: false });
    this.props.onStoppedRecording();
  }


}
