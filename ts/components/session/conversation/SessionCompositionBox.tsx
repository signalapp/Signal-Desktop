import React from 'react';

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

    this.toggleEmojiPanel = this.toggleEmojiPanel.bind(this);

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
    
  }

  public componentWillReceiveProps(){
    console.log(`[vince][info] Here are my composition props: `, this.props);
  }

  public async componentWillMount(){
    const mediaSetting = await window.getMediaPermissions();
    this.setState({mediaSetting});
  }

  render() {
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

  public toggleEmojiPanel() {
    this.setState({
      showEmojiPanel: !this.state.showEmojiPanel,
    });
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
        contentType: undefined,
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
    }
  }

  private onDrop(){
    // On drop attachments!
    // this.textarea.current?.ondrop;
    // Look into react-dropzone
  }

  private onSendMessage(){  
    // FIXME VINCE: Get emoiji, attachments, etc
    const messagePlaintext = this.textarea.current?.value;
    const {attachments, voiceRecording} = this.state;
    const messageInput = this.textarea.current;

    if (!messageInput) return;

    console.log(`[vince][msg] Message:`, messagePlaintext);
    console.log(`[vince][msg] fileAttachments:`, attachments);
    console.log(`[vince][msg] Voice message:`, voiceRecording);
    

    // Verify message length


    // Handle emojis

    const messageSuccess = this.props.sendMessage(
      messagePlaintext,
      attachments,
      MIME.IMAGE_JPEG,
      undefined,
      null,
      {},
    );

    if (messageSuccess) {
      // Empty composition box
      messageInput.value = '';
    }
  }

  private async sendVoiceMessage(audioBlob: Blob) {
    if (!this.state.isRecordingView) return;

    const fileBuffer = await new Response(audioBlob).arrayBuffer();

    const audioAttachment: Attachment = {
      data: fileBuffer,
      flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
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


}
