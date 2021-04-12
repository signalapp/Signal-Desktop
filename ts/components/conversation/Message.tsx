// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import classNames from 'classnames';
import { drop, groupBy, orderBy, take } from 'lodash';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';
import { Manager, Popper, Reference } from 'react-popper';

import { Avatar } from '../Avatar';
import { Spinner } from '../Spinner';
import { MessageBody } from './MessageBody';
import { ExpireTimer } from './ExpireTimer';
import { ImageGrid } from './ImageGrid';
import { Image } from './Image';
import { Timestamp } from './Timestamp';
import { ContactName } from './ContactName';
import { Quote, QuotedAttachmentType } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';
import {
  OwnProps as ReactionViewerProps,
  ReactionViewer,
} from './ReactionViewer';
import { Props as ReactionPickerProps } from './ReactionPicker';
import { Emoji } from '../emoji/Emoji';
import { LinkPreviewDate } from './LinkPreviewDate';
import { LinkPreviewType } from '../../types/message/LinkPreviews';
import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage';

import {
  AttachmentType,
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
} from '../../types/Attachment';
import { ContactType } from '../../types/Contact';

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import { BodyRangesType, LocalizerType, ThemeType } from '../../types/Util';
import { ColorType } from '../../types/Colors';
import { createRefMerger } from '../_util';
import { emojiToData } from '../emoji/lib';
import { SmartReactionPicker } from '../../state/smart/ReactionPicker';

type Trigger = {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};

const STICKER_SIZE = 200;
const SELECTED_TIMEOUT = 1000;
const THREE_HOURS = 3 * 60 * 60 * 1000;

export const MessageStatuses = [
  'delivered',
  'error',
  'partial-sent',
  'read',
  'sending',
  'sent',
] as const;
export type MessageStatusType = typeof MessageStatuses[number];

export const InteractionModes = ['mouse', 'keyboard'] as const;
export type InteractionModeType = typeof InteractionModes[number];

export const Directions = ['incoming', 'outgoing'] as const;
export type DirectionType = typeof Directions[number];

export const ConversationTypes = ['direct', 'group'] as const;
export type ConversationTypesType = typeof ConversationTypes[number];

export type AudioAttachmentProps = {
  id: string;
  i18n: LocalizerType;
  buttonRef: React.RefObject<HTMLButtonElement>;
  direction: DirectionType;
  theme: ThemeType | undefined;
  attachment: AttachmentType;
  withContentAbove: boolean;
  withContentBelow: boolean;

  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
};

export type PropsData = {
  id: string;
  conversationId: string;
  text?: string;
  textPending?: boolean;
  isSticker?: boolean;
  isSelected?: boolean;
  isSelectedCounter?: number;
  direction: DirectionType;
  timestamp: number;
  status?: MessageStatusType;
  contact?: ContactType;
  authorId: string;
  authorTitle: string;
  authorName?: string;
  authorProfileName?: string;
  authorPhoneNumber?: string;
  authorColor?: ColorType;
  conversationType: ConversationTypesType;
  attachments?: Array<AttachmentType>;
  quote?: {
    text: string;
    rawAttachment?: QuotedAttachmentType;
    isFromMe: boolean;
    sentAt: number;
    authorId: string;
    authorPhoneNumber?: string;
    authorProfileName?: string;
    authorTitle: string;
    authorName?: string;
    authorColor?: ColorType;
    bodyRanges?: BodyRangesType;
    referencedMessageNotFound: boolean;
  };
  previews: Array<LinkPreviewType>;
  authorAvatarPath?: string;
  isExpired?: boolean;

  isTapToView?: boolean;
  isTapToViewExpired?: boolean;
  isTapToViewError?: boolean;

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
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  theme?: ThemeType;
  disableMenu?: boolean;
  disableScroll?: boolean;
  collapseMetadata?: boolean;
  renderAudioAttachment: (props: AudioAttachmentProps) => JSX.Element;
};

export type PropsActions = {
  clearSelectedMessage: () => unknown;

  reactToMessage: (
    id: string,
    { emoji, remove }: { emoji: string; remove: boolean }
  ) => void;
  replyToMessage: (id: string) => void;
  retrySend: (id: string) => void;
  deleteMessage: (id: string) => void;
  deleteMessageForEveryone: (id: string) => void;
  showMessageDetail: (id: string) => void;

  openConversation: (conversationId: string, messageId?: string) => void;
  showContactDetail: (options: {
    contact: ContactType;
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

  isWide: boolean;

  canDeleteForEveryone: boolean;
};

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

export class Message extends React.PureComponent<Props, State> {
  public menuTriggerRef: Trigger | undefined;

  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  public audioButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  public reactionsContainerRef: React.RefObject<
    HTMLDivElement
  > = React.createRef();

  public reactionsContainerRefMerger = createRefMerger();

  public wideMl: MediaQueryList;

  public expirationCheckInterval: NodeJS.Timeout | undefined;

  public expiredTimeout: NodeJS.Timeout | undefined;

  public selectedTimeout: NodeJS.Timeout | undefined;

  public deleteForEveryoneTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.wideMl = window.matchMedia('(min-width: 926px)');
    this.wideMl.addEventListener('change', this.handleWideMlChange);

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,

      isSelected: props.isSelected,
      prevSelectedCounter: props.isSelectedCounter,

      reactionViewerRoot: null,
      reactionPickerRoot: null,

      isWide: this.wideMl.matches,

      canDeleteForEveryone: props.canDeleteForEveryone,
    };
  }

  public static getDerivedStateFromProps(props: Props, state: State): State {
    const newState = {
      ...state,
      canDeleteForEveryone:
        props.canDeleteForEveryone && state.canDeleteForEveryone,
    };

    if (!props.isSelected) {
      return {
        ...newState,
        isSelected: false,
        prevSelectedCounter: 0,
      };
    }

    if (
      props.isSelected &&
      props.isSelectedCounter !== state.prevSelectedCounter
    ) {
      return {
        ...newState,
        isSelected: props.isSelected,
        prevSelectedCounter: props.isSelectedCounter,
      };
    }

    return newState;
  }

  private hasReactions(): boolean {
    const { reactions } = this.props;
    return Boolean(reactions && reactions.length);
  }

  public handleWideMlChange = (event: MediaQueryListEvent): void => {
    this.setState({ isWide: event.matches });
  };

  public captureMenuTrigger = (triggerRef: Trigger): void => {
    this.menuTriggerRef = triggerRef;
  };

  public showMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  };

  public handleImageError = (): void => {
    const { id } = this.props;
    window.log.info(
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

  public componentDidMount(): void {
    this.startSelectedTimer();
    this.startDeleteForEveryoneTimer();

    const { isSelected } = this.props;
    if (isSelected) {
      this.setFocus();
    }

    const { expirationLength } = this.props;
    if (!expirationLength) {
      return;
    }

    const increment = getIncrement(expirationLength);
    const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);

    this.checkExpired();

    this.expirationCheckInterval = setInterval(() => {
      this.checkExpired();
    }, checkFrequency);
  }

  public componentWillUnmount(): void {
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

    this.wideMl.removeEventListener('change', this.handleWideMlChange);
  }

  public componentDidUpdate(prevProps: Props): void {
    const { canDeleteForEveryone, isSelected } = this.props;

    this.startSelectedTimer();

    if (!prevProps.isSelected && isSelected) {
      this.setFocus();
    }

    this.checkExpired();

    if (canDeleteForEveryone !== prevProps.canDeleteForEveryone) {
      this.startDeleteForEveryoneTimer();
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

  public startDeleteForEveryoneTimer(): void {
    if (this.deleteForEveryoneTimeout) {
      clearTimeout(this.deleteForEveryoneTimeout);
    }

    const { canDeleteForEveryone } = this.props;

    if (!canDeleteForEveryone) {
      return;
    }

    const { timestamp } = this.props;
    const timeToDeletion = timestamp - Date.now() + THREE_HOURS;

    if (timeToDeletion <= 0) {
      this.setState({ canDeleteForEveryone: false });
    } else {
      this.deleteForEveryoneTimeout = setTimeout(() => {
        this.setState({ canDeleteForEveryone: false });
      }, timeToDeletion);
    }
  }

  public checkExpired(): void {
    const now = Date.now();
    const { isExpired, expirationTimestamp, expirationLength } = this.props;

    if (!expirationTimestamp || !expirationLength) {
      return;
    }
    if (this.expiredTimeout) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
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

  public renderTimestamp(): JSX.Element {
    const {
      direction,
      i18n,
      id,
      isSticker,
      isTapToViewExpired,
      showMessageDetail,
      status,
      text,
      timestamp,
    } = this.props;

    const isShowingImage = this.isShowingImage();
    const withImageNoCaption = Boolean(!isSticker && !text && isShowingImage);

    const isError = status === 'error' && direction === 'outgoing';
    const isPartiallySent =
      status === 'partial-sent' && direction === 'outgoing';

    if (isError || isPartiallySent) {
      return (
        <span
          className={classNames({
            'module-message__metadata__date': true,
            'module-message__metadata__date--with-sticker': isSticker,
            [`module-message__metadata__date--${direction}`]: !isSticker,
            'module-message__metadata__date--with-image-no-caption': withImageNoCaption,
          })}
        >
          {isError ? (
            i18n('sendFailed')
          ) : (
            <button
              type="button"
              className="module-message__metadata__tapable"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                showMessageDetail(id);
              }}
            >
              {i18n('partiallySent')}
            </button>
          )}
        </span>
      );
    }

    const metadataDirection = isSticker ? undefined : direction;

    return (
      <Timestamp
        i18n={i18n}
        timestamp={timestamp}
        extended
        direction={metadataDirection}
        withImageNoCaption={withImageNoCaption}
        withSticker={isSticker}
        withTapToViewExpired={isTapToViewExpired}
        module="module-message__metadata__date"
      />
    );
  }

  public renderMetadata(): JSX.Element | null {
    const {
      collapseMetadata,
      direction,
      expirationLength,
      expirationTimestamp,
      isSticker,
      isTapToViewExpired,
      status,
      text,
      textPending,
    } = this.props;

    if (collapseMetadata) {
      return null;
    }

    const isShowingImage = this.isShowingImage();
    const withImageNoCaption = Boolean(!isSticker && !text && isShowingImage);
    const metadataDirection = isSticker ? undefined : direction;

    return (
      <div
        className={classNames(
          'module-message__metadata',
          `module-message__metadata--${direction}`,
          this.hasReactions()
            ? 'module-message__metadata--with-reactions'
            : null,
          withImageNoCaption
            ? 'module-message__metadata--with-image-no-caption'
            : null
        )}
      >
        {this.renderTimestamp()}
        {expirationLength && expirationTimestamp ? (
          <ExpireTimer
            direction={metadataDirection}
            expirationLength={expirationLength}
            expirationTimestamp={expirationTimestamp}
            withImageNoCaption={withImageNoCaption}
            withSticker={isSticker}
            withTapToViewExpired={isTapToViewExpired}
          />
        ) : null}
        {textPending ? (
          <div className="module-message__metadata__spinner-container">
            <Spinner svgSize="small" size="14px" direction={direction} />
          </div>
        ) : null}
        {!textPending &&
        direction === 'outgoing' &&
        status !== 'error' &&
        status !== 'partial-sent' ? (
          <div
            className={classNames(
              'module-message__metadata__status-icon',
              `module-message__metadata__status-icon--${status}`,
              isSticker
                ? 'module-message__metadata__status-icon--with-sticker'
                : null,
              withImageNoCaption
                ? 'module-message__metadata__status-icon--with-image-no-caption'
                : null,
              isTapToViewExpired
                ? 'module-message__metadata__status-icon--with-tap-to-view-expired'
                : null
            )}
          />
        ) : null}
      </div>
    );
  }

  public renderAuthor(): JSX.Element | null {
    const {
      authorTitle,
      authorName,
      authorPhoneNumber,
      authorProfileName,
      collapseMetadata,
      conversationType,
      direction,
      i18n,
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
      !authorTitle
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
          title={authorTitle}
          phoneNumber={authorPhoneNumber}
          name={authorName}
          profileName={authorProfileName}
          module={moduleName}
          i18n={i18n}
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
      i18n,
      id,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      quote,
      showVisualAttachment,
      isSticker,
      text,
      theme,

      renderAudioAttachment,
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

    if (
      displayImage &&
      !imageBroken &&
      (isImage(attachments) || isVideo(attachments))
    ) {
      const prefix = isSticker ? 'sticker' : 'attachment';
      const bottomOverlay = !isSticker && !collapseMetadata;
      // We only want users to tab into this if there's more than one
      const tabIndex = attachments.length > 1 ? 0 : -1;

      return (
        <div
          className={classNames(
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
          )}
        >
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
    if (isAudio(attachments)) {
      return renderAudioAttachment({
        i18n,
        buttonRef: this.audioButtonRef,
        id,
        direction,
        theme,
        attachment: firstAttachment,
        withContentAbove,
        withContentBelow,

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
      }
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
                {first.description}
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
      conversationType,
      authorColor,
      direction,
      disableScroll,
      i18n,
      quote,
      scrollToQuotedMessage,
    } = this.props;

    if (!quote) {
      return null;
    }

    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';
    const quoteColor =
      direction === 'incoming' ? authorColor : quote.authorColor;
    const { referencedMessageNotFound } = quote;

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
        authorPhoneNumber={quote.authorPhoneNumber}
        authorProfileName={quote.authorProfileName}
        authorName={quote.authorName}
        authorColor={quoteColor}
        authorTitle={quote.authorTitle}
        bodyRanges={quote.bodyRanges}
        referencedMessageNotFound={referencedMessageNotFound}
        isFromMe={quote.isFromMe}
        withContentAbove={withContentAbove}
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

    const otherContent = (contact && contact.signalAccount) || withCaption;
    const tabIndex = otherContent ? 0 : -1;

    return (
      <EmbeddedContact
        contact={contact}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={() => {
          showContactDetail({ contact, signalAccount: contact.signalAccount });
        }}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
        tabIndex={tabIndex}
      />
    );
  }

  public renderSendMessageButton(): JSX.Element | null {
    const { contact, openConversation, i18n } = this.props;
    if (!contact || !contact.signalAccount) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => {
          if (contact.signalAccount) {
            openConversation(contact.signalAccount);
          }
        }}
        className="module-message__send-message-button"
      >
        {i18n('sendMessageToContact')}
      </button>
    );
  }

  public renderAvatar(): JSX.Element | undefined {
    const {
      authorAvatarPath,
      authorId,
      authorName,
      authorPhoneNumber,
      authorProfileName,
      authorTitle,
      collapseMetadata,
      authorColor,
      conversationType,
      direction,
      i18n,
      showContactModal,
    } = this.props;

    if (
      collapseMetadata ||
      conversationType !== 'group' ||
      direction === 'outgoing'
    ) {
      return undefined;
    }

    return (
      <div
        className={classNames('module-message__author-avatar-container', {
          'module-message__author-avatar-container--with-reactions': this.hasReactions(),
        })}
      >
        <button
          type="button"
          className="module-message__author-avatar"
          onClick={() => showContactModal(authorId)}
          tabIndex={0}
        >
          <Avatar
            avatarPath={authorAvatarPath}
            color={authorColor}
            conversationType="direct"
            i18n={i18n}
            name={authorName}
            phoneNumber={authorPhoneNumber}
            profileName={authorProfileName}
            title={authorTitle}
            size={28}
          />
        </button>
      </div>
    );
  }

  public renderText(): JSX.Element | null {
    const {
      bodyRanges,
      deletedForEveryone,
      direction,
      i18n,
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
        <MessageBody
          bodyRanges={bodyRanges}
          disableLinks={!this.areLinksEnabled()}
          direction={direction}
          i18n={i18n}
          openConversation={openConversation}
          text={contents || ''}
          textPending={textPending}
        />
      </div>
    );
  }

  public renderError(isCorrectSide: boolean): JSX.Element | null {
    const { status, direction } = this.props;

    if (!isCorrectSide || (status !== 'error' && status !== 'partial-sent')) {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`
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
      replyToMessage,
      selectedReaction,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    const { reactionPickerRoot, isWide } = this.state;

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
          // visible in the page (it is hidden when the page is narrow)
          const maybePopperRef = isWide ? popperRef : undefined;

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
          // Only attach the popper reference to the collapsed menu button if
          // the reaction button is not visible in the page (it is hidden when
          // the page is narrow)
          const maybePopperRef = !isWide ? popperRef : undefined;

          return (
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
          {canReply ? reactButton : null}
          {canDownload ? downloadButton : null}
          {canReply ? replyButton : null}
          {menuButton}
        </div>
        {reactionPickerRoot &&
          createPortal(
            // eslint-disable-next-line consistent-return
            <Popper placement="top">
              {({ ref, style }) => (
                <SmartReactionPicker
                  ref={ref}
                  style={style}
                  selected={selectedReaction}
                  onClose={this.toggleReactionPicker}
                  onPick={emoji => {
                    this.toggleReactionPicker(true);
                    reactToMessage(id, {
                      emoji,
                      remove: emoji === selectedReaction,
                    });
                  }}
                  renderEmojiPicker={renderEmojiPicker}
                />
              )}
            </Popper>,
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
      direction,
      i18n,
      id,
      isSticker,
      isTapToView,
      replyToMessage,
      retrySend,
      showMessageDetail,
      status,
    } = this.props;

    const { canDeleteForEveryone } = this.state;

    const showRetry =
      (status === 'error' || status === 'partial-sent') &&
      direction === 'outgoing';
    const multipleAttachments = attachments && attachments.length > 1;

    const menu = (
      <ContextMenu id={triggerId}>
        {canDownload &&
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
        {canReply ? (
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
        {canDeleteForEveryone ? (
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

  public getWidth(): number | undefined {
    const { attachments, isSticker, previews } = this.props;

    if (attachments && attachments.length) {
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

  // Messy return here.
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public isShowingImage() {
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

    // eslint-disable-next-line consistent-return, no-nested-ternary
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
    const { reactions = [], i18n } = this.props;

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
            <Popper placement={popperPlacement}>
              {({ ref, style }) => (
                <ReactionViewer
                  ref={ref}
                  style={{
                    ...style,
                    zIndex: 2,
                  }}
                  reactions={reactions}
                  i18n={i18n}
                  onClose={this.toggleReactionViewer}
                />
              )}
            </Popper>,
            reactionViewerRoot
          )}
      </Manager>
    );
  }

  public renderContents(): JSX.Element | null {
    const { isTapToView, deletedForEveryone } = this.props;

    if (deletedForEveryone) {
      return this.renderText();
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

    if (contact && contact.signalAccount) {
      openConversation(contact.signalAccount);

      event.preventDefault();
      event.stopPropagation();
    }

    if (contact) {
      showContactDetail({ contact, signalAccount: contact.signalAccount });

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

    if (
      (event.key === 'E' || event.key === 'e') &&
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

    // If there an incomplete attachment, do not execute the default action
    const { attachments } = this.props;
    if (attachments && attachments.length > 0) {
      const [firstAttachment] = attachments;
      if (!firstAttachment.url) {
        return;
      }
    }

    this.handleOpen(event);
  };

  public renderContainer(): JSX.Element {
    const {
      authorColor,
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

    const containerClassnames = classNames(
      'module-message__container',
      isSelected && !isSticker ? 'module-message__container--selected' : null,
      isSticker ? 'module-message__container--with-sticker' : null,
      !isSticker ? `module-message__container--${direction}` : null,
      isTapToView ? 'module-message__container--with-tap-to-view' : null,
      isTapToView && isTapToViewExpired
        ? 'module-message__container--with-tap-to-view-expired'
        : null,
      !isSticker && direction === 'incoming'
        ? `module-message__container--incoming-${authorColor}`
        : null,
      isTapToView && isAttachmentPending && !isTapToViewExpired
        ? 'module-message__container--with-tap-to-view-pending'
        : null,
      isTapToView && isAttachmentPending && !isTapToViewExpired
        ? `module-message__container--${direction}-${authorColor}-tap-to-view-pending`
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

    return (
      <div className="module-message__container-outer">
        <div className={containerClassnames} style={containerStyles}>
          {this.renderAuthor()}
          {this.renderContents()}
        </div>
        {this.renderReactions(direction === 'outgoing')}
      </div>
    );
  }

  public render(): JSX.Element | null {
    const {
      authorId,
      attachments,
      direction,
      id,
      isSticker,
      timestamp,
    } = this.props;
    const { expired, expiring, imageBroken, isSelected } = this.state;

    // This id is what connects our triple-dot click with our associated pop-up menu.
    //   It needs to be unique.
    const triggerId = String(id || `${authorId}-${timestamp}`);

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
          expiring ? 'module-message--expired' : null
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
