import React from 'react';
import _, { debounce } from 'lodash';

import * as MIME from '../../../types/MIME';

import { SessionEmojiPanel } from '../SessionEmojiPanel';
import { SessionRecording } from '../SessionRecording';

import { toArray } from 'react-emoji-render';
import {
  getPreview,
  LINK_PREVIEW_TIMEOUT,
  SessionStagedLinkPreview,
} from '../SessionStagedLinkPreview';
import { AbortController } from 'abort-controller';
import { SessionQuotedMessageComposition } from '../SessionQuotedMessageComposition';
import { Mention, MentionsInput } from 'react-mentions';
import { MemberListItem } from '../../MemberListItem';
import autoBind from 'auto-bind';
import { getMediaPermissionsSettings } from '../../settings/SessionSettings';
import { getDraftForConversation, updateDraftForConversation } from '../SessionConversationDrafts';
import {
  AddStagedAttachmentButton,
  SendMessageButton,
  StartRecordingButton,
  ToggleEmojiButton,
} from './CompositionButtons';
import { AttachmentType } from '../../../types/Attachment';
import { connect } from 'react-redux';
import { showLinkSharingConfirmationModalDialog } from '../../../interactions/conversationInteractions';
import { getConversationController } from '../../../session/conversations';
import { ToastUtils } from '../../../session/utils';
import { ReduxConversationType } from '../../../state/ducks/conversations';
import { removeAllStagedAttachmentsInConversation } from '../../../state/ducks/stagedAttachments';
import { StateType } from '../../../state/reducer';
import {
  getIsTypingEnabled,
  getMentionsInput,
  getQuotedMessage,
  getSelectedConversation,
  getSelectedConversationKey,
} from '../../../state/selectors/conversations';
import { getTheme } from '../../../state/selectors/theme';
import { AttachmentUtil } from '../../../util';
import { Flex } from '../../basic/Flex';
import { CaptionEditor } from '../../CaptionEditor';
import { StagedAttachmentList } from '../StagedAttachmentList';
import { processNewAttachment } from '../../../types/MessageAttachment';

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
  path?: string; // a bit hacky, but this is the only way to make our sending audio message be playable, this must be used only for those message
}

export type SendMessageType = {
  body: string;
  attachments: Array<StagedAttachmentType> | undefined;
  quote: any | undefined;
  preview: any | undefined;
  groupInvitation: { url: string | undefined; name: string } | undefined;
};

interface Props {
  sendMessage: (msg: SendMessageType) => void;
  selectedConversationKey: string;
  selectedConversation: ReduxConversationType | undefined;
  typingEnabled: boolean;
  quotedMessageProps?: ReplyingToMessageProps;
  stagedAttachments: Array<StagedAttachmentType>;
  onChoseAttachments: (newAttachments: Array<File>) => void;
}

interface State {
  showRecordingView: boolean;
  draft: string;
  showEmojiPanel: boolean;
  ignoredLink?: string; // set the ignored url when users closed the link preview
  stagedLinkPreview?: StagedLinkPreviewData;
  showCaptionEditor?: AttachmentType;
}

const sendMessageStyle = {
  control: {
    wordBreak: 'break-all',
  },
  input: {
    overflow: 'auto',
    maxHeight: '50vh',
    wordBreak: 'break-word',
    padding: '0px',
    margin: '0px',
  },
  highlighter: {
    boxSizing: 'border-box',
    overflow: 'hidden',
    maxHeight: '50vh',
  },
  flexGrow: 1,
  minHeight: '24px',
  width: '100%',
};

const getDefaultState = (newConvoId?: string) => {
  return {
    draft: getDraftForConversation(newConvoId),
    showRecordingView: false,
    showEmojiPanel: false,
    ignoredLink: undefined,
    stagedLinkPreview: undefined,
    showCaptionEditor: undefined,
  };
};

function parseEmojis(value: string) {
  const emojisArray = toArray(value);

  // toArray outputs React elements for emojis and strings for other
  return emojisArray.reduce((previous: string, current: any) => {
    if (typeof current === 'string') {
      return previous + current;
    }
    return previous + (current.props.children as string);
  }, '');
}

const mentionsRegex = /@\uFFD205[0-9a-f]{64}\uFFD7[^\uFFD2]+\uFFD2/gu;

const getSelectionBasedOnMentions = (draft: string, index: number) => {
  // we have to get the real selectionStart/end of an index in the mentions box.
  // this is kind of a pain as the mentions box has two inputs, one with the real text, and one with the extracted mentions

  // the index shown to the user is actually just the visible part of the mentions (so the part between ￗ...ￒ
  const matches = draft.match(mentionsRegex);

  let lastMatchStartIndex = 0;
  let lastMatchEndIndex = 0;
  let lastRealMatchEndIndex = 0;

  if (!matches) {
    return index;
  }
  const mapStartToLengthOfMatches = matches.map(match => {
    const displayNameStart = match.indexOf('\uFFD7') + 1;
    const displayNameEnd = match.lastIndexOf('\uFFD2');
    const displayName = match.substring(displayNameStart, displayNameEnd);

    const currentMatchStartIndex = draft.indexOf(match) + lastMatchStartIndex;
    lastMatchStartIndex = currentMatchStartIndex;
    lastMatchEndIndex = currentMatchStartIndex + match.length;

    const realLength = displayName.length + 1;
    lastRealMatchEndIndex = lastRealMatchEndIndex + realLength;

    // the +1 is for the @
    return {
      length: displayName.length + 1,
      lastRealMatchEndIndex,
      start: lastMatchStartIndex,
      end: lastMatchEndIndex,
    };
  });

  const beforeFirstMatch = index < mapStartToLengthOfMatches[0].start;
  if (beforeFirstMatch) {
    // those first char are always just char, so the mentions logic does not come into account
    return index;
  }
  const lastMatchMap = _.last(mapStartToLengthOfMatches);

  if (!lastMatchMap) {
    return Number.MAX_SAFE_INTEGER;
  }

  const indexIsAfterEndOfLastMatch = lastMatchMap.lastRealMatchEndIndex <= index;
  if (indexIsAfterEndOfLastMatch) {
    const lastEnd = lastMatchMap.end;
    const diffBetweenEndAndLastRealEnd = index - lastMatchMap.lastRealMatchEndIndex;
    return lastEnd + diffBetweenEndAndLastRealEnd - 1;
  }
  // now this is the hard part, the cursor is currently between the end of the first match and the start of the last match
  // for now, just append it to the end
  return Number.MAX_SAFE_INTEGER;
};

class CompositionBoxInner extends React.Component<Props, State> {
  private readonly textarea: React.RefObject<any>;
  private readonly fileInput: React.RefObject<HTMLInputElement>;
  private readonly emojiPanel: React.RefObject<HTMLDivElement>;
  private readonly emojiPanelButton: any;
  private linkPreviewAbortController?: AbortController;
  private container: HTMLDivElement | null;
  private lastBumpTypingMessageLength: number = 0;

  constructor(props: any) {
    super(props);
    this.state = getDefaultState();

    this.textarea = React.createRef();
    this.fileInput = React.createRef();

    this.container = null;
    // Emojis
    this.emojiPanel = React.createRef();
    this.emojiPanelButton = React.createRef();
    autoBind(this);
    this.toggleEmojiPanel = debounce(this.toggleEmojiPanel.bind(this), 100);
  }

  public componentDidMount() {
    setTimeout(this.focusCompositionBox, 500);

    const div = this.container;
    div?.addEventListener('paste', this.handlePaste);
  }

  public componentWillUnmount() {
    this.abortLinkPreviewFetch();
    this.linkPreviewAbortController = undefined;

    const div = this.container;
    div?.removeEventListener('paste', this.handlePaste);
  }

  public componentDidUpdate(prevProps: Props, _prevState: State) {
    // reset the state on new conversation key
    if (prevProps.selectedConversationKey !== this.props.selectedConversationKey) {
      this.setState(getDefaultState(this.props.selectedConversationKey), this.focusCompositionBox);
      this.lastBumpTypingMessageLength = 0;
    } else if (this.props.stagedAttachments?.length !== prevProps.stagedAttachments?.length) {
      // if number of staged attachment changed, focus the composition box for a more natural UI
      this.focusCompositionBox();
    }

    // focus the composition box when user clicks start to reply to a message
    if (!_.isEqual(prevProps.quotedMessageProps, this.props.quotedMessageProps)) {
      this.focusCompositionBox();
    }
  }

  public render() {
    const { showRecordingView } = this.state;

    return (
      <Flex flexDirection="column">
        <SessionQuotedMessageComposition />
        {this.renderStagedLinkPreview()}
        {this.renderAttachmentsStaged()}
        <div className="composition-container">
          {showRecordingView ? this.renderRecordingView() : this.renderCompositionView()}
        </div>
      </Flex>
    );
  }

  private handleClick(e: any) {
    if (
      (this.emojiPanel?.current && this.emojiPanel.current.contains(e.target)) ||
      (this.emojiPanelButton?.current && this.emojiPanelButton.current.contains(e.target))
    ) {
      return;
    }

    this.hideEmojiPanel();
  }

  private handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) {
      return;
    }
    const { items } = e.clipboardData;
    let imgBlob = null;
    for (const item of items as any) {
      const pasteType = item.type.split('/')[0];
      if (pasteType === 'image') {
        imgBlob = item.getAsFile();
      }

      switch (pasteType) {
        case 'image':
          imgBlob = item.getAsFile();
          break;
        case 'text':
          void showLinkSharingConfirmationModalDialog(e);
          break;
        default:
      }
    }
    if (imgBlob !== null) {
      const file = imgBlob;
      window?.log?.info('Adding attachment from clipboard', file);
      this.props.onChoseAttachments([file]);

      e.preventDefault();
      e.stopPropagation();
    }
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
    const { showEmojiPanel } = this.state;
    const { typingEnabled } = this.props;

    return (
      <>
        {typingEnabled && <AddStagedAttachmentButton onClick={this.onChooseAttachment} />}

        <input
          className="hidden"
          placeholder="Attachment"
          multiple={true}
          ref={this.fileInput}
          type="file"
          onChange={this.onChoseAttachment}
        />

        {typingEnabled && <StartRecordingButton onClick={this.onLoadVoiceNoteView} />}

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
          <ToggleEmojiButton ref={this.emojiPanelButton} onClick={this.toggleEmojiPanel} />
        )}
        <SendMessageButton onClick={this.onSendMessage} />

        {typingEnabled && (
          <div ref={this.emojiPanel} onKeyDown={this.onKeyDown} role="button">
            {showEmojiPanel && (
              <SessionEmojiPanel onEmojiClicked={this.onEmojiClick} show={showEmojiPanel} />
            )}
          </div>
        )}
      </>
    );
  }

  private renderTextArea() {
    const { i18n } = window;
    const { draft } = this.state;

    if (!this.props.selectedConversation) {
      return null;
    }

    const { isKickedFromGroup, left, isPrivate, isBlocked } = this.props.selectedConversation;
    const messagePlaceHolder = isKickedFromGroup
      ? i18n('youGotKickedFromGroup')
      : left
      ? i18n('youLeftTheGroup')
      : isBlocked && isPrivate
      ? i18n('unblockToSend')
      : isBlocked && !isPrivate
      ? i18n('unblockGroupToSend')
      : i18n('sendMessage');
    const { typingEnabled } = this.props;

    return (
      <MentionsInput
        value={draft}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
        onKeyUp={this.onKeyUp}
        placeholder={messagePlaceHolder}
        spellCheck={true}
        inputRef={this.textarea}
        disabled={!typingEnabled}
        rows={1}
        style={sendMessageStyle}
        suggestionsPortalHost={this.container as any}
        forceSuggestionsAboveCursor={true} // force mentions to be rendered on top of the cursor, this is working with a fork of react-mentions for now
      >
        <Mention
          appendSpaceOnAdd={true}
          // this will be cleaned on cleanMentions()
          markup="@ￒ__id__ￗ__display__ￒ" // ￒ = \uFFD2 is one of the forbidden char for a display name (check displayNameRegex)
          trigger="@"
          // this is only for the composition box visible content. The real stuff on the backend box is the @markup
          displayTransform={(_id, display) => `@${display}`}
          data={this.fetchUsersForGroup}
          renderSuggestion={(suggestion, _search, _highlightedDisplay, _index, focused) => (
            <MemberListItem isSelected={focused} key={suggestion.id} pubkey={`${suggestion.id}`} />
          )}
        />
      </MentionsInput>
    );
  }

  private fetchUsersForOpenGroup(query: any, callback: any) {
    const mentionsInput = getMentionsInput(window?.inboxStore?.getState() || []);
    const filtered =
      mentionsInput
        .filter(d => !!d)
        .filter(d => d.authorProfileName !== 'Anonymous')
        .filter(d => d.authorProfileName?.toLowerCase()?.includes(query.toLowerCase()))
        // Transform the users to what react-mentions expects
        .map(user => {
          return {
            display: user.authorProfileName,
            id: user.authorPhoneNumber,
          };
        }) || [];
    callback(filtered);
  }

  private fetchUsersForGroup(query: any, callback: any) {
    let overridenQuery = query;
    if (!query) {
      overridenQuery = '';
    }
    if (!this.props.selectedConversation) {
      return;
    }

    if (this.props.selectedConversation.isPublic) {
      this.fetchUsersForOpenGroup(overridenQuery, callback);
      return;
    }
    if (!this.props.selectedConversation.isPrivate) {
      this.fetchUsersForClosedGroup(overridenQuery, callback);
      return;
    }
  }

  private fetchUsersForClosedGroup(query: any, callback: any) {
    const { selectedConversation } = this.props;
    if (!selectedConversation) {
      return;
    }
    const allPubKeys = selectedConversation.members;
    if (!allPubKeys || allPubKeys.length === 0) {
      return;
    }

    const allMembers = allPubKeys.map(pubKey => {
      const conv = getConversationController().get(pubKey);
      let profileName = 'Anonymous';
      if (conv) {
        profileName = conv.getProfileName() || 'Anonymous';
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
          d.authorProfileName?.toLowerCase()?.includes(query.toLowerCase()) || !d.authorProfileName
      );

    // Transform the users to what react-mentions expects
    const mentionsData = members.map(user => ({
      display: user.authorProfileName || window.i18n('anonymous'),
      id: user.authorPhoneNumber,
    }));
    callback(mentionsData);
  }

  private renderStagedLinkPreview(): JSX.Element | null {
    // Don't generate link previews if user has turned them off
    if (!(window.getSettingValue('link-preview-setting') || false)) {
      return null;
    }

    const { stagedAttachments, quotedMessageProps } = this.props;
    const { ignoredLink } = this.state;

    // Don't render link previews if quoted message or attachments are already added
    if (stagedAttachments.length !== 0 || quotedMessageProps?.id) {
      return null;
    }
    // we try to match the first link found in the current message
    const links = window.Signal.LinkPreviews.findLinks(this.state.draft, undefined);
    if (!links || links.length === 0 || ignoredLink === links[0]) {
      if (this.state.stagedLinkPreview) {
        this.setState({
          stagedLinkPreview: undefined,
        });
      }
      return null;
    }
    const firstLink = links[0];
    // if the first link changed, reset the ignored link so that the preview is generated
    if (ignoredLink && ignoredLink !== firstLink) {
      this.setState({ ignoredLink: undefined });
    }
    if (firstLink !== this.state.stagedLinkPreview?.url) {
      // trigger fetching of link preview data and image
      this.fetchLinkPreview(firstLink);
    }

    // if the fetch did not start yet, just don't show anything
    if (!this.state.stagedLinkPreview) {
      return null;
    }

    const { isLoaded, title, description, domain, image } = this.state.stagedLinkPreview;

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
  }

  private fetchLinkPreview(firstLink: string) {
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
    this.abortLinkPreviewFetch();
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
                fileSize: null,
                screenshot: null,
                thumbnail: null,
              };
              image = imageAttachment;
            }
          }
        }
        // we finished loading the preview, and checking the abortConrtoller, we are still not aborted.
        // => update the staged preview
        if (this.linkPreviewAbortController && !this.linkPreviewAbortController.signal.aborted) {
          this.setState({
            stagedLinkPreview: {
              isLoaded: true,
              title: ret?.title || null,
              description: ret?.description || '',
              url: ret?.url || null,
              domain: (ret?.url && window.Signal.LinkPreviews.getDomain(ret.url)) || '',
              image,
            },
          });
        } else if (this.linkPreviewAbortController) {
          this.setState({
            stagedLinkPreview: {
              isLoaded: false,
              title: null,
              description: null,
              url: null,
              domain: null,
              image: undefined,
            },
          });
          this.linkPreviewAbortController = undefined;
        }
      })
      .catch(err => {
        window?.log?.warn('fetch link preview: ', err);
        const aborted = this.linkPreviewAbortController?.signal.aborted;
        this.linkPreviewAbortController = undefined;
        // if we were aborted, it either means the UI was unmount, or more probably,
        // than the message was sent without the link preview.
        // So be sure to reset the staged link preview so it is not sent with the next message.

        // if we were not aborted, it's probably just an error on the fetch. Nothing to do excpet mark the fetch as done (with errors)

        if (aborted) {
          this.setState({
            stagedLinkPreview: undefined,
          });
        } else {
          this.setState({
            stagedLinkPreview: {
              isLoaded: true,
              title: null,
              description: null,
              url: firstLink,
              domain: null,
              image: undefined,
            },
          });
        }
      });
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
    return null;
  }

  private renderAttachmentsStaged() {
    const { stagedAttachments } = this.props;
    const { showCaptionEditor } = this.state;
    if (stagedAttachments && stagedAttachments.length) {
      return (
        <>
          <StagedAttachmentList
            attachments={stagedAttachments}
            onClickAttachment={this.onClickAttachment}
            onAddAttachment={this.onChooseAttachment}
          />
          {this.renderCaptionEditor(showCaptionEditor)}
        </>
      );
    }
    return null;
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
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      // If shift, newline. If in IME composing mode, leave it to IME. Else send message.
      event.preventDefault();
      await this.onSendMessage();
    } else if (event.key === 'Escape' && this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      // swallow pageUp events if they occurs on the composition box (it breaks the app layout)
      event.preventDefault();
    }
  }

  private async onKeyUp() {
    const { draft } = this.state;
    // Called whenever the user changes the message composition field. But only
    //   fires if there's content in the message field after the change.
    // Also, check for a message length change before firing it up, to avoid
    // catching ESC, tab, or whatever which is not typing
    if (draft && draft.length && draft.length !== this.lastBumpTypingMessageLength) {
      const conversationModel = getConversationController().get(this.props.selectedConversationKey);
      if (!conversationModel) {
        return;
      }
      conversationModel.throttledBumpTyping();
      this.lastBumpTypingMessageLength = draft.length;
    }
  }

  // tslint:disable-next-line: cyclomatic-complexity
  private async onSendMessage() {
    this.abortLinkPreviewFetch();

    // this is dirty but we have to replace all @(xxx) by @xxx manually here
    const cleanMentions = (text: string): string => {
      const matches = text.match(mentionsRegex);
      let replacedMentions = text;
      (matches || []).forEach(match => {
        const replacedMention = match.substring(2, match.indexOf('\uFFD7'));
        replacedMentions = replacedMentions.replace(match, `@${replacedMention}`);
      });

      return replacedMentions;
    };

    const messagePlaintext = cleanMentions(parseEmojis(this.state.draft));

    const { selectedConversation } = this.props;

    if (!selectedConversation) {
      return;
    }

    if (selectedConversation.isBlocked && selectedConversation.isPrivate) {
      ToastUtils.pushUnblockToSend();
      return;
    }
    if (selectedConversation.isBlocked && !selectedConversation.isPrivate) {
      ToastUtils.pushUnblockToSendGroup();
      return;
    }
    // Verify message length
    const msgLen = messagePlaintext?.length || 0;
    if (msgLen === 0 && this.props.stagedAttachments?.length === 0) {
      ToastUtils.pushMessageBodyMissing();
      return;
    }

    if (!selectedConversation.isPrivate && selectedConversation.left) {
      ToastUtils.pushYouLeftTheGroup();
      return;
    }
    if (!selectedConversation.isPrivate && selectedConversation.isKickedFromGroup) {
      ToastUtils.pushYouLeftTheGroup();
      return;
    }

    const { quotedMessageProps } = this.props;

    const { stagedLinkPreview } = this.state;

    // Send message
    const extractedQuotedMessageProps = _.pick(
      quotedMessageProps,
      'id',
      'author',
      'text',
      'attachments'
    );

    // we consider that a link previews without a title at least is not a preview
    const linkPreviews =
      (stagedLinkPreview &&
        stagedLinkPreview.isLoaded &&
        stagedLinkPreview.title?.length && [_.pick(stagedLinkPreview, 'url', 'image', 'title')]) ||
      [];

    try {
      const attachments = await this.getFiles();
      this.props.sendMessage({
        body: messagePlaintext,
        attachments: attachments || [],
        quote: extractedQuotedMessageProps,
        preview: linkPreviews,
        groupInvitation: undefined,
      });

      window.inboxStore?.dispatch(
        removeAllStagedAttachmentsInConversation({
          conversationKey: this.props.selectedConversationKey,
        })
      );
      // Empty composition box and stagedAttachments
      this.setState({
        showEmojiPanel: false,
        stagedLinkPreview: undefined,
        ignoredLink: undefined,
        draft: '',
      });
      updateDraftForConversation({
        conversationKey: this.props.selectedConversationKey,
        draft: '',
      });
    } catch (e) {
      // Message sending failed
      window?.log?.error(e);
    }
  }

  // this function is called right before sending a message, to gather really the files behind attachments.
  private async getFiles(): Promise<Array<StagedAttachmentType & { flags?: number }>> {
    const { stagedAttachments } = this.props;

    if (_.isEmpty(stagedAttachments)) {
      return [];
    }
    // scale them down
    const files = await Promise.all(stagedAttachments.map(AttachmentUtil.getFileAndStoreLocally));
    window.inboxStore?.dispatch(
      removeAllStagedAttachmentsInConversation({
        conversationKey: this.props.selectedConversationKey,
      })
    );
    return _.compact(files);
  }

  private async sendVoiceMessage(audioBlob: Blob) {
    if (!this.state.showRecordingView) {
      return;
    }

    const savedAudioFile = await processNewAttachment({
      data: await audioBlob.arrayBuffer(),
      isRaw: true,
      contentType: MIME.AUDIO_MP3,
    });
    // { ...savedAudioFile, path: savedAudioFile.path },
    const audioAttachment: StagedAttachmentType = {
      file: new File([], 'session-audio-message'), // this is just to emulate a file for the staged attachment type of that audio file
      contentType: MIME.AUDIO_MP3,
      size: savedAudioFile.size,
      fileSize: null,
      screenshot: null,
      fileName: 'session-audio-message',
      thumbnail: null,
      url: '',
      isVoiceMessage: true,
      path: savedAudioFile.path,
    };

    this.props.sendMessage({
      body: '',
      attachments: [audioAttachment],
      preview: undefined,
      quote: undefined,
      groupInvitation: undefined,
    });

    this.onExitVoiceNoteView();
  }

  private async onLoadVoiceNoteView() {
    if (!getMediaPermissionsSettings()) {
      ToastUtils.pushAudioPermissionNeeded();
      return;
    }
    this.setState({
      showRecordingView: true,
      showEmojiPanel: false,
    });
  }

  private onExitVoiceNoteView() {
    this.setState({ showRecordingView: false });
  }

  private onChange(event: any) {
    const draft = event.target.value ?? '';
    this.setState({ draft });
    updateDraftForConversation({ conversationKey: this.props.selectedConversationKey, draft });
  }

  private onEmojiClick({ colons }: { colons: string }) {
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

    const { draft } = this.state;

    const currentSelectionStart = Number(messageBox.selectionStart);

    const realSelectionStart = getSelectionBasedOnMentions(draft, currentSelectionStart);

    const before = draft.slice(0, realSelectionStart);
    const end = draft.slice(realSelectionStart);

    const newMessage = `${before}${colons}${end}`;
    this.setState({ draft: newMessage });
    updateDraftForConversation({
      conversationKey: this.props.selectedConversationKey,
      draft: newMessage,
    });

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
  }

  private focusCompositionBox() {
    // Focus the textarea when user clicks anywhere in the composition box
    this.textarea.current?.focus();
  }

  private abortLinkPreviewFetch() {
    this.linkPreviewAbortController?.abort();
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    quotedMessageProps: getQuotedMessage(state),
    selectedConversation: getSelectedConversation(state),
    selectedConversationKey: getSelectedConversationKey(state),
    typingEnabled: getIsTypingEnabled(state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps);

export const CompositionBox = smart(CompositionBoxInner);
