import React from 'react';
import { debounce } from 'lodash';

import { Attachment } from '../../../types/Attachment';
import * as MIME from '../../../types/MIME';

import TextareaAutosize from 'react-autosize-textarea';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionRecording } from './SessionRecording';

import { SignalService } from '../../../../ts/protobuf';

import { Constants } from '../../../session';

interface Props {
  placeholder?: string;

  sendMessage: any;
  onMessageSending: any;
  onMessageSuccess: any;
  onMessageFailure: any;

  onLoadVoiceNoteView: any;
  onExitVoiceNoteView: any;

  dropZoneFiles: FileList;
}

interface State {
  message: string;
  showRecordingView: boolean;

  mediaSetting: boolean | null;
  showEmojiPanel: boolean;
  attachments: Array<Attachment>;
  voiceRecording?: Blob;
}

export class SessionCompositionBox extends React.Component<Props, State> {
  private readonly textarea: React.RefObject<HTMLTextAreaElement>;
  private readonly fileInput: React.RefObject<HTMLInputElement>;
  private emojiPanel: any;

  constructor(props: any) {
    super(props);

    this.state = {
      message: '',
      attachments: [],
      voiceRecording: undefined,
      showRecordingView: false,
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

    // On Sending
    this.onSendMessage = this.onSendMessage.bind(this);

    // Events
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onChange = this.onChange.bind(this);
    this.focusCompositionBox = this.focusCompositionBox.bind(this);
  }

  public async componentWillMount() {
    const mediaSetting = await window.getSettingValue('media-permissions');
    this.setState({ mediaSetting });
  }

  public componentDidMount() {
    setTimeout(this.focusCompositionBox, 100);
  }

  public render() {
    const { showRecordingView } = this.state;

    return (
      <div className="composition-container">
        {showRecordingView ? (
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
  }

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

  private toggleEmojiPanel() {
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
          placeholder="Attachment"
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

        <div className="send-message-input" role="main" onClick={this.focusCompositionBox}>
          <TextareaAutosize
            rows={1}
            maxRows={3}
            ref={this.textarea}
            spellCheck={false}
            placeholder={placeholder}
            maxLength={Constants.CONVERSATION.MAX_MESSAGE_BODY_LENGTH}
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
          <SessionEmojiPanel
            onEmojiClicked={this.onEmojiClick}
            show={showEmojiPanel}
          />
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
    if (!attachmentsFileList) {
      return;
    }

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
      };

      // Push if size is nonzero
      if (attachment.data.byteLength) {
        attachments.push(attachment);
      }
    });

    this.setState({ attachments });
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

  private onSendMessage() {
    const messageInput = this.textarea.current;
    if (!messageInput) {
      return;
    }

    // Verify message length
    const messagePlaintext = messageInput.value;
    const msgLen = messagePlaintext.length;
    if (msgLen === 0 || msgLen > window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH) {
      return;
    }

    // handle Attachments
    const { attachments } = this.state;

    // Handle emojis

    // Send message
    this.props.onMessageSending();

    this.props
      .sendMessage(
        messagePlaintext,
        attachments,
        undefined,
        undefined,
        null,
        {}
      )
      .then(() => {
        // Message sending sucess
        this.props.onMessageSuccess();

        // Empty attachments
        // Empty composition box
        this.setState({
          message: '',
          attachments: [],
        });
      })
      .catch(() => {
        // Message sending failed
        this.props.onMessageFailure();
      });
  }

  private async sendVoiceMessage(audioBlob: Blob) {
    if (!this.state.showRecordingView) {
      return;
    }

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
      {}
    );

    if (messageSuccess) {
      // success!
    }

    console.log(`[compositionbox] Sending voice message:`, audioBlob);

    this.onExitVoiceNoteView();
  }

  private onLoadVoiceNoteView() {
    // Do stuff for component, then run callback to SessionConversation
    const { mediaSetting } = this.state;

    if (mediaSetting) {
      this.setState({
        showRecordingView: true,
        showEmojiPanel: false,
      });
      this.props.onLoadVoiceNoteView();

      return;
    }

    window.pushToast({
      id: 'audioPermissionNeeded',
      title: window.i18n('audioPermissionNeededTitle'),
      description: window.i18n('audioPermissionNeededDescription'),
      type: 'info',
    });
  }

  private onExitVoiceNoteView() {
    // Do stuff for component, then run callback to SessionConversation
    this.setState({ showRecordingView: false });
    this.props.onExitVoiceNoteView();
  }

  private onDrop() {
    // On drop attachments!
    // this.textarea.current?.ondrop;
    // Look into react-dropzone
    // DROP AREA COMES FROM SessionConversation NOT HERE
  }

  private onChange(event: any) {
    this.setState({ message: event.target.value });
  }

  private onEmojiClick({ native }: any) {
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

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

  private focusCompositionBox() {
    // Focus the textarea when user clicks anywhere in the composition box
    this.textarea.current?.focus();
  }

}
