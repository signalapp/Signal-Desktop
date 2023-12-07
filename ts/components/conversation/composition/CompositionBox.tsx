import _, { debounce, isEmpty } from 'lodash';
import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';

import { AbortController } from 'abort-controller';
import { Mention, MentionsInput, SuggestionDataItem } from 'react-mentions';

import autoBind from 'auto-bind';
import * as MIME from '../../../types/MIME';

import { SessionEmojiPanel, StyledEmojiPanel } from '../SessionEmojiPanel';
import { SessionRecording } from '../SessionRecording';

import { SettingsKey } from '../../../data/settings-key';
import { showLinkSharingConfirmationModalDialog } from '../../../interactions/conversationInteractions';
import { getConversationController } from '../../../session/conversations';
import { ToastUtils } from '../../../session/utils';
import { ReduxConversationType } from '../../../state/ducks/conversations';
import { removeAllStagedAttachmentsInConversation } from '../../../state/ducks/stagedAttachments';
import { StateType } from '../../../state/reducer';
import {
  getMentionsInput,
  getQuotedMessage,
  getSelectedConversation,
} from '../../../state/selectors/conversations';
import {
  getSelectedCanWrite,
  getSelectedConversationKey,
} from '../../../state/selectors/selectedConversation';
import { AttachmentType } from '../../../types/Attachment';
import { processNewAttachment } from '../../../types/MessageAttachment';
import { FixedBaseEmoji } from '../../../types/Reaction';
import { AttachmentUtil } from '../../../util';
import {
  StagedAttachmentImportedType,
  StagedPreviewImportedType,
} from '../../../util/attachmentsUtil';
import { HTMLDirection } from '../../../util/i18n';
import { LinkPreviews } from '../../../util/linkPreviews';
import { CaptionEditor } from '../../CaptionEditor';
import { Flex } from '../../basic/Flex';
import { getMediaPermissionsSettings } from '../../settings/SessionSettings';
import { getDraftForConversation, updateDraftForConversation } from '../SessionConversationDrafts';
import { SessionQuotedMessageComposition } from '../SessionQuotedMessageComposition';
import {
  LINK_PREVIEW_TIMEOUT,
  SessionStagedLinkPreview,
  getPreview,
} from '../SessionStagedLinkPreview';
import { StagedAttachmentList } from '../StagedAttachmentList';
import {
  AddStagedAttachmentButton,
  SendMessageButton,
  StartRecordingButton,
  ToggleEmojiButton,
} from './CompositionButtons';
import { renderEmojiQuickResultRow, searchEmojiForQuery } from './EmojiQuickResult';
import {
  cleanMentions,
  mentionsRegex,
  renderUserMentionRow,
  styleForCompositionBoxSuggestions,
} from './UserMentions';

export interface ReplyingToMessageProps {
  convoId: string;
  id: string; // this is the quoted message timestamp
  author: string;
  timestamp: number;
  text?: string;
  attachments?: Array<any>;
}

export type StagedLinkPreviewImage = {
  data: ArrayBuffer;
  size: number;
  width: number;
  height: number;
  contentType: string;
};

export interface StagedLinkPreviewData {
  isLoaded: boolean;
  title: string | null;
  url: string | null;
  domain: string | null;
  image?: StagedLinkPreviewImage;
}

export interface StagedAttachmentType extends AttachmentType {
  file: File;
  path?: string; // a bit hacky, but this is the only way to make our sending audio message be playable, this must be used only for those message
}

export type SendMessageType = {
  body: string;
  attachments: Array<StagedAttachmentImportedType> | undefined;
  quote: any | undefined;
  preview: any | undefined;
  groupInvitation: { url: string | undefined; name: string } | undefined;
};

interface Props {
  sendMessage: (msg: SendMessageType) => void;
  selectedConversationKey?: string;
  selectedConversation: ReduxConversationType | undefined;
  typingEnabled: boolean;
  quotedMessageProps?: ReplyingToMessageProps;
  stagedAttachments: Array<StagedAttachmentType>;
  onChoseAttachments: (newAttachments: Array<File>) => void;
  htmlDirection: HTMLDirection;
}

interface State {
  showRecordingView: boolean;
  draft: string;
  showEmojiPanel: boolean;
  ignoredLink?: string; // set the ignored url when users closed the link preview
  stagedLinkPreview?: StagedLinkPreviewData;
  showCaptionEditor?: AttachmentType;
}

const sendMessageStyle = (dir?: HTMLDirection) => {
  return {
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
    ...styleForCompositionBoxSuggestions(dir),
  };
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
    lastRealMatchEndIndex += realLength;

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

const StyledEmojiPanelContainer = styled.div<{ dir?: HTMLDirection }>`
  ${StyledEmojiPanel} {
    position: absolute;
    bottom: 68px;
    ${props => (props.dir === 'rtl' ? 'left: 0px' : 'right: 0px;')}
  }
`;

const StyledSendMessageInput = styled.div<{ dir?: HTMLDirection }>`
  position: relative;
  cursor: text;
  display: flex;
  align-items: center;
  flex-grow: 1;
  min-height: var(--composition-container-height);
  padding: var(--margins-xs) 0;
  ${props => props.dir === 'rtl' && 'margin-inline-start: var(--margins-sm);'}
  z-index: 1;
  background-color: inherit;

  ul {
    max-height: 70vh;
    overflow: auto;
  }

  textarea {
    font-family: var(--font-default);
    min-height: calc(var(--composition-container-height) / 3);
    max-height: calc(3 * var(--composition-container-height));
    margin-right: var(--margins-md);
    color: var(--text-color-primary);

    background: transparent;
    resize: none;
    display: flex;
    flex-grow: 1;
    outline: none;
    border: none;
    font-size: 14px;
    line-height: var(--font-size-h2);
    letter-spacing: 0.5px;
  }

  &__emoji-overlay {
    // Should have identical properties to the textarea above to line up perfectly.
    position: absolute;
    font-size: 14px;
    font-family: var(--font-default);
    margin-left: 2px;
    line-height: var(--font-size-h2);
    letter-spacing: 0.5px;
    color: var(--transparent-color);
  }
`;

class CompositionBoxInner extends React.Component<Props, State> {
  private readonly textarea: React.RefObject<any>;
  private readonly fileInput: React.RefObject<HTMLInputElement>;
  private readonly emojiPanel: React.RefObject<HTMLDivElement>;
  private readonly emojiPanelButton: any;
  private linkPreviewAbortController?: AbortController;
  private container: HTMLDivElement | null;
  private lastBumpTypingMessageLength: number = 0;

  constructor(props: Props) {
    super(props);
    this.state = getDefaultState(props.selectedConversationKey);

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
    this.linkPreviewAbortController?.abort();
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
    // eslint-disable-next-line no-restricted-syntax
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
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onLoadVoiceNoteView={this.onLoadVoiceNoteView}
        onExitVoiceNoteView={this.onExitVoiceNoteView}
      />
    );
  }

  private renderCompositionView() {
    const { showEmojiPanel } = this.state;
    const { typingEnabled } = this.props;
    /* eslint-disable @typescript-eslint/no-misused-promises */

    return (
      <Flex
        dir={this.props.htmlDirection}
        container={true}
        flexDirection={'row'}
        alignItems={'center'}
        width={'100%'}
      >
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
        <StyledSendMessageInput
          role="main"
          dir={this.props.htmlDirection}
          onClick={this.focusCompositionBox} // used to focus on the textarea when clicking in its container
          ref={el => {
            this.container = el;
          }}
          data-testid="message-input"
        >
          {this.renderTextArea()}
        </StyledSendMessageInput>
        {typingEnabled && (
          <ToggleEmojiButton ref={this.emojiPanelButton} onClick={this.toggleEmojiPanel} />
        )}
        {typingEnabled && <SendMessageButton onClick={this.onSendMessage} />}
        {typingEnabled && showEmojiPanel && (
          <StyledEmojiPanelContainer role="button" dir={this.props.htmlDirection}>
            <SessionEmojiPanel
              ref={this.emojiPanel}
              show={showEmojiPanel}
              onEmojiClicked={this.onEmojiClick}
              onKeyDown={this.onKeyDown}
            />
          </StyledEmojiPanelContainer>
        )}
      </Flex>
    );
  }
  /* eslint-enable @typescript-eslint/no-misused-promises */

  private renderTextArea() {
    const { i18n } = window;
    const { draft } = this.state;
    const { htmlDirection } = this.props;

    if (!this.props.selectedConversation) {
      return null;
    }

    const makeMessagePlaceHolderText = () => {
      if (isKickedFromGroup) {
        return i18n('youGotKickedFromGroup');
      }
      if (left) {
        return i18n('youLeftTheGroup');
      }
      if (isBlocked) {
        return i18n('unblockToSend');
      }
      return i18n('sendMessage');
    };

    const { isKickedFromGroup, left, isBlocked } = this.props.selectedConversation;
    const messagePlaceHolder = makeMessagePlaceHolderText();
    const { typingEnabled } = this.props;
    const neverMatchingRegex = /($a)/;

    const style = sendMessageStyle(htmlDirection);

    return (
      <MentionsInput
        value={draft}
        onChange={this.onChange}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onKeyDown={this.onKeyDown}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onKeyUp={this.onKeyUp}
        placeholder={messagePlaceHolder}
        spellCheck={true}
        dir={htmlDirection}
        inputRef={this.textarea}
        disabled={!typingEnabled}
        rows={1}
        data-testid="message-input-text-area"
        style={style}
        suggestionsPortalHost={this.container as any}
        forceSuggestionsAboveCursor={true} // force mentions to be rendered on top of the cursor, this is working with a fork of react-mentions for now
      >
        <Mention
          appendSpaceOnAdd={true}
          // this will be cleaned on cleanMentions()
          markup="@ￒ__id__ￗ__display__ￒ" // ￒ = \uFFD2 is one of the forbidden char for a display name (check displayNameRegex)
          trigger="@"
          // this is only for the composition box visible content. The real stuff on the backend box is the @markup
          displayTransform={(_id, display) =>
            htmlDirection === 'rtl' ? `${display}@` : `@${display}`
          }
          data={this.fetchUsersForGroup}
          renderSuggestion={renderUserMentionRow}
        />
        <Mention
          trigger=":"
          markup="__id__"
          appendSpaceOnAdd={true}
          regex={neverMatchingRegex}
          data={searchEmojiForQuery}
          renderSuggestion={renderEmojiQuickResultRow}
        />
      </MentionsInput>
    );
  }

  private fetchUsersForOpenGroup(
    query: string,
    callback: (data: Array<SuggestionDataItem>) => void
  ) {
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
            id: user.id,
          };
        }) || [];

    callback(filtered);
  }

  private fetchUsersForGroup(query: string, callback: (data: Array<SuggestionDataItem>) => void) {
    let overridenQuery = query;
    if (!query) {
      overridenQuery = '';
    }
    if (!this.props.selectedConversation) {
      return;
    }

    if (this.props.selectedConversation.isPrivate) {
      return;
    }

    if (this.props.selectedConversation.isPublic) {
      this.fetchUsersForOpenGroup(overridenQuery, callback);
      return;
    }
    // can only be a closed group here
    this.fetchUsersForClosedGroup(overridenQuery, callback);
  }

  private fetchUsersForClosedGroup(
    query: string,
    callback: (data: Array<SuggestionDataItem>) => void
  ) {
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
      const profileName =
        conv?.getNicknameOrRealUsernameOrPlaceholder() || window.i18n('anonymous');

      return {
        id: pubKey,
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
      id: user.id,
    }));
    callback(mentionsData);
  }

  private renderStagedLinkPreview(): JSX.Element | null {
    // Don't generate link previews if user has turned them off
    if (!(window.getSettingValue(SettingsKey.settingsLinkPreview) || false)) {
      return null;
    }

    const { stagedAttachments, quotedMessageProps } = this.props;
    const { ignoredLink } = this.state;

    // Don't render link previews if quoted message or attachments are already added
    if (stagedAttachments.length !== 0 || quotedMessageProps?.id) {
      return null;
    }
    // we try to match the first link found in the current message
    const links = LinkPreviews.findLinks(this.state.draft, undefined);
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

    const { isLoaded, title, domain, image } = this.state.stagedLinkPreview;

    return (
      <SessionStagedLinkPreview
        isLoaded={isLoaded}
        title={title}
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

    // eslint-disable-next-line more/no-then
    getPreview(firstLink, abortController.signal)
      .then(ret => {
        // we finished loading the preview, and checking the abortConrtoller, we are still not aborted.
        // => update the staged preview
        if (this.linkPreviewAbortController && !this.linkPreviewAbortController.signal.aborted) {
          this.setState({
            stagedLinkPreview: {
              isLoaded: true,
              title: ret?.title || null,
              url: ret?.url || null,
              domain: (ret?.url && LinkPreviews.getDomain(ret.url)) || '',
              image: ret?.image,
            },
          });
        } else if (this.linkPreviewAbortController) {
          this.setState({
            stagedLinkPreview: {
              isLoaded: false,
              title: null,
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

        // if we were not aborted, it's probably just an error on the fetch. Nothing to do except mark the fetch as done (with errors)

        if (aborted) {
          this.setState({
            stagedLinkPreview: undefined,
          });
        } else {
          this.setState({
            stagedLinkPreview: {
              isLoaded: true,
              title: null,
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
    if (
      !this.props.selectedConversation?.didApproveMe &&
      this.props.selectedConversation?.isPrivate
    ) {
      ToastUtils.pushNoMediaUntilApproved();
      return;
    }
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
    const isEnter = event.key === 'Enter';
    const isShiftEnter = event.shiftKey && isEnter;
    const isShiftSendEnabled = window.getSettingValue(SettingsKey.hasShiftSendEnabled) as boolean;
    const isNotComposing = !event.nativeEvent.isComposing;

    if (isShiftSendEnabled && isEnter && isNotComposing) {
      event.preventDefault();
      if (isShiftEnter) {
        await this.onSendMessage();
      } else {
        this.insertNewLine();
      }
    } else if (isEnter && !event.shiftKey && isNotComposing) {
      event.preventDefault();
      await this.onSendMessage();
    } else if (event.key === 'Escape' && this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      // swallow pageUp events if they occurs on the composition box (it breaks the app layout)
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private insertNewLine() {
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

    const { draft } = this.state;
    const { selectedConversationKey } = this.props;

    if (!selectedConversationKey) {
      return; // add this check to prevent undefined from being used
    }

    const currentSelectionStart = Number(messageBox.selectionStart);
    const realSelectionStart = getSelectionBasedOnMentions(draft, currentSelectionStart);

    const before = draft.slice(0, realSelectionStart);
    const after = draft.slice(realSelectionStart);

    const updatedDraft = `${before}\n${after}`;

    this.setState({ draft: updatedDraft });
    updateDraftForConversation({
      conversationKey: selectedConversationKey,
      draft: updatedDraft,
    });
  }

  private async onKeyUp() {
    if (!this.props.selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
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

  private async onSendMessage() {
    if (!this.props.selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    this.linkPreviewAbortController?.abort();

    const messagePlaintext = cleanMentions(this.state.draft);

    const { selectedConversation } = this.props;

    if (!selectedConversation) {
      return;
    }

    if (selectedConversation.isBlocked) {
      ToastUtils.pushUnblockToSend();
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

    // we consider that a link preview without a title at least is not a preview
    const linkPreview =
      stagedLinkPreview?.isLoaded && stagedLinkPreview.title?.length
        ? _.pick(stagedLinkPreview, 'url', 'image', 'title')
        : undefined;

    try {
      // this does not call call removeAllStagedAttachmentsInConvers
      const { attachments, previews } = await this.getFiles(linkPreview);
      this.props.sendMessage({
        body: messagePlaintext.trim(),
        attachments: attachments || [],
        quote: extractedQuotedMessageProps,
        preview: previews,
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
  private async getFiles(
    linkPreview?: Pick<StagedLinkPreviewData, 'url' | 'title' | 'image'>
  ): Promise<{
    attachments: Array<StagedAttachmentImportedType>;
    previews: Array<StagedPreviewImportedType>;
  }> {
    const { stagedAttachments } = this.props;

    let attachments: Array<StagedAttachmentImportedType> = [];
    let previews: Array<StagedPreviewImportedType> = [];

    if (_.isEmpty(stagedAttachments)) {
      attachments = [];
    } else {
      // scale them down
      const files = await Promise.all(stagedAttachments.map(AttachmentUtil.getFileAndStoreLocally));
      attachments = _.compact(files);
    }

    if (!linkPreview || _.isEmpty(linkPreview) || !linkPreview.url || !linkPreview.title) {
      previews = [];
    } else {
      const sharedDetails = { url: linkPreview.url, title: linkPreview.title };
      // store the first image preview locally and get the path and details back to include them in the message
      const firstLinkPreviewImage = linkPreview.image;
      if (firstLinkPreviewImage && !isEmpty(firstLinkPreviewImage)) {
        const storedLinkPreviewAttachment = await AttachmentUtil.getFileAndStoreLocallyImageBuffer(
          firstLinkPreviewImage.data
        );
        if (storedLinkPreviewAttachment) {
          previews = [{ ...sharedDetails, image: storedLinkPreviewAttachment }];
        } else {
          // we couldn't save the image or whatever error happened, just return the url + title
          previews = [sharedDetails];
        }
      } else {
        // we did not fetch an image from the server
        previews = [sharedDetails];
      }
    }

    return { attachments, previews };
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
    if (!this.props.selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    const draft = event.target.value ?? '';
    this.setState({ draft });
    updateDraftForConversation({ conversationKey: this.props.selectedConversationKey, draft });
  }

  private onEmojiClick(emoji: FixedBaseEmoji) {
    if (!this.props.selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

    const { draft } = this.state;

    const currentSelectionStart = Number(messageBox.selectionStart);

    const realSelectionStart = getSelectionBasedOnMentions(draft, currentSelectionStart);

    const before = draft.slice(0, realSelectionStart);
    const end = draft.slice(realSelectionStart);

    const newMessage = `${before}${emoji.native}${end}`;
    this.setState({ draft: newMessage });
    updateDraftForConversation({
      conversationKey: this.props.selectedConversationKey,
      draft: newMessage,
    });

    // update our selection because updating text programmatically
    // will put the selection at the end of the textarea
    // const selectionStart = currentSelectionStart + Number(1);
    // messageBox.selectionStart = selectionStart;
    // messageBox.selectionEnd = selectionStart;

    // // Sometimes, we have to repeat the set of the selection position with a timeout to be effective
    // setTimeout(() => {
    //   messageBox.selectionStart = selectionStart;
    //   messageBox.selectionEnd = selectionStart;
    // }, 20);
  }

  private focusCompositionBox() {
    // Focus the textarea when user clicks anywhere in the composition box
    this.textarea.current?.focus();
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    quotedMessageProps: getQuotedMessage(state),
    selectedConversation: getSelectedConversation(state),
    selectedConversationKey: getSelectedConversationKey(state),
    typingEnabled: getSelectedCanWrite(state),
  };
};

const smart = connect(mapStateToProps);

export const CompositionBox = smart(CompositionBoxInner);
