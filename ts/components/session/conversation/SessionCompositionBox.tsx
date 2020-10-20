import React from 'react';
import _, { debounce } from 'lodash';

import { Attachment, AttachmentType } from '../../../types/Attachment';
import * as MIME from '../../../types/MIME';

import TextareaAutosize from 'react-autosize-textarea';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionRecording } from './SessionRecording';

import { SignalService } from '../../../protobuf';

import { Constants } from '../../../session';

import { toArray } from 'react-emoji-render';
import { SessionQuotedMessageComposition } from './SessionQuotedMessageComposition';
import { Flex } from '../Flex';
import { AttachmentList } from '../../conversation/AttachmentList';
import { ToastUtils } from '../../../session/utils';
import { AttachmentUtil } from '../../../util';

export interface ReplyingToMessageProps {
  convoId: string;
  id: string;
  author: string;
  timestamp: number;
  text?: string;
  attachments?: Array<any>;
}

export interface StagedAttachmentType extends AttachmentType {
  file: File;
}

interface Props {
  placeholder?: string;

  sendMessage: any;
  onMessageSending: any;
  onMessageSuccess: any;
  onMessageFailure: any;

  onLoadVoiceNoteView: any;
  onExitVoiceNoteView: any;

  quotedMessageProps?: ReplyingToMessageProps;
  removeQuotedMessage: () => void;

  textarea: React.RefObject<HTMLDivElement>;
  stagedAttachments: Array<StagedAttachmentType>;
  clearAttachments: () => any;
  removeAttachment: (toRemove: AttachmentType) => void;
  onChoseAttachments: (newAttachments: FileList) => void;
}

interface State {
  message: string;
  showRecordingView: boolean;

  mediaSetting: boolean | null;
  showEmojiPanel: boolean;
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
      voiceRecording: undefined,
      showRecordingView: false,
      mediaSetting: null,
      showEmojiPanel: false,
    };

    this.textarea = props.textarea;
    this.fileInput = React.createRef();

    // Emojis
    this.emojiPanel = null;
    this.toggleEmojiPanel = debounce(this.toggleEmojiPanel.bind(this), 100);
    this.hideEmojiPanel = this.hideEmojiPanel.bind(this);
    this.onEmojiClick = this.onEmojiClick.bind(this);
    this.handleClick = this.handleClick.bind(this);

    this.renderRecordingView = this.renderRecordingView.bind(this);
    this.renderCompositionView = this.renderCompositionView.bind(this);
    this.renderQuotedMessage = this.renderQuotedMessage.bind(this);
    this.renderAttachmentsStaged = this.renderAttachmentsStaged.bind(this);

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
      <Flex flexDirection="column">
        {this.renderQuotedMessage()}
        {this.renderAttachmentsStaged()}
        <div className="composition-container">
          {showRecordingView
            ? this.renderRecordingView()
            : this.renderCompositionView()}
        </div>
      </Flex>
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

        <div
          className="send-message-input"
          role="main"
          onClick={this.focusCompositionBox}
        >
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

  private renderQuotedMessage() {
    const { quotedMessageProps, removeQuotedMessage } = this.props;
    if (quotedMessageProps && quotedMessageProps.id) {
      return (
        <SessionQuotedMessageComposition
          quotedMessageProps={quotedMessageProps}
          removeQuotedMessage={removeQuotedMessage}
        />
      );
    }
    return <></>;
  }

  private renderAttachmentsStaged() {
    const { stagedAttachments } = this.props;
    if (stagedAttachments && stagedAttachments.length) {
      return (
        <AttachmentList
          attachments={stagedAttachments}
          // tslint:disable-next-line: no-empty
          onClickAttachment={() => {}}
          onAddAttachment={this.onChooseAttachment}
          onCloseAttachment={this.props.removeAttachment}
          onClose={this.props.clearAttachments}
        />
      );
    }
    return <></>;
  }

  private onChooseAttachment() {
    this.fileInput.current?.click();
  }

  private async onChoseAttachment() {
    // Build attachments list
    const attachmentsFileList = this.fileInput.current?.files;
    if (!attachmentsFileList || attachmentsFileList.length === 0) {
      return;
    }
    this.props.onChoseAttachments(attachmentsFileList);
  }

  private async onKeyDown(event: any) {
    if (event.key === 'Enter' && !event.shiftKey) {
      // If shift, newline. Else send message.
      event.preventDefault();
      await this.onSendMessage();
    } else if (event.key === 'Escape' && this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    }
  }

  private parseEmojis(value: string) {
    const emojisArray = toArray(value);

    // toArray outputs React elements for emojis and strings for other
    return emojisArray.reduce((previous: string, current: any) => {
      if (typeof current === 'string') {
        return previous + current;
      }
      return previous + (current.props.children as string);
    }, '');
  }

  private async onSendMessage() {
    const messagePlaintext = this.parseEmojis(this.state.message);

    // Verify message length
    const msgLen = messagePlaintext?.length || 0;
    if (msgLen > window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH) {
      ToastUtils.pushMessageBodyTooLong();
      return;
    }
    if (msgLen === 0 && this.props.stagedAttachments?.length === 0) {
      ToastUtils.pushMessageBodyMissing();
      return;
    }
    const { quotedMessageProps } = this.props;

    // Send message
    this.props.onMessageSending();
    const extractedQuotedMessageProps = _.pick(
      quotedMessageProps,
      'id',
      'author',
      'text',
      'attachments'
    );

    try {
      const attachments = await this.getFiles();
      await this.props.sendMessage(
        messagePlaintext,
        attachments,
        extractedQuotedMessageProps,
        undefined,
        null,
        {}
      );

      // Message sending sucess
      this.props.onMessageSuccess();

      // Empty composition box
      this.setState({
        message: '',
        showEmojiPanel: false,
      });
      // Empty stagedAttachments
      this.props.clearAttachments();
    } catch (e) {
      // Message sending failed
      window.log.error(e);
      this.props.onMessageFailure();
    }
  }

  // this function is called right before sending a message, to gather really files bejind attachments.
  private async getFiles() {
    const { stagedAttachments } = this.props;
    const files = await Promise.all(
      stagedAttachments.map(attachment => AttachmentUtil.getFile(attachment))
    );
    this.props.clearAttachments();
    return files;
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
      description: window.i18n('audioPermissionNeeded'),
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
    const message = event.target.value ?? '';

    this.setState({ message });
  }

  private onEmojiClick({ colons, native }: { colons: string; native: string }) {
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

    const { message } = this.state;
    const currentSelectionStart = Number(messageBox.selectionStart);
    const currentSelectionEnd = Number(messageBox.selectionEnd);

    const before = message.slice(0, currentSelectionStart);
    const end = message.slice(currentSelectionEnd);
    const newMessage = `${before}${colons}${end}`;

    this.setState({ message: newMessage }, () => {
      // update our selection because updating text programmatically
      // will put the selection at the end of the textarea
      const selectionStart = currentSelectionStart + Number(colons.length);
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
