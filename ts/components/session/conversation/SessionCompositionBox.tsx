import React from 'react';
import _, { debounce } from 'lodash';

import { Attachment, AttachmentType } from '../../../types/Attachment';
import * as MIME from '../../../types/MIME';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionRecording } from './SessionRecording';

import { SignalService } from '../../../protobuf';

import { Constants } from '../../../session';

import { toArray } from 'react-emoji-render';
import { Flex } from '../Flex';
import { AttachmentList } from '../../conversation/AttachmentList';
import { ToastUtils } from '../../../session/utils';
import { AttachmentUtil } from '../../../util';
import {
  getPreview,
  LINK_PREVIEW_TIMEOUT,
  SessionStagedLinkPreview,
} from './SessionStagedLinkPreview';
import { AbortController } from 'abort-controller';
import { SessionQuotedMessageComposition } from './SessionQuotedMessageComposition';
import { Mention, MentionsInput } from 'react-mentions';
import { MemberItem } from '../../conversation/MemberList';
import { CaptionEditor } from '../../CaptionEditor';
import { DefaultTheme } from 'styled-components';

export interface ReplyingToMessageProps {
  convoId: string;
  id: string;
  author: string;
  timestamp: number;
  text?: string;
  attachments?: Array<any>;
}

export interface StagedLinkPreviewData {
  isLoaded: boolean;
  title: string | null;
  url: string | null;
  domain: string | null;
  description: string | null;
  image?: AttachmentType;
}

export interface StagedAttachmentType extends AttachmentType {
  file: File;
}

interface Props {
  sendMessage: any;
  onMessageSending: any;
  onMessageSuccess: any;
  onMessageFailure: any;

  onLoadVoiceNoteView: any;
  onExitVoiceNoteView: any;
  isBlocked: boolean;
  isPrivate: boolean;
  isKickedFromGroup: boolean;
  leftGroup: boolean;
  conversationKey: string;
  isPublic: boolean;

  quotedMessageProps?: ReplyingToMessageProps;
  removeQuotedMessage: () => void;

  textarea: React.RefObject<HTMLDivElement>;
  stagedAttachments: Array<StagedAttachmentType>;
  clearAttachments: () => any;
  removeAttachment: (toRemove: AttachmentType) => void;
  onChoseAttachments: (newAttachments: Array<File>) => void;
  theme: DefaultTheme;
}

interface State {
  message: string;
  showRecordingView: boolean;

  mediaSetting: boolean | null;
  showEmojiPanel: boolean;
  voiceRecording?: Blob;
  ignoredLink?: string; // set the the ignored url when users closed the link preview
  stagedLinkPreview?: StagedLinkPreviewData;
  showCaptionEditor?: AttachmentType;
}

const sendMessageStyle = {
  control: {
    wordBreak: 'break-all',
  },
  input: {
    overflow: 'auto',
    maxHeight: 70,
    wordBreak: 'break-all',
    padding: '0px',
    margin: '0px',
  },
  highlighter: {
    boxSizing: 'border-box',
    overflow: 'hidden',
    maxHeight: 70,
  },
  flexGrow: 1,
  minHeight: '24px',
  width: '100%',
};

const getDefaultState = () => {
  return {
    message: '',
    voiceRecording: undefined,
    showRecordingView: false,
    mediaSetting: null,
    showEmojiPanel: false,
    ignoredLink: undefined,
    stagedLinkPreview: undefined,
    showCaptionEditor: undefined,
  };
};

export class SessionCompositionBox extends React.Component<Props, State> {
  private readonly textarea: React.RefObject<any>;
  private readonly fileInput: React.RefObject<HTMLInputElement>;
  private emojiPanel: any;
  private linkPreviewAbortController?: AbortController;
  private container: any;
  private readonly mentionsRegex = /@\u{FFD2}05[0-9a-f]{64}:[^\u{FFD2}]+\u{FFD2}/gu;
  private lastBumpTypingMessageLength: number = 0;

  constructor(props: any) {
    super(props);
    this.state = getDefaultState();

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
    this.renderTextArea = this.renderTextArea.bind(this);
    this.renderQuotedMessage = this.renderQuotedMessage.bind(this);

    this.renderStagedLinkPreview = this.renderStagedLinkPreview.bind(this);
    this.renderAttachmentsStaged = this.renderAttachmentsStaged.bind(this);

    // Recording view functions
    this.sendVoiceMessage = this.sendVoiceMessage.bind(this);
    this.onLoadVoiceNoteView = this.onLoadVoiceNoteView.bind(this);
    this.onExitVoiceNoteView = this.onExitVoiceNoteView.bind(this);

    // Attachments
    this.onChoseAttachment = this.onChoseAttachment.bind(this);
    this.onChooseAttachment = this.onChooseAttachment.bind(this);
    this.onClickAttachment = this.onClickAttachment.bind(this);
    this.renderCaptionEditor = this.renderCaptionEditor.bind(this);

    // On Sending
    this.onSendMessage = this.onSendMessage.bind(this);

    // Events
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onChange = this.onChange.bind(this);
    this.focusCompositionBox = this.focusCompositionBox.bind(this);

    this.fetchUsersForGroup = this.fetchUsersForGroup.bind(this);
  }

  public async componentWillMount() {
    const mediaSetting = await window.getSettingValue('media-permissions');
    this.setState({ mediaSetting });
  }

  public componentDidMount() {
    setTimeout(this.focusCompositionBox, 100);
  }

  public componentWillUnmount() {
    this.linkPreviewAbortController?.abort();
    this.linkPreviewAbortController = undefined;
  }
  public componentDidUpdate(prevProps: Props, _prevState: State) {
    // reset the state on new conversation key
    if (prevProps.conversationKey !== this.props.conversationKey) {
      this.setState(getDefaultState(), this.focusCompositionBox);
      this.lastBumpTypingMessageLength = 0;
    } else if (
      this.props.stagedAttachments?.length !==
      prevProps.stagedAttachments?.length
    ) {
      // if number of staged attachment changed, focus the composition box for a more natural UI
      this.focusCompositionBox();
    }
  }

  public render() {
    const { showRecordingView } = this.state;

    return (
      <Flex flexDirection="column">
        {this.renderQuotedMessage()}
        {this.renderStagedLinkPreview()}
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
        theme={this.props.theme}
      />
    );
  }

  private isTypingEnabled(): boolean {
    const { isBlocked, isKickedFromGroup, leftGroup, isPrivate } = this.props;

    return !(isBlocked || isKickedFromGroup || leftGroup);
  }

  private renderCompositionView() {
    const { showEmojiPanel } = this.state;
    const typingEnabled = this.isTypingEnabled();

    return (
      <>
        {typingEnabled && (
          <SessionIconButton
            iconType={SessionIconType.CirclePlus}
            iconSize={SessionIconSize.Large}
            onClick={this.onChooseAttachment}
            theme={this.props.theme}
          />
        )}

        <input
          className="hidden"
          placeholder="Attachment"
          multiple={true}
          ref={this.fileInput}
          type="file"
          onChange={this.onChoseAttachment}
        />

        {typingEnabled && (
          <SessionIconButton
            iconType={SessionIconType.Microphone}
            iconSize={SessionIconSize.Huge}
            onClick={this.onLoadVoiceNoteView}
            theme={this.props.theme}
          />
        )}

        <div
          className="send-message-input"
          role="main"
          onClick={this.focusCompositionBox} // used to focus on the textarea when clicking in its container
          ref={el => {
            this.container = el;
          }}
        >
          {this.renderTextArea()}
        </div>

        {typingEnabled && (
          <SessionIconButton
            iconType={SessionIconType.Emoji}
            iconSize={SessionIconSize.Large}
            onClick={this.toggleEmojiPanel}
            theme={this.props.theme}
          />
        )}
        <div className="send-message-button">
          <SessionIconButton
            iconType={SessionIconType.Send}
            iconSize={SessionIconSize.Large}
            iconRotation={90}
            onClick={this.onSendMessage}
            theme={this.props.theme}
          />
        </div>

        {typingEnabled && (
          <div
            ref={ref => (this.emojiPanel = ref)}
            onKeyDown={this.onKeyDown}
            role="button"
          >
            {showEmojiPanel && (
              <SessionEmojiPanel
                onEmojiClicked={this.onEmojiClick}
                show={showEmojiPanel}
              />
            )}
          </div>
        )}
      </>
    );
  }

  private renderTextArea() {
    const { i18n } = window;
    const { message } = this.state;
    const { isKickedFromGroup, leftGroup, isPrivate, isBlocked } = this.props;
    const messagePlaceHolder = isKickedFromGroup
      ? i18n('youGotKickedFromGroup')
      : leftGroup
      ? i18n('youLeftTheGroup')
      : isBlocked && isPrivate
      ? i18n('unblockToSend')
      : isBlocked && !isPrivate
      ? i18n('unblockGroupToSend')
      : i18n('sendMessage');
    const typingEnabled = this.isTypingEnabled();

    return (
      <MentionsInput
        value={message}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
        onKeyUp={this.onKeyUp}
        placeholder={messagePlaceHolder}
        spellCheck={true}
        inputRef={this.textarea}
        disabled={!typingEnabled}
        maxLength={Constants.CONVERSATION.MAX_MESSAGE_BODY_LENGTH}
        rows={1}
        style={sendMessageStyle}
        suggestionsPortalHost={this.container}
        forceSuggestionsAboveCursor={true} // force mentions to be rendered on top of the cursor, this is working with a fork of react-mentions for now
      >
        <Mention
          appendSpaceOnAdd={true}
          // this will be cleaned on cleanMentions()
          markup="@ￒ__id__:__display__ￒ" // ￒ = \uFFD2 is one of the forbidden char for a display name (check displayNameRegex)
          trigger="@"
          // this is only for the composition box visible content. The real stuff on the backend box is the @markup
          displayTransform={(_id, display) => `@${display}`}
          data={this.fetchUsersForGroup}
          renderSuggestion={(
            suggestion,
            _search,
            _highlightedDisplay,
            _index,
            focused
          ) => (
            <MemberItem
              i18n={window.i18n}
              selected={focused}
              // tslint:disable-next-line: no-empty
              onClicked={() => {}}
              existingMember={false}
              member={{
                id: `${suggestion.id}`,
                authorPhoneNumber: `${suggestion.id}`,
                selected: false,
                authorProfileName: `${suggestion.display}`,
                authorName: `${suggestion.display}`,
                existingMember: false,
                checkmarked: false,
                authorAvatarPath: '',
              }}
              checkmarked={false}
            />
          )}
        />
      </MentionsInput>
    );
  }

  private fetchUsersForGroup(query: any, callback: any) {
    let overridenQuery = query;
    if (!query) {
      overridenQuery = '';
    }
    if (this.props.isPublic) {
      this.fetchUsersForOpenGroup(overridenQuery, callback);
      return;
    }
    if (!this.props.isPrivate) {
      this.fetchUsersForClosedGroup(overridenQuery, callback);
      return;
    }
  }

  private fetchUsersForOpenGroup(query: any, callback: any) {
    void window.lokiPublicChatAPI
      .getListOfMembers()
      .then(members =>
        members
          .filter(d => !!d)
          .filter(d => d.authorProfileName !== 'Anonymous')
          .filter(d =>
            d.authorProfileName?.toLowerCase()?.includes(query.toLowerCase())
          )
      )
      // Transform the users to what react-mentions expects
      .then(members => {
        const toRet = members.map(user => ({
          display: user.authorProfileName,
          id: user.authorPhoneNumber,
        }));
        return toRet;
      })
      .then(callback);
  }

  private fetchUsersForClosedGroup(query: any, callback: any) {
    const conversationModel = window.ConversationController.get(
      this.props.conversationKey
    );
    if (!conversationModel) {
      return;
    }
    const allPubKeys = conversationModel.get('members');

    const allMembers = allPubKeys.map(pubKey => {
      const conv = window.ConversationController.get(pubKey);
      let profileName = 'Anonymous';
      if (conv) {
        profileName = conv.getProfileName();
      }
      return {
        id: pubKey,
        authorPhoneNumber: pubKey,
        authorProfileName: profileName,
      };
    });
    // keep anonymous members so we can still quote them with their id
    const members = allMembers
      .filter(d => !!d)
      .filter(
        d =>
          d.authorProfileName?.toLowerCase()?.includes(query.toLowerCase()) ||
          !d.authorProfileName
      );

    // Transform the users to what react-mentions expects
    const mentionsData = members.map(user => ({
      display: user.authorProfileName || window.i18n('anonymous'),
      id: user.authorPhoneNumber,
    }));
    callback(mentionsData);
  }

  private renderStagedLinkPreview(): JSX.Element {
    // Don't generate link previews if user has turned them off
    if (!(window.getSettingValue('link-preview-setting') || false)) {
      return <></>;
    }

    const { stagedAttachments, quotedMessageProps } = this.props;
    const { ignoredLink } = this.state;

    // Don't render link previews if quoted message or attachments are already added
    if (stagedAttachments.length !== 0 || quotedMessageProps?.id) {
      return <></>;
    }
    // we try to match the first link found in the current message
    const links = window.Signal.LinkPreviews.findLinks(
      this.state.message,
      undefined
    );
    if (!links || links.length === 0 || ignoredLink === links[0]) {
      return <></>;
    }
    const firstLink = links[0];
    // if the first link changed, reset the ignored link so that the preview is generated
    if (ignoredLink && ignoredLink !== firstLink) {
      this.setState({ ignoredLink: undefined });
    }
    if (firstLink !== this.state.stagedLinkPreview?.url) {
      // trigger fetching of link preview data and image
      void this.fetchLinkPreview(firstLink);
    }

    // if the fetch did not start yet, just don't show anything
    if (!this.state.stagedLinkPreview) {
      return <></>;
    }

    const {
      isLoaded,
      title,
      description,
      domain,
      image,
    } = this.state.stagedLinkPreview;

    return (
      <SessionStagedLinkPreview
        isLoaded={isLoaded}
        title={title}
        description={description}
        domain={domain}
        image={image}
        url={firstLink}
        onClose={url => {
          this.setState({ ignoredLink: url });
        }}
      />
    );

    return <></>;
  }

  private async fetchLinkPreview(firstLink: string) {
    // mark the link preview as loading, no data are set yet
    this.setState({
      stagedLinkPreview: {
        isLoaded: false,
        url: firstLink,
        domain: null,
        description: null,
        image: undefined,
        title: null,
      },
    });
    const abortController = new AbortController();
    this.linkPreviewAbortController?.abort();
    this.linkPreviewAbortController = abortController;
    setTimeout(() => {
      abortController.abort();
    }, LINK_PREVIEW_TIMEOUT);

    getPreview(firstLink, abortController.signal)
      .then(ret => {
        let image: AttachmentType | undefined;
        if (ret) {
          if (ret.image?.width) {
            if (ret.image) {
              const blob = new Blob([ret.image.data], {
                type: ret.image.contentType,
              });
              const imageAttachment = {
                ...ret.image,
                url: URL.createObjectURL(blob),
                fileName: 'preview',
              };
              image = imageAttachment;
            }
          }
        }
        this.setState({
          stagedLinkPreview: {
            isLoaded: true,
            title: ret?.title || null,
            description: ret?.description || '',
            url: ret?.url || null,
            domain:
              (ret?.url && window.Signal.LinkPreviews.getDomain(ret.url)) || '',
            image,
          },
        });
      })
      .catch(err => {
        window.log.warn('fetch link preview: ', err);
        abortController.abort();
        this.setState({
          stagedLinkPreview: {
            isLoaded: true,
            title: null,
            domain: null,
            description: null,
            url: firstLink,
            image: undefined,
          },
        });
      });
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

  private onClickAttachment(attachment: AttachmentType) {
    this.setState({ showCaptionEditor: attachment });
  }

  private renderCaptionEditor(attachment?: AttachmentType) {
    if (attachment) {
      const onSave = (caption: string) => {
        // eslint-disable-next-line no-param-reassign
        attachment.caption = caption;
        ToastUtils.pushToastInfo('saved', window.i18n('saved'));
        // close the lightbox on save
        this.setState({
          showCaptionEditor: undefined,
        });
      };

      const url = attachment.videoUrl || attachment.url;
      return (
        <CaptionEditor
          attachment={attachment}
          url={url}
          onSave={onSave}
          caption={attachment.caption}
          onClose={() => {
            this.setState({
              showCaptionEditor: undefined,
            });
          }}
        />
      );
    }
    return <></>;
  }

  private renderAttachmentsStaged() {
    const { stagedAttachments } = this.props;
    const { showCaptionEditor } = this.state;
    if (stagedAttachments && stagedAttachments.length) {
      return (
        <>
          <AttachmentList
            attachments={stagedAttachments}
            onClickAttachment={this.onClickAttachment}
            onAddAttachment={this.onChooseAttachment}
            onCloseAttachment={this.props.removeAttachment}
            onClose={this.props.clearAttachments}
          />
          {this.renderCaptionEditor(showCaptionEditor)}
        </>
      );
    }
    return <></>;
  }

  private onChooseAttachment() {
    this.fileInput.current?.click();
  }

  private async onChoseAttachment() {
    // Build attachments list
    let attachmentsFileList = null;

    // this is terrible, but we have to reset the input value manually.
    // otherwise, the user won't be able to select two times the same file for example.
    if (this.fileInput.current?.files) {
      attachmentsFileList = Array.from(this.fileInput.current.files);
      this.fileInput.current.files = null;
      this.fileInput.current.value = '';
    }
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

  private async onKeyUp(event: any) {
    const { message } = this.state;
    // Called whenever the user changes the message composition field. But only
    //   fires if there's content in the message field after the change.
    // Also, check for a message length change before firing it up, to avoid
    // catching ESC, tab, or whatever which is not typing
    if (message.length && message.length !== this.lastBumpTypingMessageLength) {
      const conversationModel = window.ConversationController.get(
        this.props.conversationKey
      );
      if (!conversationModel) {
        return;
      }
      conversationModel.throttledBumpTyping();
      this.lastBumpTypingMessageLength = message.length;
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

  // tslint:disable-next-line: cyclomatic-complexity
  private async onSendMessage() {
    const toUnicode = (str: string) => {
      return str
        .split('')
        .map(value => {
          const temp = value
            .charCodeAt(0)
            .toString(16)
            .toUpperCase();
          if (temp.length > 2) {
            return `\\u${temp}`;
          }
          return value;
        })
        .join('');
    };

    // this is dirty but we have to replace all @(xxx) by @xxx manually here
    const cleanMentions = (text: string): string => {
      const textUnicode = toUnicode(text);
      const matches = text.match(this.mentionsRegex);
      let replacedMentions = text;
      (matches || []).forEach(match => {
        const replacedMention = match.substring(2, match.indexOf(':'));
        replacedMentions = replacedMentions.replace(
          match,
          `@${replacedMention}`
        );
      });

      return replacedMentions;
    };

    const messagePlaintext = cleanMentions(
      this.parseEmojis(this.state.message)
    );

    const { isBlocked, isPrivate, leftGroup, isKickedFromGroup } = this.props;

    // deny sending of message if our app version is expired
    if (window.extension.expiredStatus() === true) {
      ToastUtils.pushToastError(
        'expiredWarning',
        window.i18n('expiredWarning')
      );
      return;
    }

    if (isBlocked && isPrivate) {
      ToastUtils.pushUnblockToSend();
      return;
    }
    if (isBlocked && !isPrivate) {
      ToastUtils.pushUnblockToSendGroup();
      return;
    }
    // Verify message length
    const msgLen = messagePlaintext?.length || 0;
    if (msgLen > Constants.CONVERSATION.MAX_MESSAGE_BODY_LENGTH) {
      ToastUtils.pushMessageBodyTooLong();
      return;
    }
    if (msgLen === 0 && this.props.stagedAttachments?.length === 0) {
      ToastUtils.pushMessageBodyMissing();
      return;
    }
    if (!window.clientClockSynced) {
      let clockSynced = false;
      if (window.setClockParams) {
        // Check to see if user has updated their clock to current time
        clockSynced = await window.setClockParams();
      } else {
        window.log.info('setClockParams not loaded yet');
      }
      if (clockSynced) {
        ToastUtils.pushClockOutOfSync();
        return;
      }
    }

    if (!isPrivate && leftGroup) {
      ToastUtils.pushYouLeftTheGroup();
      return;
    }
    if (!isPrivate && isKickedFromGroup) {
      ToastUtils.pushYouLeftTheGroup();
      return;
    }

    const { quotedMessageProps } = this.props;
    const { stagedLinkPreview } = this.state;

    // Send message
    this.props.onMessageSending();
    const extractedQuotedMessageProps = _.pick(
      quotedMessageProps,
      'id',
      'author',
      'text',
      'attachments'
    );

    const linkPreviews =
      (stagedLinkPreview && [
        _.pick(stagedLinkPreview, 'url', 'image', 'title'),
      ]) ||
      [];

    try {
      const attachments = await this.getFiles();
      await this.props.sendMessage(
        messagePlaintext,
        attachments,
        extractedQuotedMessageProps,
        linkPreviews,
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
      if (stagedLinkPreview && stagedLinkPreview.url) {
        this.setState({
          stagedLinkPreview: undefined,
          ignoredLink: undefined,
        });
      }
    } catch (e) {
      // Message sending failed
      window.log.error(e);
      this.props.onMessageFailure();
    }
  }

  // this function is called right before sending a message, to gather really the files behind attachments.
  private async getFiles() {
    const { stagedAttachments } = this.props;
    // scale them down
    const files = await Promise.all(
      stagedAttachments.map(attachment =>
        AttachmentUtil.getFile(attachment, {
          maxSize: Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES,
        })
      )
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
      size: audioBlob.size,
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

    ToastUtils.pushAudioPermissionNeeded();
  }

  private onExitVoiceNoteView() {
    // Do stuff for component, then run callback to SessionConversation
    this.setState({ showRecordingView: false });
    this.props.onExitVoiceNoteView();
  }

  private onChange(event: any) {
    const message = event.target.value ?? '';

    this.setState({ message });
  }

  private onEmojiClick({ colons }: { colons: string }) {
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
