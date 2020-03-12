import React from 'react';
import { debounce } from 'lodash';

import { Attachment } from '../../../types/Attachment';
import * as MIME from '../../../types/MIME';

import TextareaAutosize from 'react-autosize-textarea';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionRecording } from './SessionRecording';

import { SignalService } from '../../../../ts/protobuf';


interface Props {
  placeholder?: string;
  sendMessage: any;
  
  onLoadVoiceNoteView: any;
  onExitVoiceNoteView: any;
}

interface State {
  message: string;
  isRecordingView: boolean;

  mediaSetting: boolean | null;
  showEmojiPanel: boolean;
  attachments: Array<Attachment>;
  voiceRecording?: Blob;
}

export class SessionCompositionBox extends React.Component<Props, State> {
  private textarea: React.RefObject<HTMLTextAreaElement>;
  private fileInput: React.RefObject<HTMLInputElement>;
  private emojiPanel: any;

  constructor(props: any) {
    super(props);

    this.state = {
      message: '',
      attachments: [],
      voiceRecording: undefined,
      isRecordingView: false,
      mediaSetting: null,
      showEmojiPanel: false,
    };

    this.textarea = React.createRef();
    this.fileInput = React.createRef();

    // Emojis
    this.emojiPanel = null;
    this.toggleEmojiPanel = debounce(this.toggleEmojiPanel.bind(this), 100);
    this.hideEmojiPanel = this.hideEmojiPanel.bind(this);
    this.onEmojiClick = this.onEmojiClick.bind(this);
    this.handleClick = this.handleClick.bind(this);

    this.renderRecordingView = this.renderRecordingView.bind(this);
    this.renderCompositionView = this.renderCompositionView.bind(this);

    // Recording view functions
    this.sendVoiceMessage = this.sendVoiceMessage.bind(this);
    this.onLoadVoiceNoteView = this.onLoadVoiceNoteView.bind(this);
    this.onExitVoiceNoteView = this.onExitVoiceNoteView.bind(this);

    // Attachments
    this.onChoseAttachment = this.onChoseAttachment.bind(this);
    this.onChooseAttachment = this.onChooseAttachment.bind(this);
    
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onChange = this.onChange.bind(this);
    
  }

  public componentWillReceiveProps(){
    console.log(`[vince][info] Here are my composition props: `, this.props);
  }

  public async componentWillMount(){
    const mediaSetting = await window.getMediaPermissions();
    this.setState({mediaSetting});
  }

  public render() {
    const { isRecordingView } = this.state;

    return (
      <div className="composition-container">
        { isRecordingView ? (
          <>{this.renderRecordingView()}</>
        ) : (
          <>{this.renderCompositionView()}</>
        )}
      </div>
    );
  }

  private handleClick(e: any) {
    if (this.emojiPanel && this.emojiPanel.contains(e.target)) {
      return;
    }

    this.toggleEmojiPanel();
  };

  private showEmojiPanel() {
    document.addEventListener('mousedown', this.handleClick, false);

    this.setState({
      showEmojiPanel: true,
    });
  }

  private hideEmojiPanel() {
    document.removeEventListener('mousedown', this.handleClick, false);
    
    this.setState({
      showEmojiPanel: false,
    });
  }

  public toggleEmojiPanel() {
    if (this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    } else {
      this.showEmojiPanel();
    }
  }
  
  private renderRecordingView() {
    return (
      <SessionRecording
        sendVoiceMessage={this.sendVoiceMessage}
        onLoadVoiceNoteView={this.onLoadVoiceNoteView}
        onExitVoiceNoteView={this.onExitVoiceNoteView}
      />
      );
  }

  private renderCompositionView() {
    const { placeholder } = this.props;
    const { showEmojiPanel, message } = this.state;

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
          type="file"
          onChange={this.onChoseAttachment}
        />
        
        <SessionIconButton
          iconType={SessionIconType.Microphone}
          iconSize={SessionIconSize.Huge}
          onClick={this.onLoadVoiceNoteView}
        />

        <div className="send-message-input">
          <TextareaAutosize
            rows={1}
            maxRows={3}
            ref={this.textarea}
            placeholder={placeholder}
            maxLength={window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH}
            onKeyDown={this.onKeyDown}
            value={message}
            onChange={this.onChange}
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

        <div
          ref={ref => (this.emojiPanel = ref)}
          onKeyDown={this.onKeyDown}
          role="button"
        >
          <SessionEmojiPanel onEmojiClicked={this.onEmojiClick} show={showEmojiPanel}/>
        </div>
      </>
    );
  }
  


  private onChooseAttachment() {
    this.fileInput.current?.click();
  }

  private onChoseAttachment() {
    // Build attachments list
    const attachmentsFileList = this.fileInput.current?.files;
    if (!attachmentsFileList) return;

    const attachments: Array<Attachment> = [];
    Array.from(attachmentsFileList).forEach(async (file: File) => {
      
      const fileBlob = new Blob([file]);
      const fileBuffer = await new Response(fileBlob).arrayBuffer();

      const attachment = {
        fileName: file.name,
        flags: undefined,
        // FIXME VINCE: Set appropriate type
        contentType: MIME.AUDIO_WEBM,
        size: file.size,
        data: fileBuffer,
      }

      // Push if size is nonzero
      attachment.data.byteLength && attachments.push(attachment);
    });

    this.setState({attachments});
  }

  private onKeyDown(event: any) {    
    if (event.key === 'Enter' && !event.shiftKey) {
      // If shift, newline. Else send message.
      event.preventDefault();
      this.onSendMessage();
    } else if (event.key === 'Escape' && this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    }
  }


  private onSendMessage(){  
    // FIXME VINCE: Get emoiji, attachments, etc
    const messagePlaintext = this.textarea.current?.value;
    const {attachments} = this.state;
    const messageInput = this.textarea.current;

    if (!messageInput) return;

    console.log(`[vince][msg] Message:`, messagePlaintext);
    console.log(`[vince][msg] fileAttachments:`, attachments);


    // Verify message length


    // Handle emojis


    // Send message
    const messageSuccess = this.props.sendMessage(
      messagePlaintext,
      attachments,
      undefined,
      undefined,
      null,
      {},
    );

    if (messageSuccess) {
      // Empty attachments
      // Empty composition box
      this.setState({
        message: '',
        attachments: [],
      });
    }
  }

  private async sendVoiceMessage(audioBlob: Blob) {
    if (!this.state.isRecordingView) return;

    const fileBuffer = await new Response(audioBlob).arrayBuffer();

    const audioAttachment: Attachment = {
      data: fileBuffer,
      flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
      contentType: MIME.AUDIO_MP3,
    };

    const messageSuccess = this.props.sendMessage(
      '',
      [audioAttachment],
      undefined,
      undefined,
      null,
      {},
    );

    if (messageSuccess) {
      alert('MESSAGE VOICE SUCCESS');
    }

    console.log(`[compositionbox] Sending voice message:`, audioBlob);


    this.onExitVoiceNoteView();
  }

  private onLoadVoiceNoteView(){
    // Do stuff for component, then run callback to SessionConversation
    const {mediaSetting} = this.state;

    if (mediaSetting){
      this.setState({ isRecordingView: true });
      this.props.onLoadVoiceNoteView();
      return;
    }

    window.pushToast({
      id: window.generateID(),
      title: window.i18n('audioPermissionNeededTitle'),
      description: window.i18n('audioPermissionNeededDescription'),
      type: 'info',
    });
    
  }

  private onExitVoiceNoteView() {
    // Do stuff for component, then run callback to SessionConversation
    this.setState({ isRecordingView: false });
    this.props.onExitVoiceNoteView();
  }

  private onDrop(){
    // On drop attachments!
    // this.textarea.current?.ondrop;
    // Look into react-dropzone
  }

  private onChange(event: any) {
    this.setState({message: event.target.value});
  }

  private onEmojiClick({native}: any) {
    const messageBox = this.textarea.current;
    if (!messageBox) return;

    const { message } = this.state;
    const currentSelectionStart = Number(messageBox.selectionStart);
    const currentSelectionEnd = Number(messageBox.selectionEnd);
    const before = message.slice(0, currentSelectionStart);
    const end = message.slice(currentSelectionEnd);
    const newMessage = `${before}${native}${end}`;

    this.setState({ message: newMessage }, () => {
      // update our selection because updating text programmatically
      // will put the selection at the end of the textarea
      const selectionStart = currentSelectionStart + Number(native.length);
      messageBox.selectionStart = selectionStart;
      messageBox.selectionEnd = selectionStart;
      
      // Sometimes, we have to repeat the set of the selection position with a timeout to be effective
      setTimeout(() => {
        messageBox.selectionStart = selectionStart;
        messageBox.selectionEnd = selectionStart;
      }, 20);
    });
  }

}
