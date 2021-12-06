// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import React from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import classNames from 'classnames';
import { drop, groupBy, orderBy, take, unescape } from 'lodash';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow';

import type {
  ConversationType,
  ConversationTypeType,
  InteractionModeType,
} from '../../state/ducks/conversations';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { Avatar } from '../Avatar';
import { Spinner } from '../Spinner';
import {
  doesMessageBodyOverflow,
  MessageBodyReadMore,
} from './MessageBodyReadMore';
import { MessageMetadata } from './MessageMetadata';
import { ImageGrid } from './ImageGrid';
import { GIF } from './GIF';
import { Image } from './Image';
import { ContactName } from './ContactName';
import type { QuotedAttachmentType } from './Quote';
import { Quote } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';
import type { OwnProps as ReactionViewerProps } from './ReactionViewer';
import { ReactionViewer } from './ReactionViewer';
import type { Props as ReactionPickerProps } from './ReactionPicker';
import { Emoji } from '../emoji/Emoji';
import { LinkPreviewDate } from './LinkPreviewDate';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage';
import { WidthBreakpoint } from '../_util';
import * as log from '../../logging/log';

import type { AttachmentType } from '../../types/Attachment';
import {
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  getImageDimensions,
  hasImage,
  hasNotDownloaded,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isImageAttachment,
  isVideo,
  isGIF,
} from '../../types/Attachment';
import type { EmbeddedContactType } from '../../types/EmbeddedContact';

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import { missingCaseError } from '../../util/missingCaseError';
import type {
  BodyRangesType,
  LocalizerType,
  ThemeType,
} from '../../types/Util';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import type {
  ContactNameColorType,
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { createRefMerger } from '../../util/refMerger';
import { emojiToData, getEmojiCount } from '../emoji/lib';
import { isEmojiOnlyText } from '../../util/isEmojiOnlyText';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker';
import { getCustomColorStyle } from '../../util/getCustomColorStyle';
import { offsetDistanceModifier } from '../../util/popperUtil';
import * as KeyboardLayout from '../../services/keyboardLayout';
import { StopPropagation } from '../StopPropagation';

type Trigger = {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};

const STICKER_SIZE = 200;
const GIF_SIZE = 300;
const SELECTED_TIMEOUT = 1000;
const THREE_HOURS = 3 * 60 * 60 * 1000;

export const MessageStatuses = [
  'delivered',
  'error',
  'paused',
  'partial-sent',
  'read',
  'sending',
  'sent',
  'viewed',
] as const;
export type MessageStatusType = typeof MessageStatuses[number];

export const Directions = ['incoming', 'outgoing'] as const;
export type DirectionType = typeof Directions[number];

export type AudioAttachmentProps = {
  renderingContext: string;
  i18n: LocalizerType;
  buttonRef: React.RefObject<HTMLButtonElement>;
  theme: ThemeType | undefined;
  attachment: AttachmentType;
  withContentAbove: boolean;
  withContentBelow: boolean;

  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  id: string;
  played: boolean;
  showMessageDetail: (id: string) => void;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;

  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
  onFirstPlayed(): void;
};

export type PropsData = {
  id: string;
  renderingContext: string;
  contactNameColor?: ContactNameColorType;
  conversationColor: ConversationColorType;
  customColor?: CustomColorType;
  conversationId: string;
  displayLimit?: number;
  text?: string;
  textPending?: boolean;
  isSticker?: boolean;
  isSelected?: boolean;
  isSelectedCounter?: number;
  direction: DirectionType;
  timestamp: number;
  status?: MessageStatusType;
  contact?: EmbeddedContactType;
  author: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'badges'
    | 'color'
    | 'id'
    | 'isMe'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'unblurredAvatarPath'
  >;
  reducedMotion?: boolean;
  conversationType: ConversationTypeType;
  attachments?: Array<AttachmentType>;
  quote?: {
    conversationColor: ConversationColorType;
    customColor?: CustomColorType;
    text: string;
    rawAttachment?: QuotedAttachmentType;
    isFromMe: boolean;
    sentAt: number;
    authorId: string;
    authorPhoneNumber?: string;
    authorProfileName?: string;
    authorTitle: string;
    authorName?: string;
    bodyRanges?: BodyRangesType;
    referencedMessageNotFound: boolean;
    isViewOnce: boolean;
  };
  previews: Array<LinkPreviewType>;

  isTapToView?: boolean;
  isTapToViewExpired?: boolean;
  isTapToViewError?: boolean;

  readStatus: ReadStatus;

  expirationLength?: number;
  expirationTimestamp?: number;

  reactions?: ReactionViewerProps['reactions'];
  selectedReaction?: string;

  deletedForEveryone?: boolean;

  canReply: boolean;
  canDownload: boolean;
  canDeleteForEveryone: boolean;
  isBlocked: boolean;
  isMessageRequestAccepted: boolean;
  bodyRanges?: BodyRangesType;
};

export type PropsHousekeeping = {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  theme: ThemeType;
  disableMenu?: boolean;
  disableScroll?: boolean;
  collapseMetadata?: boolean;
  renderAudioAttachment: (props: AudioAttachmentProps) => JSX.Element;
  renderReactionPicker: (
    props: React.ComponentProps<typeof SmartReactionPicker>
  ) => JSX.Element;
};

export type PropsActions = {
  clearSelectedMessage: () => unknown;
  doubleCheckMissingQuoteReference: (messageId: string) => unknown;
  onHeightChange: () => unknown;
  messageExpanded: (id: string, displayLimit: number) => unknown;
  checkForAccount: (identifier: string) => unknown;

  reactToMessage: (
    id: string,
    { emoji, remove }: { emoji: string; remove: boolean }
  ) => void;
  replyToMessage: (id: string) => void;
  retrySend: (id: string) => void;
  showForwardMessageModal: (id: string) => void;
  deleteMessage: (id: string) => void;
  deleteMessageForEveryone: (id: string) => void;
  showMessageDetail: (id: string) => void;

  openConversation: (conversationId: string, messageId?: string) => void;
  showContactDetail: (options: {
    contact: EmbeddedContactType;
    signalAccount?: string;
  }) => void;
  showContactModal: (contactId: string) => void;

  kickOffAttachmentDownload: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  markAttachmentAsCorrupted: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  markViewed(messageId: string): void;
  showVisualAttachment: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  downloadAttachment: (options: {
    attachment: AttachmentType;
    timestamp: number;
    isDangerous: boolean;
  }) => void;
  displayTapToViewMessage: (messageId: string) => unknown;

  openLink: (url: string) => void;
  scrollToQuotedMessage: (options: {
    authorId: string;
    sentAt: number;
  }) => void;
  selectMessage?: (messageId: string, conversationId: string) => unknown;

  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
};

export type Props = PropsData &
  PropsHousekeeping &
  PropsActions &
  Pick<ReactionPickerProps, 'renderEmojiPicker'>;

type State = {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  isSelected?: boolean;
  prevSelectedCounter?: number;

  reactionViewerRoot: HTMLDivElement | null;
  reactionPickerRoot: HTMLDivElement | null;

  hasDeleteForEveryoneTimerExpired: boolean;
};

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

export class Message extends React.PureComponent<Props, State> {
  public menuTriggerRef: Trigger | undefined;

  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  public audioButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  public reactionsContainerRef: React.RefObject<HTMLDivElement> =
    React.createRef();

  public reactionsContainerRefMerger = createRefMerger();

  public expirationCheckInterval: NodeJS.Timeout | undefined;

  public expiredTimeout: NodeJS.Timeout | undefined;

  public selectedTimeout: NodeJS.Timeout | undefined;

  public deleteForEveryoneTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,

      isSelected: props.isSelected,
      prevSelectedCounter: props.isSelectedCounter,

      reactionViewerRoot: null,
      reactionPickerRoot: null,

      hasDeleteForEveryoneTimerExpired:
        this.getTimeRemainingForDeleteForEveryone() <= 0,
    };
  }

  public static getDerivedStateFromProps(props: Props, state: State): State {
    if (!props.isSelected) {
      return {
        ...state,
        isSelected: false,
        prevSelectedCounter: 0,
      };
    }

    if (
      props.isSelected &&
      props.isSelectedCounter !== state.prevSelectedCounter
    ) {
      return {
        ...state,
        isSelected: props.isSelected,
        prevSelectedCounter: props.isSelectedCounter,
      };
    }

    return state;
  }

  private hasReactions(): boolean {
    const { reactions } = this.props;
    return Boolean(reactions && reactions.length);
  }

  public captureMenuTrigger = (triggerRef: Trigger): void => {
    this.menuTriggerRef = triggerRef;
  };

  public showMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  };

  public showContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }
    if (event.target instanceof HTMLAnchorElement) {
      return;
    }
    this.showMenu(event);
  };

  public handleImageError = (): void => {
    const { id } = this.props;
    log.info(
      `Message ${id}: Image failed to load; failing over to placeholder`
    );
    this.setState({
      imageBroken: true,
    });
  };

  public handleFocus = (): void => {
    const { interactionMode } = this.props;

    if (interactionMode === 'keyboard') {
      this.setSelected();
    }
  };

  public setSelected = (): void => {
    const { id, conversationId, selectMessage } = this.props;

    if (selectMessage) {
      selectMessage(id, conversationId);
    }
  };

  public setFocus = (): void => {
    const container = this.focusRef.current;

    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }
  };

  public override componentDidMount(): void {
    this.startSelectedTimer();
    this.startDeleteForEveryoneTimerIfApplicable();

    const { isSelected } = this.props;
    if (isSelected) {
      this.setFocus();
    }

    const { expirationLength } = this.props;
    if (expirationLength) {
      const increment = getIncrement(expirationLength);
      const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);

      this.checkExpired();

      this.expirationCheckInterval = setInterval(() => {
        this.checkExpired();
      }, checkFrequency);
    }

    const { contact, checkForAccount } = this.props;
    if (contact && contact.firstNumber && !contact.isNumberOnSignal) {
      checkForAccount(contact.firstNumber);
    }
  }

  public override componentWillUnmount(): void {
    if (this.selectedTimeout) {
      clearTimeout(this.selectedTimeout);
    }
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
    if (this.expiredTimeout) {
      clearTimeout(this.expiredTimeout);
    }
    if (this.deleteForEveryoneTimeout) {
      clearTimeout(this.deleteForEveryoneTimeout);
    }
    this.toggleReactionViewer(true);
    this.toggleReactionPicker(true);
  }

  public override componentDidUpdate(prevProps: Props): void {
    const { isSelected, status, timestamp } = this.props;

    this.startSelectedTimer();
    this.startDeleteForEveryoneTimerIfApplicable();

    if (!prevProps.isSelected && isSelected) {
      this.setFocus();
    }

    this.checkExpired();
    this.checkForHeightChange(prevProps);

    if (
      prevProps.status === 'sending' &&
      (status === 'sent' ||
        status === 'delivered' ||
        status === 'read' ||
        status === 'viewed')
    ) {
      const delta = Date.now() - timestamp;
      window.CI?.handleEvent('message:send-complete', {
        timestamp,
        delta,
      });
      log.info(
        `Message.tsx: Rendered 'send complete' for message ${timestamp}; took ${delta}ms`
      );
    }
  }

  public checkForHeightChange(prevProps: Props): void {
    const { contact, onHeightChange } = this.props;
    const willRenderSendMessageButton = Boolean(
      contact && contact.firstNumber && contact.isNumberOnSignal
    );

    const { contact: previousContact } = prevProps;
    const previouslyRenderedSendMessageButton = Boolean(
      previousContact &&
        previousContact.firstNumber &&
        previousContact.isNumberOnSignal
    );

    if (willRenderSendMessageButton !== previouslyRenderedSendMessageButton) {
      onHeightChange();
    }
  }

  public startSelectedTimer(): void {
    const { clearSelectedMessage, interactionMode } = this.props;
    const { isSelected } = this.state;

    if (interactionMode === 'keyboard' || !isSelected) {
      return;
    }

    if (!this.selectedTimeout) {
      this.selectedTimeout = setTimeout(() => {
        this.selectedTimeout = undefined;
        this.setState({ isSelected: false });
        clearSelectedMessage();
      }, SELECTED_TIMEOUT);
    }
  }

  private getTimeRemainingForDeleteForEveryone(): number {
    const { timestamp } = this.props;
    return Math.max(timestamp - Date.now() + THREE_HOURS, 0);
  }

  private canDeleteForEveryone(): boolean {
    const { canDeleteForEveryone } = this.props;
    const { hasDeleteForEveryoneTimerExpired } = this.state;
    return canDeleteForEveryone && !hasDeleteForEveryoneTimerExpired;
  }

  private startDeleteForEveryoneTimerIfApplicable(): void {
    const { canDeleteForEveryone } = this.props;
    const { hasDeleteForEveryoneTimerExpired } = this.state;
    if (
      !canDeleteForEveryone ||
      hasDeleteForEveryoneTimerExpired ||
      this.deleteForEveryoneTimeout
    ) {
      return;
    }

    this.deleteForEveryoneTimeout = setTimeout(() => {
      this.setState({ hasDeleteForEveryoneTimerExpired: true });
      delete this.deleteForEveryoneTimeout;
    }, this.getTimeRemainingForDeleteForEveryone());
  }

  public checkExpired(): void {
    const now = Date.now();
    const { expirationTimestamp, expirationLength } = this.props;

    if (!expirationTimestamp || !expirationLength) {
      return;
    }
    if (this.expiredTimeout) {
      return;
    }

    if (now >= expirationTimestamp) {
      this.setState({
        expiring: true,
      });

      const setExpired = () => {
        this.setState({
          expired: true,
        });
      };
      this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);
    }
  }

  private areLinksEnabled(): boolean {
    const { isMessageRequestAccepted, isBlocked } = this.props;
    return isMessageRequestAccepted && !isBlocked;
  }

  private canRenderStickerLikeEmoji(): boolean {
    const { text, quote, attachments, previews } = this.props;

    return Boolean(
      text &&
        isEmojiOnlyText(text) &&
        getEmojiCount(text) < 6 &&
        !quote &&
        (!attachments || !attachments.length) &&
        (!previews || !previews.length)
    );
  }

  public renderMetadata(): JSX.Element | null {
    const {
      attachments,
      collapseMetadata,
      deletedForEveryone,
      direction,
      expirationLength,
      expirationTimestamp,
      isSticker,
      isTapToViewExpired,
      status,
      i18n,
      text,
      textPending,
      timestamp,
      id,
      showMessageDetail,
    } = this.props;

    if (collapseMetadata) {
      return null;
    }

    // The message audio component renders its own metadata because it positions the
    //   metadata in line with some of its own.
    if (isAudio(attachments) && !text) {
      return null;
    }

    const isStickerLike = isSticker || this.canRenderStickerLikeEmoji();

    return (
      <MessageMetadata
        deletedForEveryone={deletedForEveryone}
        direction={direction}
        expirationLength={expirationLength}
        expirationTimestamp={expirationTimestamp}
        hasText={Boolean(text)}
        i18n={i18n}
        id={id}
        isShowingImage={this.isShowingImage()}
        isSticker={isStickerLike}
        isTapToViewExpired={isTapToViewExpired}
        showMessageDetail={showMessageDetail}
        status={status}
        textPending={textPending}
        timestamp={timestamp}
      />
    );
  }

  public renderAuthor(): JSX.Element | null {
    const {
      author,
      collapseMetadata,
      contactNameColor,
      conversationType,
      direction,
      isSticker,
      isTapToView,
      isTapToViewExpired,
    } = this.props;

    if (collapseMetadata) {
      return null;
    }

    if (
      direction !== 'incoming' ||
      conversationType !== 'group' ||
      !author.title
    ) {
      return null;
    }

    const withTapToViewExpired = isTapToView && isTapToViewExpired;

    const stickerSuffix = isSticker ? '_with_sticker' : '';
    const tapToViewSuffix = withTapToViewExpired
      ? '--with-tap-to-view-expired'
      : '';
    const moduleName = `module-message__author${stickerSuffix}${tapToViewSuffix}`;

    return (
      <div className={moduleName}>
        <ContactName
          contactNameColor={contactNameColor}
          title={author.title}
          module={moduleName}
        />
      </div>
    );
  }

  public renderAttachment(): JSX.Element | null {
    const {
      attachments,
      collapseMetadata,
      conversationType,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      id,
      isSticker,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      markViewed,
      quote,
      readStatus,
      reducedMotion,
      renderAudioAttachment,
      renderingContext,
      showMessageDetail,
      showVisualAttachment,
      status,
      text,
      textPending,
      theme,
      timestamp,
    } = this.props;

    const { imageBroken } = this.state;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    // For attachments which aren't full-frame
    const withContentBelow = Boolean(text);
    const withContentAbove =
      Boolean(quote) ||
      (conversationType === 'group' && direction === 'incoming');
    const displayImage = canDisplayImage(attachments);

    if (displayImage && !imageBroken) {
      const prefix = isSticker ? 'sticker' : 'attachment';
      const containerClassName = classNames(
        `module-message__${prefix}-container`,
        withContentAbove
          ? `module-message__${prefix}-container--with-content-above`
          : null,
        withContentBelow
          ? 'module-message__attachment-container--with-content-below'
          : null,
        isSticker && !collapseMetadata
          ? 'module-message__sticker-container--with-content-below'
          : null
      );

      if (isGIF(attachments)) {
        return (
          <div className={containerClassName}>
            <GIF
              attachment={firstAttachment}
              size={GIF_SIZE}
              theme={theme}
              i18n={i18n}
              tabIndex={0}
              reducedMotion={reducedMotion}
              onError={this.handleImageError}
              showVisualAttachment={() => {
                showVisualAttachment({
                  attachment: firstAttachment,
                  messageId: id,
                });
              }}
              kickOffAttachmentDownload={() => {
                kickOffAttachmentDownload({
                  attachment: firstAttachment,
                  messageId: id,
                });
              }}
            />
          </div>
        );
      }

      if (isImage(attachments) || isVideo(attachments)) {
        const bottomOverlay = !isSticker && !collapseMetadata;
        // We only want users to tab into this if there's more than one
        const tabIndex = attachments.length > 1 ? 0 : -1;

        return (
          <div className={containerClassName}>
            <ImageGrid
              attachments={attachments}
              withContentAbove={isSticker || withContentAbove}
              withContentBelow={isSticker || withContentBelow}
              isSticker={isSticker}
              stickerSize={STICKER_SIZE}
              bottomOverlay={bottomOverlay}
              i18n={i18n}
              theme={theme}
              onError={this.handleImageError}
              tabIndex={tabIndex}
              onClick={attachment => {
                if (hasNotDownloaded(attachment)) {
                  kickOffAttachmentDownload({ attachment, messageId: id });
                } else {
                  showVisualAttachment({ attachment, messageId: id });
                }
              }}
            />
          </div>
        );
      }
    }
    if (isAudio(attachments)) {
      let played: boolean;
      switch (direction) {
        case 'outgoing':
          played = status === 'viewed';
          break;
        case 'incoming':
          played = readStatus === ReadStatus.Viewed;
          break;
        default:
          log.error(missingCaseError(direction));
          played = false;
          break;
      }

      return renderAudioAttachment({
        i18n,
        buttonRef: this.audioButtonRef,
        renderingContext,
        theme,
        attachment: firstAttachment,
        withContentAbove,
        withContentBelow,

        direction,
        expirationLength,
        expirationTimestamp,
        id,
        played,
        showMessageDetail,
        status,
        textPending,
        timestamp,

        kickOffAttachmentDownload() {
          kickOffAttachmentDownload({
            attachment: firstAttachment,
            messageId: id,
          });
        },
        onCorrupted() {
          markAttachmentAsCorrupted({
            attachment: firstAttachment,
            messageId: id,
          });
        },
        onFirstPlayed() {
          markViewed(id);
        },
      });
    }
    const { pending, fileName, fileSize, contentType } = firstAttachment;
    const extension = getExtensionForDisplay({ contentType, fileName });
    const isDangerous = isFileDangerous(fileName || '');

    return (
      <button
        type="button"
        className={classNames(
          'module-message__generic-attachment',
          withContentBelow
            ? 'module-message__generic-attachment--with-content-below'
            : null,
          withContentAbove
            ? 'module-message__generic-attachment--with-content-above'
            : null,
          !firstAttachment.url
            ? 'module-message__generic-attachment--not-active'
            : null
        )}
        // There's only ever one of these, so we don't want users to tab into it
        tabIndex={-1}
        onClick={this.openGenericAttachment}
      >
        {pending ? (
          <div className="module-message__generic-attachment__spinner-container">
            <Spinner svgSize="small" size="24px" direction={direction} />
          </div>
        ) : (
          <div className="module-message__generic-attachment__icon-container">
            <div className="module-message__generic-attachment__icon">
              {extension ? (
                <div className="module-message__generic-attachment__icon__extension">
                  {extension}
                </div>
              ) : null}
            </div>
            {isDangerous ? (
              <div className="module-message__generic-attachment__icon-dangerous-container">
                <div className="module-message__generic-attachment__icon-dangerous" />
              </div>
            ) : null}
          </div>
        )}
        <div className="module-message__generic-attachment__text">
          <div
            className={classNames(
              'module-message__generic-attachment__file-name',
              `module-message__generic-attachment__file-name--${direction}`
            )}
          >
            {fileName}
          </div>
          <div
            className={classNames(
              'module-message__generic-attachment__file-size',
              `module-message__generic-attachment__file-size--${direction}`
            )}
          >
            {fileSize}
          </div>
        </div>
      </button>
    );
  }

  public renderPreview(): JSX.Element | null {
    const {
      id,
      attachments,
      conversationType,
      direction,
      i18n,
      openLink,
      previews,
      quote,
      theme,
      kickOffAttachmentDownload,
    } = this.props;

    // Attachments take precedence over Link Previews
    if (attachments && attachments.length) {
      return null;
    }

    if (!previews || previews.length < 1) {
      return null;
    }

    const first = previews[0];
    if (!first) {
      return null;
    }

    const withContentAbove =
      Boolean(quote) ||
      (conversationType === 'group' && direction === 'incoming');

    const previewHasImage = isImageAttachment(first.image);
    const isFullSizeImage = shouldUseFullSizeLinkPreviewImage(first);

    const linkPreviewDate = first.date || null;

    const isClickable = this.areLinksEnabled();

    const className = classNames(
      'module-message__link-preview',
      `module-message__link-preview--${direction}`,
      {
        'module-message__link-preview--with-content-above': withContentAbove,
        'module-message__link-preview--nonclickable': !isClickable,
      }
    );
    const onPreviewImageClick = () => {
      if (first.image && hasNotDownloaded(first.image)) {
        kickOffAttachmentDownload({
          attachment: first.image,
          messageId: id,
        });
        return;
      }
      openLink(first.url);
    };
    const contents = (
      <>
        {first.image && previewHasImage && isFullSizeImage ? (
          <ImageGrid
            attachments={[first.image]}
            withContentAbove={withContentAbove}
            withContentBelow
            onError={this.handleImageError}
            i18n={i18n}
            theme={theme}
            onClick={onPreviewImageClick}
          />
        ) : null}
        <div className="module-message__link-preview__content">
          {first.image && previewHasImage && !isFullSizeImage ? (
            <div className="module-message__link-preview__icon_container">
              <Image
                smallCurveTopLeft={!withContentAbove}
                noBorder
                noBackground
                softCorners
                alt={i18n('previewThumbnail', [first.domain])}
                height={72}
                width={72}
                url={first.image.url}
                attachment={first.image}
                onError={this.handleImageError}
                i18n={i18n}
                onClick={onPreviewImageClick}
              />
            </div>
          ) : null}
          <div
            className={classNames(
              'module-message__link-preview__text',
              previewHasImage && !isFullSizeImage
                ? 'module-message__link-preview__text--with-icon'
                : null
            )}
          >
            <div className="module-message__link-preview__title">
              {first.title}
            </div>
            {first.description && (
              <div className="module-message__link-preview__description">
                {unescape(first.description)}
              </div>
            )}
            <div className="module-message__link-preview__footer">
              <div className="module-message__link-preview__location">
                {first.domain}
              </div>
              <LinkPreviewDate
                date={linkPreviewDate}
                className="module-message__link-preview__date"
              />
            </div>
          </div>
        </div>
      </>
    );

    return isClickable ? (
      <div
        role="link"
        tabIndex={0}
        className={className}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === 'Space') {
            event.stopPropagation();
            event.preventDefault();

            openLink(first.url);
          }
        }}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          openLink(first.url);
        }}
      >
        {contents}
      </div>
    ) : (
      <div className={className}>{contents}</div>
    );
  }

  public renderQuote(): JSX.Element | null {
    const {
      conversationColor,
      customColor,
      direction,
      disableScroll,
      doubleCheckMissingQuoteReference,
      i18n,
      id,
      quote,
      scrollToQuotedMessage,
    } = this.props;

    if (!quote) {
      return null;
    }

    const { isViewOnce, referencedMessageNotFound } = quote;

    const clickHandler = disableScroll
      ? undefined
      : () => {
          scrollToQuotedMessage({
            authorId: quote.authorId,
            sentAt: quote.sentAt,
          });
        };

    return (
      <Quote
        i18n={i18n}
        onClick={clickHandler}
        text={quote.text}
        rawAttachment={quote.rawAttachment}
        isIncoming={direction === 'incoming'}
        authorTitle={quote.authorTitle}
        bodyRanges={quote.bodyRanges}
        conversationColor={conversationColor}
        customColor={customColor}
        isViewOnce={isViewOnce}
        referencedMessageNotFound={referencedMessageNotFound}
        isFromMe={quote.isFromMe}
        doubleCheckMissingQuoteReference={() =>
          doubleCheckMissingQuoteReference(id)
        }
      />
    );
  }

  public renderEmbeddedContact(): JSX.Element | null {
    const {
      collapseMetadata,
      contact,
      conversationType,
      direction,
      i18n,
      showContactDetail,
      text,
    } = this.props;
    if (!contact) {
      return null;
    }

    const withCaption = Boolean(text);
    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';
    const withContentBelow = withCaption || !collapseMetadata;

    const otherContent =
      (contact && contact.firstNumber && contact.isNumberOnSignal) ||
      withCaption;
    const tabIndex = otherContent ? 0 : -1;

    return (
      <EmbeddedContact
        contact={contact}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={() => {
          showContactDetail({ contact, signalAccount: contact.firstNumber });
        }}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
        tabIndex={tabIndex}
      />
    );
  }

  public renderSendMessageButton(): JSX.Element | null {
    const { contact, openConversation, i18n } = this.props;
    if (!contact) {
      return null;
    }
    const { firstNumber, isNumberOnSignal } = contact;
    if (!firstNumber || !isNumberOnSignal) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => openConversation(firstNumber)}
        className="module-message__send-message-button"
      >
        {i18n('sendMessageToContact')}
      </button>
    );
  }

  public hasAvatar(): boolean {
    const { collapseMetadata, conversationType, direction } = this.props;

    return Boolean(
      !collapseMetadata &&
        conversationType === 'group' &&
        direction !== 'outgoing'
    );
  }

  public renderAvatar(): JSX.Element | undefined {
    const { author, getPreferredBadge, i18n, showContactModal, theme } =
      this.props;

    if (!this.hasAvatar()) {
      return undefined;
    }

    return (
      <div
        className={classNames('module-message__author-avatar-container', {
          'module-message__author-avatar-container--with-reactions':
            this.hasReactions(),
        })}
      >
        <Avatar
          acceptedMessageRequest={author.acceptedMessageRequest}
          avatarPath={author.avatarPath}
          badge={getPreferredBadge(author.badges)}
          color={author.color}
          conversationType="direct"
          i18n={i18n}
          isMe={author.isMe}
          name={author.name}
          onClick={event => {
            event.stopPropagation();
            event.preventDefault();

            showContactModal(author.id);
          }}
          phoneNumber={author.phoneNumber}
          profileName={author.profileName}
          sharedGroupNames={author.sharedGroupNames}
          size={28}
          theme={theme}
          title={author.title}
          unblurredAvatarPath={author.unblurredAvatarPath}
        />
      </div>
    );
  }

  public renderText(): JSX.Element | null {
    const {
      bodyRanges,
      deletedForEveryone,
      direction,
      displayLimit,
      i18n,
      id,
      messageExpanded,
      onHeightChange,
      openConversation,
      status,
      text,
      textPending,
    } = this.props;

    // eslint-disable-next-line no-nested-ternary
    const contents = deletedForEveryone
      ? i18n('message--deletedForEveryone')
      : direction === 'incoming' && status === 'error'
      ? i18n('incomingError')
      : text;

    if (!contents) {
      return null;
    }

    return (
      <div
        dir="auto"
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`,
          status === 'error' && direction === 'incoming'
            ? 'module-message__text--error'
            : null
        )}
      >
        <MessageBodyReadMore
          bodyRanges={bodyRanges}
          disableLinks={!this.areLinksEnabled()}
          direction={direction}
          displayLimit={displayLimit}
          i18n={i18n}
          id={id}
          messageExpanded={messageExpanded}
          openConversation={openConversation}
          onHeightChange={onHeightChange}
          text={contents || ''}
          textPending={textPending}
        />
      </div>
    );
  }

  public renderError(isCorrectSide: boolean): JSX.Element | null {
    const { status, direction } = this.props;

    if (!isCorrectSide) {
      return null;
    }

    if (
      status !== 'paused' &&
      status !== 'error' &&
      status !== 'partial-sent'
    ) {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`,
            `module-message__error--${status}`
          )}
        />
      </div>
    );
  }

  public renderMenu(
    isCorrectSide: boolean,
    triggerId: string
  ): JSX.Element | null {
    const {
      attachments,
      canDownload,
      canReply,
      direction,
      disableMenu,
      i18n,
      id,
      isSticker,
      isTapToView,
      reactToMessage,
      renderEmojiPicker,
      renderReactionPicker,
      replyToMessage,
      selectedReaction,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    const { reactionPickerRoot } = this.state;

    const multipleAttachments = attachments && attachments.length > 1;
    const firstAttachment = attachments && attachments[0];

    const downloadButton =
      !isSticker &&
      !multipleAttachments &&
      !isTapToView &&
      firstAttachment &&
      !firstAttachment.pending ? (
        // This a menu meant for mouse use only
        // eslint-disable-next-line max-len
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
        <div
          onClick={this.openGenericAttachment}
          role="button"
          aria-label={i18n('downloadAttachment')}
          className={classNames(
            'module-message__buttons__download',
            `module-message__buttons__download--${direction}`
          )}
        />
      ) : null;

    const reactButton = (
      <Reference>
        {({ ref: popperRef }) => {
          // Only attach the popper reference to the reaction button if it is
          //   visible (it is hidden when the timeline is narrow)
          const maybePopperRef = this.isWindowWidthNotNarrow()
            ? popperRef
            : undefined;

          return (
            // This a menu meant for mouse use only
            // eslint-disable-next-line max-len
            // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
            <div
              ref={maybePopperRef}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                this.toggleReactionPicker();
              }}
              role="button"
              className="module-message__buttons__react"
              aria-label={i18n('reactToMessage')}
            />
          );
        }}
      </Reference>
    );

    const replyButton = (
      // This a menu meant for mouse use only
      // eslint-disable-next-line max-len
      // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
      <div
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          replyToMessage(id);
        }}
        // This a menu meant for mouse use only
        role="button"
        aria-label={i18n('replyToMessage')}
        className={classNames(
          'module-message__buttons__reply',
          `module-message__buttons__download--${direction}`
        )}
      />
    );

    // This a menu meant for mouse use only
    /* eslint-disable jsx-a11y/interactive-supports-focus */
    /* eslint-disable jsx-a11y/click-events-have-key-events */
    const menuButton = (
      <Reference>
        {({ ref: popperRef }) => {
          // Only attach the popper reference to the collapsed menu button if the reaction
          //   button is not visible (it is hidden when the timeline is narrow)
          const maybePopperRef = !this.isWindowWidthNotNarrow()
            ? popperRef
            : undefined;

          return (
            <StopPropagation className="module-message__buttons__menu--container">
              <ContextMenuTrigger
                id={triggerId}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={this.captureMenuTrigger as any}
              >
                <div
                  ref={maybePopperRef}
                  role="button"
                  onClick={this.showMenu}
                  aria-label={i18n('messageContextMenuButton')}
                  className={classNames(
                    'module-message__buttons__menu',
                    `module-message__buttons__download--${direction}`
                  )}
                />
              </ContextMenuTrigger>
            </StopPropagation>
          );
        }}
      </Reference>
    );
    /* eslint-enable jsx-a11y/interactive-supports-focus */
    /* eslint-enable jsx-a11y/click-events-have-key-events */

    return (
      <Manager>
        <div
          className={classNames(
            'module-message__buttons',
            `module-message__buttons--${direction}`
          )}
        >
          {this.isWindowWidthNotNarrow() && (
            <>
              {canReply ? reactButton : null}
              {canDownload ? downloadButton : null}
              {canReply ? replyButton : null}
            </>
          )}
          {menuButton}
        </div>
        {reactionPickerRoot &&
          createPortal(
            <StopPropagation>
              <Popper
                placement="top"
                modifiers={[
                  offsetDistanceModifier(4),
                  this.popperPreventOverflowModifier(),
                ]}
              >
                {({ ref, style }) =>
                  renderReactionPicker({
                    ref,
                    style,
                    selected: selectedReaction,
                    onClose: this.toggleReactionPicker,
                    onPick: emoji => {
                      this.toggleReactionPicker(true);
                      reactToMessage(id, {
                        emoji,
                        remove: emoji === selectedReaction,
                      });
                    },
                    renderEmojiPicker,
                  })
                }
              </Popper>
            </StopPropagation>,
            reactionPickerRoot
          )}
      </Manager>
    );
  }

  public renderContextMenu(triggerId: string): JSX.Element {
    const {
      attachments,
      canDownload,
      canReply,
      deleteMessage,
      deleteMessageForEveryone,
      deletedForEveryone,
      direction,
      i18n,
      id,
      isSticker,
      isTapToView,
      replyToMessage,
      retrySend,
      showForwardMessageModal,
      showMessageDetail,
      status,
      text,
    } = this.props;

    const canForward = !isTapToView && !deletedForEveryone;

    const showRetry =
      (status === 'paused' ||
        status === 'error' ||
        status === 'partial-sent') &&
      direction === 'outgoing';
    const multipleAttachments = attachments && attachments.length > 1;

    const shouldShowAdditional =
      doesMessageBodyOverflow(text || '') || !this.isWindowWidthNotNarrow();

    const menu = (
      <ContextMenu id={triggerId}>
        {canDownload &&
        shouldShowAdditional &&
        !isSticker &&
        !multipleAttachments &&
        !isTapToView &&
        attachments &&
        attachments[0] ? (
          <MenuItem
            attributes={{
              className:
                'module-message__context--icon module-message__context__download',
            }}
            onClick={this.openGenericAttachment}
          >
            {i18n('downloadAttachment')}
          </MenuItem>
        ) : null}
        {canReply && shouldShowAdditional ? (
          <>
            <MenuItem
              attributes={{
                className:
                  'module-message__context--icon module-message__context__reply',
              }}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                replyToMessage(id);
              }}
            >
              {i18n('replyToMessage')}
            </MenuItem>
            <MenuItem
              attributes={{
                className:
                  'module-message__context--icon module-message__context__react',
              }}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                this.toggleReactionPicker();
              }}
            >
              {i18n('reactToMessage')}
            </MenuItem>
          </>
        ) : null}
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__more-info',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            showMessageDetail(id);
          }}
        >
          {i18n('moreInfo')}
        </MenuItem>
        {showRetry ? (
          <MenuItem
            attributes={{
              className:
                'module-message__context--icon module-message__context__retry-send',
            }}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              event.preventDefault();

              retrySend(id);
            }}
          >
            {i18n('retrySend')}
          </MenuItem>
        ) : null}
        {canForward ? (
          <MenuItem
            attributes={{
              className:
                'module-message__context--icon module-message__context__forward-message',
            }}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              event.preventDefault();

              showForwardMessageModal(id);
            }}
          >
            {i18n('forwardMessage')}
          </MenuItem>
        ) : null}
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__delete-message',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            deleteMessage(id);
          }}
        >
          {i18n('deleteMessage')}
        </MenuItem>
        {this.canDeleteForEveryone() ? (
          <MenuItem
            attributes={{
              className:
                'module-message__context--icon module-message__context__delete-message-for-everyone',
            }}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              event.preventDefault();

              deleteMessageForEveryone(id);
            }}
          >
            {i18n('deleteMessageForEveryone')}
          </MenuItem>
        ) : null}
      </ContextMenu>
    );

    return ReactDOM.createPortal(menu, document.body);
  }

  private isWindowWidthNotNarrow(): boolean {
    const { containerWidthBreakpoint } = this.props;
    return containerWidthBreakpoint !== WidthBreakpoint.Narrow;
  }

  public getWidth(): number | undefined {
    const { attachments, isSticker, previews } = this.props;

    if (attachments && attachments.length) {
      if (isGIF(attachments)) {
        // Message container border
        return GIF_SIZE + 2;
      }

      if (isSticker) {
        // Padding is 8px, on both sides, plus two for 1px border
        return STICKER_SIZE + 8 * 2 + 2;
      }

      const dimensions = getGridDimensions(attachments);
      if (dimensions) {
        // Add two for 1px border
        return dimensions.width + 2;
      }
    }

    const firstLinkPreview = (previews || [])[0];
    if (
      firstLinkPreview &&
      firstLinkPreview.image &&
      shouldUseFullSizeLinkPreviewImage(firstLinkPreview)
    ) {
      const dimensions = getImageDimensions(firstLinkPreview.image);
      if (dimensions) {
        // Add two for 1px border
        return dimensions.width + 2;
      }
    }

    return undefined;
  }

  public isShowingImage(): boolean {
    const { isTapToView, attachments, previews } = this.props;
    const { imageBroken } = this.state;

    if (imageBroken || isTapToView) {
      return false;
    }

    if (attachments && attachments.length) {
      const displayImage = canDisplayImage(attachments);

      return displayImage && (isImage(attachments) || isVideo(attachments));
    }

    if (previews && previews.length) {
      const first = previews[0];
      const { image } = first;

      return isImageAttachment(image);
    }

    return false;
  }

  public isAttachmentPending(): boolean {
    const { attachments } = this.props;

    if (!attachments || attachments.length < 1) {
      return false;
    }

    const first = attachments[0];

    return Boolean(first.pending);
  }

  public renderTapToViewIcon(): JSX.Element {
    const { direction, isTapToViewExpired } = this.props;
    const isDownloadPending = this.isAttachmentPending();

    return !isTapToViewExpired && isDownloadPending ? (
      <div className="module-message__tap-to-view__spinner-container">
        <Spinner svgSize="small" size="20px" direction={direction} />
      </div>
    ) : (
      <div
        className={classNames(
          'module-message__tap-to-view__icon',
          `module-message__tap-to-view__icon--${direction}`,
          isTapToViewExpired
            ? 'module-message__tap-to-view__icon--expired'
            : null
        )}
      />
    );
  }

  public renderTapToViewText(): string | undefined {
    const {
      attachments,
      direction,
      i18n,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;

    const incomingString = isTapToViewExpired
      ? i18n('Message--tap-to-view-expired')
      : i18n(
          `Message--tap-to-view--incoming${
            isVideo(attachments) ? '-video' : ''
          }`
        );
    const outgoingString = i18n('Message--tap-to-view--outgoing');
    const isDownloadPending = this.isAttachmentPending();

    if (isDownloadPending) {
      return;
    }

    // eslint-disable-next-line no-nested-ternary
    return isTapToViewError
      ? i18n('incomingError')
      : direction === 'outgoing'
      ? outgoingString
      : incomingString;
  }

  public renderTapToView(): JSX.Element {
    const {
      collapseMetadata,
      conversationType,
      direction,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;

    const withContentBelow = !collapseMetadata;
    const withContentAbove =
      !collapseMetadata &&
      conversationType === 'group' &&
      direction === 'incoming';

    return (
      <div
        className={classNames(
          'module-message__tap-to-view',
          withContentBelow
            ? 'module-message__tap-to-view--with-content-below'
            : null,
          withContentAbove
            ? 'module-message__tap-to-view--with-content-above'
            : null
        )}
      >
        {isTapToViewError ? null : this.renderTapToViewIcon()}
        <div
          className={classNames(
            'module-message__tap-to-view__text',
            `module-message__tap-to-view__text--${direction}`,
            isTapToViewExpired
              ? `module-message__tap-to-view__text--${direction}-expired`
              : null,
            isTapToViewError
              ? `module-message__tap-to-view__text--${direction}-error`
              : null
          )}
        >
          {this.renderTapToViewText()}
        </div>
      </div>
    );
  }

  private popperPreventOverflowModifier(): Partial<PreventOverflowModifier> {
    const { containerElementRef } = this.props;
    return {
      name: 'preventOverflow',
      options: {
        altAxis: true,
        boundary: containerElementRef.current || undefined,
        padding: {
          bottom: 16,
          left: 8,
          right: 8,
          top: 16,
        },
      },
    };
  }

  public toggleReactionViewer = (onlyRemove = false): void => {
    this.setState(({ reactionViewerRoot }) => {
      if (reactionViewerRoot) {
        document.body.removeChild(reactionViewerRoot);
        document.body.removeEventListener(
          'click',
          this.handleClickOutsideReactionViewer,
          true
        );

        return { reactionViewerRoot: null };
      }

      if (!onlyRemove) {
        const root = document.createElement('div');
        document.body.appendChild(root);
        document.body.addEventListener(
          'click',
          this.handleClickOutsideReactionViewer,
          true
        );

        return {
          reactionViewerRoot: root,
        };
      }

      return { reactionViewerRoot: null };
    });
  };

  public toggleReactionPicker = (onlyRemove = false): void => {
    this.setState(({ reactionPickerRoot }) => {
      if (reactionPickerRoot) {
        document.body.removeChild(reactionPickerRoot);
        document.body.removeEventListener(
          'click',
          this.handleClickOutsideReactionPicker,
          true
        );

        return { reactionPickerRoot: null };
      }

      if (!onlyRemove) {
        const root = document.createElement('div');
        document.body.appendChild(root);
        document.body.addEventListener(
          'click',
          this.handleClickOutsideReactionPicker,
          true
        );

        return {
          reactionPickerRoot: root,
        };
      }

      return { reactionPickerRoot: null };
    });
  };

  public handleClickOutsideReactionViewer = (e: MouseEvent): void => {
    const { reactionViewerRoot } = this.state;
    const { current: reactionsContainer } = this.reactionsContainerRef;
    if (reactionViewerRoot && reactionsContainer) {
      if (
        !reactionViewerRoot.contains(e.target as HTMLElement) &&
        !reactionsContainer.contains(e.target as HTMLElement)
      ) {
        this.toggleReactionViewer(true);
      }
    }
  };

  public handleClickOutsideReactionPicker = (e: MouseEvent): void => {
    const { reactionPickerRoot } = this.state;
    if (reactionPickerRoot) {
      if (!reactionPickerRoot.contains(e.target as HTMLElement)) {
        this.toggleReactionPicker(true);
      }
    }
  };

  public renderReactions(outgoing: boolean): JSX.Element | null {
    const { getPreferredBadge, reactions = [], i18n, theme } = this.props;

    if (!this.hasReactions()) {
      return null;
    }

    const reactionsWithEmojiData = reactions.map(reaction => ({
      ...reaction,
      ...emojiToData(reaction.emoji),
    }));

    // Group by emoji and order each group by timestamp descending
    const groupedAndSortedReactions = Object.values(
      groupBy(reactionsWithEmojiData, 'short_name')
    ).map(groupedReactions =>
      orderBy(
        groupedReactions,
        [reaction => reaction.from.isMe, 'timestamp'],
        ['desc', 'desc']
      )
    );
    // Order groups by length and subsequently by most recent reaction
    const ordered = orderBy(
      groupedAndSortedReactions,
      ['length', ([{ timestamp }]) => timestamp],
      ['desc', 'desc']
    );
    // Take the first three groups for rendering
    const toRender = take(ordered, 3).map(res => ({
      emoji: res[0].emoji,
      count: res.length,
      isMe: res.some(re => Boolean(re.from.isMe)),
    }));
    const someNotRendered = ordered.length > 3;
    // We only drop two here because the third emoji would be replaced by the
    // more button
    const maybeNotRendered = drop(ordered, 2);
    const maybeNotRenderedTotal = maybeNotRendered.reduce(
      (sum, res) => sum + res.length,
      0
    );
    const notRenderedIsMe =
      someNotRendered &&
      maybeNotRendered.some(res => res.some(re => Boolean(re.from.isMe)));

    const { reactionViewerRoot } = this.state;

    const popperPlacement = outgoing ? 'bottom-end' : 'bottom-start';

    return (
      <Manager>
        <Reference>
          {({ ref: popperRef }) => (
            <div
              ref={this.reactionsContainerRefMerger(
                this.reactionsContainerRef,
                popperRef
              )}
              className={classNames(
                'module-message__reactions',
                outgoing
                  ? 'module-message__reactions--outgoing'
                  : 'module-message__reactions--incoming'
              )}
            >
              {toRender.map((re, i) => {
                const isLast = i === toRender.length - 1;
                const isMore = isLast && someNotRendered;
                const isMoreWithMe = isMore && notRenderedIsMe;

                return (
                  <button
                    type="button"
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${re.emoji}-${i}`}
                    className={classNames(
                      'module-message__reactions__reaction',
                      re.count > 1
                        ? 'module-message__reactions__reaction--with-count'
                        : null,
                      outgoing
                        ? 'module-message__reactions__reaction--outgoing'
                        : 'module-message__reactions__reaction--incoming',
                      isMoreWithMe || (re.isMe && !isMoreWithMe)
                        ? 'module-message__reactions__reaction--is-me'
                        : null
                    )}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      this.toggleReactionViewer(false);
                    }}
                    onKeyDown={e => {
                      // Prevent enter key from opening stickers/attachments
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                      }
                    }}
                  >
                    {isMore ? (
                      <span
                        className={classNames(
                          'module-message__reactions__reaction__count',
                          'module-message__reactions__reaction__count--no-emoji',
                          isMoreWithMe
                            ? 'module-message__reactions__reaction__count--is-me'
                            : null
                        )}
                      >
                        +{maybeNotRenderedTotal}
                      </span>
                    ) : (
                      <>
                        <Emoji size={16} emoji={re.emoji} />
                        {re.count > 1 ? (
                          <span
                            className={classNames(
                              'module-message__reactions__reaction__count',
                              re.isMe
                                ? 'module-message__reactions__reaction__count--is-me'
                                : null
                            )}
                          >
                            {re.count}
                          </span>
                        ) : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Reference>
        {reactionViewerRoot &&
          createPortal(
            <StopPropagation>
              <Popper
                placement={popperPlacement}
                strategy="fixed"
                modifiers={[this.popperPreventOverflowModifier()]}
              >
                {({ ref, style }) => (
                  <ReactionViewer
                    ref={ref}
                    style={{
                      ...style,
                      zIndex: 2,
                    }}
                    getPreferredBadge={getPreferredBadge}
                    reactions={reactions}
                    i18n={i18n}
                    onClose={this.toggleReactionViewer}
                    theme={theme}
                  />
                )}
              </Popper>
            </StopPropagation>,
            reactionViewerRoot
          )}
      </Manager>
    );
  }

  public renderContents(): JSX.Element | null {
    const { isTapToView, deletedForEveryone } = this.props;

    if (deletedForEveryone) {
      return (
        <>
          {this.renderText()}
          {this.renderMetadata()}
        </>
      );
    }

    if (isTapToView) {
      return (
        <>
          {this.renderTapToView()}
          {this.renderMetadata()}
        </>
      );
    }

    return (
      <>
        {this.renderQuote()}
        {this.renderAttachment()}
        {this.renderPreview()}
        {this.renderEmbeddedContact()}
        {this.renderText()}
        {this.renderMetadata()}
        {this.renderSendMessageButton()}
      </>
    );
  }

  public handleOpen = (
    event: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent
  ): void => {
    const {
      attachments,
      contact,
      displayTapToViewMessage,
      direction,
      id,
      isTapToView,
      isTapToViewExpired,
      kickOffAttachmentDownload,
      openConversation,
      showContactDetail,
      showVisualAttachment,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
    } = this.props;
    const { imageBroken } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    if (isTapToView) {
      if (isAttachmentPending) {
        log.info(
          '<Message> handleOpen: tap-to-view attachment is pending; not showing the lightbox'
        );
        return;
      }

      if (attachments && hasNotDownloaded(attachments[0])) {
        event.preventDefault();
        event.stopPropagation();
        kickOffAttachmentDownload({
          attachment: attachments[0],
          messageId: id,
        });
        return;
      }

      if (isTapToViewExpired) {
        const action =
          direction === 'outgoing'
            ? showExpiredOutgoingTapToViewToast
            : showExpiredIncomingTapToViewToast;
        action();
      } else {
        event.preventDefault();
        event.stopPropagation();

        displayTapToViewMessage(id);
      }

      return;
    }

    if (
      !imageBroken &&
      attachments &&
      attachments.length > 0 &&
      !isAttachmentPending &&
      (isImage(attachments) || isVideo(attachments)) &&
      hasNotDownloaded(attachments[0])
    ) {
      event.preventDefault();
      event.stopPropagation();

      const attachment = attachments[0];

      kickOffAttachmentDownload({ attachment, messageId: id });

      return;
    }

    if (
      !imageBroken &&
      attachments &&
      attachments.length > 0 &&
      !isAttachmentPending &&
      canDisplayImage(attachments) &&
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
    ) {
      event.preventDefault();
      event.stopPropagation();

      const attachment = attachments[0];

      showVisualAttachment({ attachment, messageId: id });

      return;
    }

    if (
      attachments &&
      attachments.length === 1 &&
      !isAttachmentPending &&
      !isAudio(attachments)
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.openGenericAttachment();

      return;
    }

    if (
      !isAttachmentPending &&
      isAudio(attachments) &&
      this.audioButtonRef &&
      this.audioButtonRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.audioButtonRef.current.click();
    }

    if (contact && contact.firstNumber && contact.isNumberOnSignal) {
      openConversation(contact.firstNumber);

      event.preventDefault();
      event.stopPropagation();
    }

    if (contact) {
      showContactDetail({ contact, signalAccount: contact.firstNumber });

      event.preventDefault();
      event.stopPropagation();
    }
  };

  public openGenericAttachment = (event?: React.MouseEvent): void => {
    const {
      id,
      attachments,
      downloadAttachment,
      timestamp,
      kickOffAttachmentDownload,
    } = this.props;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!attachments || attachments.length !== 1) {
      return;
    }

    const attachment = attachments[0];
    if (hasNotDownloaded(attachment)) {
      kickOffAttachmentDownload({
        attachment,
        messageId: id,
      });
      return;
    }

    const { fileName } = attachment;
    const isDangerous = isFileDangerous(fileName || '');

    downloadAttachment({
      isDangerous,
      attachment,
      timestamp,
    });
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    // Do not allow reactions to error messages
    const { canReply } = this.props;

    const key = KeyboardLayout.lookup(event.nativeEvent);

    if (
      (key === 'E' || key === 'e') &&
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      canReply
    ) {
      this.toggleReactionPicker();
    }

    if (event.key !== 'Enter' && event.key !== 'Space') {
      return;
    }

    this.handleOpen(event);
  };

  public handleClick = (event: React.MouseEvent): void => {
    // We don't want clicks on body text to result in the 'default action' for the message
    const { text } = this.props;
    if (text && text.length > 0) {
      return;
    }

    this.handleOpen(event);
  };

  public renderContainer(): JSX.Element {
    const {
      attachments,
      conversationColor,
      customColor,
      deletedForEveryone,
      direction,
      isSticker,
      isTapToView,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;
    const { isSelected } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    const width = this.getWidth();
    const isShowingImage = this.isShowingImage();

    const isEmojiOnly = this.canRenderStickerLikeEmoji();
    const isStickerLike = isSticker || isEmojiOnly;

    const containerClassnames = classNames(
      'module-message__container',
      isGIF(attachments) ? 'module-message__container--gif' : null,
      isSelected && !isStickerLike
        ? 'module-message__container--selected'
        : null,
      isStickerLike ? 'module-message__container--with-sticker' : null,
      !isStickerLike ? `module-message__container--${direction}` : null,
      isEmojiOnly ? 'module-message__container--emoji' : null,
      isTapToView ? 'module-message__container--with-tap-to-view' : null,
      isTapToView && isTapToViewExpired
        ? 'module-message__container--with-tap-to-view-expired'
        : null,
      !isStickerLike && direction === 'outgoing'
        ? `module-message__container--outgoing-${conversationColor}`
        : null,
      isTapToView && isAttachmentPending && !isTapToViewExpired
        ? 'module-message__container--with-tap-to-view-pending'
        : null,
      isTapToView && isAttachmentPending && !isTapToViewExpired
        ? `module-message__container--${direction}-${conversationColor}-tap-to-view-pending`
        : null,
      isTapToViewError
        ? 'module-message__container--with-tap-to-view-error'
        : null,
      this.hasReactions() ? 'module-message__container--with-reactions' : null,
      deletedForEveryone
        ? 'module-message__container--deleted-for-everyone'
        : null
    );
    const containerStyles = {
      width: isShowingImage ? width : undefined,
    };
    if (!isStickerLike && direction === 'outgoing') {
      Object.assign(containerStyles, getCustomColorStyle(customColor));
    }

    return (
      <div className="module-message__container-outer">
        <div
          className={containerClassnames}
          style={containerStyles}
          onContextMenu={this.showContextMenu}
        >
          {this.renderAuthor()}
          {this.renderContents()}
        </div>
        {this.renderReactions(direction === 'outgoing')}
      </div>
    );
  }

  public override render(): JSX.Element | null {
    const { author, attachments, direction, id, isSticker, timestamp } =
      this.props;
    const { expired, expiring, imageBroken, isSelected } = this.state;

    // This id is what connects our triple-dot click with our associated pop-up menu.
    //   It needs to be unique.
    const triggerId = String(id || `${author.id}-${timestamp}`);

    if (expired) {
      return null;
    }

    if (isSticker && (imageBroken || !attachments || !attachments.length)) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          isSelected ? 'module-message--selected' : null,
          expiring ? 'module-message--expired' : null,
          this.hasAvatar() ? 'module-message--with-avatar' : null
        )}
        tabIndex={0}
        // We pretend to be a button because we sometimes contain buttons and a button
        //   cannot be within another button
        role="button"
        onKeyDown={this.handleKeyDown}
        onClick={this.handleClick}
        onFocus={this.handleFocus}
        ref={this.focusRef}
      >
        {this.renderError(direction === 'incoming')}
        {this.renderMenu(direction === 'outgoing', triggerId)}
        {this.renderAvatar()}
        {this.renderContainer()}
        {this.renderError(direction === 'outgoing')}
        {this.renderMenu(direction === 'incoming', triggerId)}
        {this.renderContextMenu(triggerId)}
      </div>
    );
  }
}
