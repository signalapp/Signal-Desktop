import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

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
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  getImageDimensions,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isImageAttachment,
  isVideo,
} from '../../../ts/types/Attachment';
import { AttachmentType } from '../../types/Attachment';
import { ContactType } from '../../types/Contact';

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import { ColorType, LocalizerType } from '../../types/Util';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

// Same as MIN_WIDTH in ImageGrid.tsx
const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;
const STICKER_SIZE = 128;
const SELECTED_TIMEOUT = 1000;

interface LinkPreviewType {
  title: string;
  domain: string;
  url: string;
  isStickerPack: boolean;
  image?: AttachmentType;
}

export type PropsData = {
  id: string;
  conversationId: string;
  text?: string;
  textPending?: boolean;
  isSticker: boolean;
  isSelected: boolean;
  isSelectedCounter: number;
  interactionMode: 'mouse' | 'keyboard';
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  contact?: ContactType;
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber: string;
  authorColor?: ColorType;
  conversationType: 'group' | 'direct';
  attachments?: Array<AttachmentType>;
  quote?: {
    text: string;
    attachment?: QuotedAttachmentType;
    isFromMe: boolean;
    sentAt: number;
    authorId: string;
    authorPhoneNumber: string;
    authorProfileName?: string;
    authorName?: string;
    authorColor?: ColorType;
    referencedMessageNotFound: boolean;
  };
  previews: Array<LinkPreviewType>;
  authorAvatarPath?: string;
  isExpired: boolean;

  isTapToView?: boolean;
  isTapToViewExpired?: boolean;
  isTapToViewError?: boolean;

  expirationLength?: number;
  expirationTimestamp?: number;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  disableMenu?: boolean;
  disableScroll?: boolean;
  collapseMetadata?: boolean;
};

export type PropsActions = {
  clearSelectedMessage: () => unknown;

  replyToMessage: (id: string) => void;
  retrySend: (id: string) => void;
  deleteMessage: (id: string) => void;
  showMessageDetail: (id: string) => void;

  openConversation: (conversationId: string, messageId?: string) => void;
  showContactDetail: (
    options: { contact: ContactType; signalAccount?: string }
  ) => void;

  showVisualAttachment: (
    options: { attachment: AttachmentType; messageId: string }
  ) => void;
  downloadAttachment: (
    options: {
      attachment: AttachmentType;
      timestamp: number;
      isDangerous: boolean;
    }
  ) => void;
  displayTapToViewMessage: (messageId: string) => unknown;

  openLink: (url: string) => void;
  scrollToQuotedMessage: (
    options: {
      author: string;
      sentAt: number;
    }
  ) => void;
  selectMessage?: (messageId: string, conversationId: string) => unknown;
};

export type Props = PropsData & PropsHousekeeping & PropsActions;

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  isSelected: boolean;
  prevSelectedCounter: number;
}

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

export class Message extends React.PureComponent<Props, State> {
  public menuTriggerRef: Trigger | undefined;
  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();
  public audioRef: React.RefObject<HTMLAudioElement> = React.createRef();

  public expirationCheckInterval: any;
  public expiredTimeout: any;
  public selectedTimeout: any;

  public constructor(props: Props) {
    super(props);

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,

      isSelected: props.isSelected,
      prevSelectedCounter: props.isSelectedCounter,
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

  public captureMenuTrigger = (triggerRef: Trigger) => {
    this.menuTriggerRef = triggerRef;
  };

  public showMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  };

  public handleImageError = () => {
    const { id } = this.props;
    // tslint:disable-next-line no-console
    console.log(
      `Message ${id}: Image failed to load; failing over to placeholder`
    );
    this.setState({
      imageBroken: true,
    });
  };

  public handleFocus = () => {
    const { interactionMode } = this.props;

    if (interactionMode === 'keyboard') {
      this.setSelected();
    }
  };

  public setSelected = () => {
    const { id, conversationId, selectMessage } = this.props;

    if (selectMessage) {
      selectMessage(id, conversationId);
    }
  };

  public setFocus = () => {
    const container = this.focusRef.current;

    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }
  };

  public componentDidMount() {
    this.startSelectedTimer();

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

  public componentWillUnmount() {
    if (this.selectedTimeout) {
      clearInterval(this.selectedTimeout);
    }
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
    if (this.expiredTimeout) {
      clearTimeout(this.expiredTimeout);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    this.startSelectedTimer();

    if (!prevProps.isSelected && this.props.isSelected) {
      this.setFocus();
    }

    this.checkExpired();
  }

  public startSelectedTimer() {
    const { interactionMode } = this.props;
    const { isSelected } = this.state;

    if (interactionMode === 'keyboard' || !isSelected) {
      return;
    }

    if (!this.selectedTimeout) {
      this.selectedTimeout = setTimeout(() => {
        this.selectedTimeout = undefined;
        this.setState({ isSelected: false });
        this.props.clearSelectedMessage();
      }, SELECTED_TIMEOUT);
    }
  }

  public checkExpired() {
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

  public renderMetadata() {
    const {
      collapseMetadata,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      isSticker,
      isTapToViewExpired,
      status,
      text,
      textPending,
      timestamp,
    } = this.props;

    if (collapseMetadata) {
      return null;
    }

    const isShowingImage = this.isShowingImage();
    const withImageNoCaption = Boolean(!isSticker && !text && isShowingImage);
    const showError = status === 'error' && direction === 'outgoing';
    const metadataDirection = isSticker ? undefined : direction;

    return (
      <div
        className={classNames(
          'module-message__metadata',
          withImageNoCaption
            ? 'module-message__metadata--with-image-no-caption'
            : null
        )}
      >
        <span className="module-message__metadata__spacer" />
        {showError ? (
          <span
            className={classNames(
              'module-message__metadata__date',
              isSticker ? 'module-message__metadata__date--with-sticker' : null,
              !isSticker
                ? `module-message__metadata__date--${direction}`
                : null,
              withImageNoCaption
                ? 'module-message__metadata__date--with-image-no-caption'
                : null
            )}
          >
            {i18n('sendFailed')}
          </span>
        ) : (
          <Timestamp
            i18n={i18n}
            timestamp={timestamp}
            extended={true}
            direction={metadataDirection}
            withImageNoCaption={withImageNoCaption}
            withSticker={isSticker}
            withTapToViewExpired={isTapToViewExpired}
            module="module-message__metadata__date"
          />
        )}
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
        {!textPending && direction === 'outgoing' && status !== 'error' ? (
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

  public renderAuthor() {
    const {
      authorName,
      authorPhoneNumber,
      authorProfileName,
      collapseMetadata,
      conversationType,
      direction,
      isSticker,
      isTapToView,
      isTapToViewExpired,
    } = this.props;

    if (collapseMetadata) {
      return;
    }

    const title = authorName ? authorName : authorPhoneNumber;

    if (direction !== 'incoming' || conversationType !== 'group' || !title) {
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
          phoneNumber={authorPhoneNumber}
          name={authorName}
          profileName={authorProfileName}
          module={moduleName}
        />
      </div>
    );
  }

  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  public renderAttachment() {
    const {
      attachments,
      collapseMetadata,
      conversationType,
      direction,
      i18n,
      id,
      quote,
      showVisualAttachment,
      isSticker,
      text,
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
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
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
            onError={this.handleImageError}
            tabIndex={tabIndex}
            onClick={attachment => {
              showVisualAttachment({ attachment, messageId: id });
            }}
          />
        </div>
      );
    } else if (!firstAttachment.pending && isAudio(attachments)) {
      return (
        <audio
          ref={this.audioRef}
          controls={true}
          className={classNames(
            'module-message__audio-attachment',
            withContentBelow
              ? 'module-message__audio-attachment--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__audio-attachment--with-content-above'
              : null
          )}
          key={firstAttachment.url}
        >
          <source src={firstAttachment.url} />
        </audio>
      );
    } else {
      const { pending, fileName, fileSize, contentType } = firstAttachment;
      const extension = getExtensionForDisplay({ contentType, fileName });
      const isDangerous = isFileDangerous(fileName || '');

      return (
        <button
          className={classNames(
            'module-message__generic-attachment',
            withContentBelow
              ? 'module-message__generic-attachment--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__generic-attachment--with-content-above'
              : null
          )}
          // There's only ever one of these, so we don't want users to tab into it
          tabIndex={-1}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            this.openGenericAttachment();
          }}
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
  }

  // tslint:disable-next-line cyclomatic-complexity max-func-body-length
  public renderPreview() {
    const {
      attachments,
      conversationType,
      direction,
      i18n,
      openLink,
      previews,
      quote,
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

    const previewHasImage = first.image && isImageAttachment(first.image);
    const width = first.image && first.image.width;
    const isFullSizeImage =
      !first.isStickerPack &&
      width &&
      width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH;

    return (
      <button
        className={classNames(
          'module-message__link-preview',
          `module-message__link-preview--${direction}`,
          withContentAbove
            ? 'module-message__link-preview--with-content-above'
            : null
        )}
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
        {first.image && previewHasImage && isFullSizeImage ? (
          <ImageGrid
            attachments={[first.image]}
            withContentAbove={withContentAbove}
            withContentBelow={true}
            onError={this.handleImageError}
            i18n={i18n}
          />
        ) : null}
        <div
          className={classNames(
            'module-message__link-preview__content',
            withContentAbove || isFullSizeImage
              ? 'module-message__link-preview__content--with-content-above'
              : null
          )}
        >
          {first.image && previewHasImage && !isFullSizeImage ? (
            <div className="module-message__link-preview__icon_container">
              <Image
                smallCurveTopLeft={!withContentAbove}
                noBorder={true}
                noBackground={true}
                softCorners={true}
                alt={i18n('previewThumbnail', [first.domain])}
                height={72}
                width={72}
                url={first.image.url}
                attachment={first.image}
                onError={this.handleImageError}
                i18n={i18n}
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
            <div className="module-message__link-preview__location">
              {first.domain}
            </div>
          </div>
        </div>
      </button>
    );
  }

  public renderQuote() {
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
            author: quote.authorId,
            sentAt: quote.sentAt,
          });
        };

    return (
      <Quote
        i18n={i18n}
        onClick={clickHandler}
        text={quote.text}
        attachment={quote.attachment}
        isIncoming={direction === 'incoming'}
        authorPhoneNumber={quote.authorPhoneNumber}
        authorProfileName={quote.authorProfileName}
        authorName={quote.authorName}
        authorColor={quoteColor}
        referencedMessageNotFound={referencedMessageNotFound}
        isFromMe={quote.isFromMe}
        withContentAbove={withContentAbove}
      />
    );
  }

  public renderEmbeddedContact() {
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

  public renderSendMessageButton() {
    const { contact, openConversation, i18n } = this.props;
    if (!contact || !contact.signalAccount) {
      return null;
    }

    return (
      <button
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

  public renderAvatar() {
    const {
      authorAvatarPath,
      authorName,
      authorPhoneNumber,
      authorProfileName,
      collapseMetadata,
      authorColor,
      conversationType,
      direction,
      i18n,
    } = this.props;

    if (
      collapseMetadata ||
      conversationType !== 'group' ||
      direction === 'outgoing'
    ) {
      return;
    }

    return (
      <div className="module-message__author-avatar">
        <Avatar
          avatarPath={authorAvatarPath}
          color={authorColor}
          conversationType="direct"
          i18n={i18n}
          name={authorName}
          phoneNumber={authorPhoneNumber}
          profileName={authorProfileName}
          size={28}
        />
      </div>
    );
  }

  public renderText() {
    const { text, textPending, i18n, direction, status } = this.props;

    const contents =
      direction === 'incoming' && status === 'error'
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
          text={contents || ''}
          i18n={i18n}
          textPending={textPending}
        />
      </div>
    );
  }

  public renderError(isCorrectSide: boolean) {
    const { status, direction } = this.props;

    if (!isCorrectSide || status !== 'error') {
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

  public renderMenu(isCorrectSide: boolean, triggerId: string) {
    const {
      attachments,
      direction,
      disableMenu,
      id,
      isSticker,
      isTapToView,
      replyToMessage,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    const multipleAttachments = attachments && attachments.length > 1;
    const firstAttachment = attachments && attachments[0];

    const downloadButton =
      !isSticker &&
      !multipleAttachments &&
      !isTapToView &&
      firstAttachment &&
      !firstAttachment.pending ? (
        <div
          onClick={this.openGenericAttachment}
          // This a menu meant for mouse use only
          role="button"
          className={classNames(
            'module-message__buttons__download',
            `module-message__buttons__download--${direction}`
          )}
        />
      ) : null;

    const replyButton = (
      <div
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          replyToMessage(id);
        }}
        // This a menu meant for mouse use only
        role="button"
        className={classNames(
          'module-message__buttons__reply',
          `module-message__buttons__download--${direction}`
        )}
      />
    );

    const menuButton = (
      <ContextMenuTrigger id={triggerId} ref={this.captureMenuTrigger as any}>
        <div
          // This a menu meant for mouse use only
          role="button"
          onClick={this.showMenu}
          className={classNames(
            'module-message__buttons__menu',
            `module-message__buttons__download--${direction}`
          )}
        />
      </ContextMenuTrigger>
    );

    const first = direction === 'incoming' ? downloadButton : menuButton;
    const last = direction === 'incoming' ? menuButton : downloadButton;

    return (
      <div
        className={classNames(
          'module-message__buttons',
          `module-message__buttons--${direction}`
        )}
      >
        {first}
        {replyButton}
        {last}
      </div>
    );
  }

  public renderContextMenu(triggerId: string) {
    const {
      attachments,
      deleteMessage,
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

    const showRetry = status === 'error' && direction === 'outgoing';
    const multipleAttachments = attachments && attachments.length > 1;

    const menu = (
      <ContextMenu id={triggerId}>
        {!isSticker &&
        !multipleAttachments &&
        !isTapToView &&
        attachments &&
        attachments[0] ? (
          <MenuItem
            attributes={{
              className: 'module-message__context__download',
            }}
            onClick={this.openGenericAttachment}
          >
            {i18n('downloadAttachment')}
          </MenuItem>
        ) : null}
        <MenuItem
          attributes={{
            className: 'module-message__context__reply',
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
            className: 'module-message__context__more-info',
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
              className: 'module-message__context__retry-send',
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
            className: 'module-message__context__delete-message',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            deleteMessage(id);
          }}
        >
          {i18n('deleteMessage')}
        </MenuItem>
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

    if (previews && previews.length) {
      const first = previews[0];

      if (!first || !first.image) {
        return;
      }
      const { width } = first.image;

      if (
        !first.isStickerPack &&
        isImageAttachment(first.image) &&
        width &&
        width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH
      ) {
        const dimensions = getImageDimensions(first.image);
        if (dimensions) {
          // Add two for 1px border
          return dimensions.width + 2;
        }
      }
    }

    return;
  }

  public isShowingImage() {
    const { isTapToView, attachments, previews } = this.props;
    const { imageBroken } = this.state;

    if (imageBroken || isTapToView) {
      return false;
    }

    if (attachments && attachments.length) {
      const displayImage = canDisplayImage(attachments);

      return (
        displayImage &&
        ((isImage(attachments) && hasImage(attachments)) ||
          (isVideo(attachments) && hasVideoScreenshot(attachments)))
      );
    }

    if (previews && previews.length) {
      const first = previews[0];
      const { image } = first;

      if (!image) {
        return false;
      }

      return isImageAttachment(image);
    }

    return false;
  }

  public isAttachmentPending() {
    const { attachments } = this.props;

    if (!attachments || attachments.length < 1) {
      return false;
    }

    const first = attachments[0];

    return Boolean(first.pending);
  }

  public renderTapToViewIcon() {
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

  public renderTapToViewText() {
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

    return isTapToViewError
      ? i18n('incomingError')
      : direction === 'outgoing'
        ? outgoingString
        : incomingString;
  }

  public renderTapToView() {
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

  public renderContents() {
    const { isTapToView } = this.props;

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

  // tslint:disable-next-line cyclomatic-complexity
  public handleOpen = (
    event: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent
  ) => {
    const {
      attachments,
      contact,
      displayTapToViewMessage,
      id,
      isTapToView,
      isTapToViewExpired,
      openConversation,
      showContactDetail,
      showVisualAttachment,
    } = this.props;
    const { imageBroken } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    if (isTapToView) {
      if (!isTapToViewExpired && !isAttachmentPending) {
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
      this.audioRef &&
      this.audioRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      if (this.audioRef.current.paused) {
        // tslint:disable-next-line no-floating-promises
        this.audioRef.current.play();
      } else {
        // tslint:disable-next-line no-floating-promises
        this.audioRef.current.pause();
      }
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

  public openGenericAttachment = (event?: React.MouseEvent) => {
    const { attachments, downloadAttachment, timestamp } = this.props;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!attachments || attachments.length !== 1) {
      return;
    }

    const attachment = attachments[0];
    const { fileName } = attachment;
    const isDangerous = isFileDangerous(fileName || '');

    downloadAttachment({
      isDangerous,
      attachment,
      timestamp,
    });
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Space') {
      return;
    }

    this.handleOpen(event);
  };

  public handleClick = (event: React.MouseEvent) => {
    // We don't want clicks on body text to result in the 'default action' for the message
    const { text } = this.props;
    if (text && text.length > 0) {
      return;
    }

    this.handleOpen(event);
  };

  public renderContainer() {
    const {
      authorColor,
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
        : null
    );
    const containerStyles = {
      width: isShowingImage ? width : undefined,
    };

    return (
      <div className={containerClassnames} style={containerStyles}>
        {this.renderAuthor()}
        {this.renderContents()}
        {this.renderAvatar()}
      </div>
    );
  }

  // tslint:disable-next-line cyclomatic-complexity
  public render() {
    const {
      authorPhoneNumber,
      attachments,
      conversationType,
      direction,
      id,
      isSticker,
      timestamp,
    } = this.props;
    const { expired, expiring, imageBroken, isSelected } = this.state;

    // This id is what connects our triple-dot click with our associated pop-up menu.
    //   It needs to be unique.
    const triggerId = String(id || `${authorPhoneNumber}-${timestamp}`);

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
          conversationType === 'group' ? 'module-message--group' : null
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
        {this.renderContainer()}
        {this.renderError(direction === 'outgoing')}
        {this.renderMenu(direction === 'incoming', triggerId)}
        {this.renderContextMenu(triggerId)}
      </div>
    );
  }
}
