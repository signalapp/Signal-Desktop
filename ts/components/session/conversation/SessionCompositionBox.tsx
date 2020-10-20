import React from 'react';
import _, { debounce } from 'lodash';

import { Attachment, AttachmentType } from '../../../types/Attachment';
import * as MIME from '../../../types/MIME';

import TextareaAutosize from 'react-autosize-textarea';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionRecording } from './SessionRecording';
import * as GoogleChrome from '../../../util/GoogleChrome';

import { SignalService } from '../../../protobuf';

import { Constants } from '../../../session';

import { toArray } from 'react-emoji-render';
import { SessionQuotedMessageComposition } from './SessionQuotedMessageComposition';
import { Flex } from '../Flex';
import { AttachmentList } from '../../conversation/AttachmentList';

export interface ReplyingToMessageProps {
  convoId: string;
  id: string;
  author: string;
  timestamp: number;
  text?: string;
  attachments?: Array<any>;
}

interface StagedAttachmentType extends AttachmentType {
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

  dropZoneFiles: FileList;
  quotedMessageProps?: ReplyingToMessageProps;
  removeQuotedMessage: () => void;

  textarea: React.RefObject<HTMLDivElement>;
}

interface State {
  message: string;
  showRecordingView: boolean;

  mediaSetting: boolean | null;
  showEmojiPanel: boolean;
  stagedAttachments: Array<StagedAttachmentType>;
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
      stagedAttachments: [],
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
    this.clearAttachments = this.clearAttachments.bind(this);
    this.removeAttachment = this.removeAttachment.bind(this);

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
    const { stagedAttachments } = this.state;
    if (stagedAttachments && stagedAttachments.length) {
      return (
        <AttachmentList
          attachments={stagedAttachments}
          // tslint:disable-next-line: no-empty
          onClickAttachment={() => {}}
          onAddAttachment={this.onChooseAttachment}
          onCloseAttachment={this.removeAttachment}
          onClose={this.clearAttachments}
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

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < attachmentsFileList.length; i++) {
      await this.maybeAddAttachment(attachmentsFileList[i]);
    }
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

    if (!messagePlaintext) {
      return;
    }

    // Verify message length
    const msgLen = messagePlaintext.length;
    if (msgLen === 0 || msgLen > window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH) {
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

      // Empty stagedAttachments
      // Empty composition box
      this.setState({
        message: '',
        showEmojiPanel: false,
      });
      this.clearAttachments();
    } catch (e) {
      // Message sending failed
      window.log.error(e);
      this.props.onMessageFailure();
    }
  }

  // this function is called right before sending a message, to gather really files bejind attachments.
  private async getFiles() {
    const { stagedAttachments } = this.state;
    const files = await Promise.all(
      stagedAttachments.map(attachment => this.getFile(attachment))
    );
    this.clearAttachments();
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

  // tslint:disable: max-func-body-length cyclomatic-complexity
  private async maybeAddAttachment(file: any) {
    if (!file) {
      return;
    }

    const fileName = file.name;
    const contentType = file.type;

    const { stagedAttachments } = this.state;

    if (window.Signal.Util.isFileDangerous(fileName)) {
      // this.showDangerousError();
      return;
    }

    if (stagedAttachments.length >= 32) {
      // this.showMaximumAttachmentsError();
      return;
    }

    const haveNonImage = _.some(
      stagedAttachments,
      attachment => !MIME.isImage(attachment.contentType)
    );
    // You can't add another attachment if you already have a non-image staged
    if (haveNonImage) {
      // this.showMultipleNonImageError();
      return;
    }

    // You can't add a non-image attachment if you already have attachments staged
    if (!MIME.isImage(contentType) && stagedAttachments.length > 0) {
      // this.showCannotMixError();
      return;
    }
    const { VisualAttachment } = window.Signal.Types;

    const renderVideoPreview = async () => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const type = 'image/png';
        const thumbnail = await VisualAttachment.makeVideoScreenshot({
          objectUrl,
          contentType: type,
          logger: window.log,
        });
        const data = await VisualAttachment.blobToArrayBuffer(thumbnail);
        const url = window.Signal.Util.arrayBufferToObjectURL({
          data,
          type,
        });
        this.addAttachment({
          file,
          size: file.size,
          fileName,
          contentType,
          videoUrl: objectUrl,
          url,
          isVoiceMessage: false,
        });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    const renderImagePreview = async () => {
      if (!MIME.isJPEG(contentType)) {
        const urlImage = URL.createObjectURL(file);
        if (!urlImage) {
          throw new Error('Failed to create object url for image!');
        }
        this.addAttachment({
          file,
          size: file.size,
          fileName,
          contentType,
          url: urlImage,
          isVoiceMessage: false,
        });
        return;
      }

      const url = await window.autoOrientImage(file);
      this.addAttachment({
        file,
        size: file.size,
        fileName,
        contentType,
        url,
        isVoiceMessage: false,
      });
    };

    try {
      const blob = await this.autoScale({
        contentType,
        file,
      });
      let limitKb = 10000;
      const blobType =
        file.type === 'image/gif' ? 'gif' : contentType.split('/')[0];

      switch (blobType) {
        case 'image':
          limitKb = 6000;
          break;
        case 'gif':
          limitKb = 10000;
          break;
        case 'audio':
          limitKb = 10000;
          break;
        case 'video':
          limitKb = 10000;
          break;
        default:
          limitKb = 10000;
      }
      // if ((blob.file.size / 1024).toFixed(4) >= limitKb) {
      //   const units = ['kB', 'MB', 'GB'];
      //   let u = -1;
      //   let limit = limitKb * 1000;
      //   do {
      //     limit /= 1000;
      //     u += 1;
      //   } while (limit >= 1000 && u < units.length - 1);
      //   // this.showFileSizeError(limit, units[u]);
      //   return;
      // }
    } catch (error) {
      window.log.error(
        'Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );

      // this.showLoadFailure();
      return;
    }

    try {
      if (GoogleChrome.isImageTypeSupported(contentType)) {
        await renderImagePreview();
      } else if (GoogleChrome.isVideoTypeSupported(contentType)) {
        await renderVideoPreview();
      } else {
        this.addAttachment({
          file,
          size: file.size,
          contentType,
          fileName,
          url: '',
          isVoiceMessage: false,
        });
      }
    } catch (e) {
      window.log.error(
        `Was unable to generate thumbnail for file type ${contentType}`,
        e && e.stack ? e.stack : e
      );
      this.addAttachment({
        file,
        size: file.size,
        contentType,
        fileName,
        isVoiceMessage: false,
        url: '',
      });
    }
  }

  private addAttachment(attachment: StagedAttachmentType) {
    const { stagedAttachments } = this.state;
    if (attachment.isVoiceMessage && stagedAttachments.length > 0) {
      throw new Error('A voice note cannot be sent with other attachments');
    }
    this.setState({
      stagedAttachments: [...stagedAttachments, { ...attachment }],
    });
  }

  private async autoScale<T extends { contentType: string; file: any }>(
    attachment: T
  ): Promise<T> {
    const { contentType, file } = attachment;
    if (contentType.split('/')[0] !== 'image' || contentType === 'image/tiff') {
      // nothing to do
      return Promise.resolve(attachment);
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.onerror = reject;
      img.onload = () => {
        URL.revokeObjectURL(url);

        const maxSize = 6000 * 1024;
        const maxHeight = 4096;
        const maxWidth = 4096;
        if (
          img.naturalWidth <= maxWidth &&
          img.naturalHeight <= maxHeight &&
          file.size <= maxSize
        ) {
          resolve(attachment);
          return;
        }

        const gifMaxSize = 25000 * 1024;
        if (file.type === 'image/gif' && file.size <= gifMaxSize) {
          resolve(attachment);
          return;
        }

        if (file.type === 'image/gif') {
          reject(new Error('GIF is too large'));
          return;
        }

        const canvas = window.loadImage.scale(img, {
          canvas: true,
          maxWidth,
          maxHeight,
        });

        let quality = 0.95;
        let i = 4;
        let blob;
        do {
          i -= 1;
          blob = window.dataURLToBlobSync(
            canvas.toDataURL('image/jpeg', quality)
          );
          quality = (quality * maxSize) / blob.size;
          // NOTE: During testing with a large image, we observed the
          // `quality` value being > 1. Should we clamp it to [0.5, 1.0]?
          // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Syntax
          if (quality < 0.5) {
            quality = 0.5;
          }
        } while (i > 0 && blob.size > maxSize);

        resolve({
          ...attachment,
          file: blob,
        });
      };
      img.src = url;
    });
  }

  private clearAttachments() {
    this.state.stagedAttachments.forEach(attachment => {
      if (attachment.url) {
        URL.revokeObjectURL(attachment.url);
      }
      if (attachment.videoUrl) {
        URL.revokeObjectURL(attachment.videoUrl);
      }
    });
    this.setState({ stagedAttachments: [] });
  }

  private removeAttachment(attachment: AttachmentType) {
    const { stagedAttachments } = this.state;
    const updatedStagedAttachments = (stagedAttachments || []).filter(
      m => m.fileName !== attachment.fileName
    );

    this.setState({ stagedAttachments: updatedStagedAttachments });
  }

  private async getFile(attachment: any) {
    if (!attachment) {
      return Promise.resolve();
    }

    const attachmentFlags = attachment.isVoiceMessage
      ? SignalService.AttachmentPointer.Flags.VOICE_MESSAGE
      : null;

    const scaled = await this.autoScale(attachment);
    const fileRead = await this.readFile(scaled);
    return {
      ...fileRead,
      url: undefined,
      flags: attachmentFlags || null,
    };
  }

  private async readFile(attachment: any): Promise<object> {
    return new Promise((resolve, reject) => {
      const FR = new FileReader();
      FR.onload = e => {
        const data = e?.target?.result as ArrayBuffer;
        resolve({
          ...attachment,
          data,
          size: data.byteLength,
        });
      };
      FR.onerror = reject;
      FR.onabort = reject;
      FR.readAsArrayBuffer(attachment.file);
    });
  }
}
