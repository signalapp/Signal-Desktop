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

interface LinkPreviewType {
  title: string;
  domain: string;
  url: string;
  isStickerPack: boolean;
  image?: AttachmentType;
}

export type PropsData = {
  id: string;
  text?: string;
  textPending?: boolean;
  isSticker: boolean;
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
  scrollToMessage: (
    options: {
      author: string;
      sentAt: number;
      referencedMessageNotFound: boolean;
    }
  ) => void;
};

export type Props = PropsData & PropsHousekeeping & PropsActions;

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;
}

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

export class Message extends React.PureComponent<Props, State> {
  public captureMenuTriggerBound: (trigger: any) => void;
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public handleImageErrorBound: () => void;

  public menuTriggerRef: Trigger | undefined;
  public expirationCheckInterval: any;
  public expiredTimeout: any;

  public constructor(props: Props) {
    super(props);

    this.captureMenuTriggerBound = this.captureMenuTrigger.bind(this);
    this.showMenuBound = this.showMenu.bind(this);
    this.handleImageErrorBound = this.handleImageError.bind(this);

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,
    };
  }

  public componentDidMount() {
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
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
    if (this.expiredTimeout) {
      clearTimeout(this.expiredTimeout);
    }
  }

  public componentDidUpdate() {
    this.checkExpired();
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

  public handleImageError() {
    // tslint:disable-next-line no-console
    console.log('Message: Image failed to load; failing over to placeholder');
    this.setState({
      imageBroken: true,
    });
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
        <span className="module-message__metadata__spacer" />
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
            onError={this.handleImageErrorBound}
            onClick={attachment => {
              showVisualAttachment({ attachment, messageId: id });
            }}
          />
        </div>
      );
    } else if (!firstAttachment.pending && isAudio(attachments)) {
      return (
        <audio
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
        <div
          className={classNames(
            'module-message__generic-attachment',
            withContentBelow
              ? 'module-message__generic-attachment--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__generic-attachment--with-content-above'
              : null
          )}
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
        </div>
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
      <div
        role="button"
        className={classNames(
          'module-message__link-preview',
          withContentAbove
            ? 'module-message__link-preview--with-content-above'
            : null
        )}
        onClick={() => {
          openLink(first.url);
        }}
      >
        {first.image && previewHasImage && isFullSizeImage ? (
          <ImageGrid
            attachments={[first.image]}
            withContentAbove={withContentAbove}
            withContentBelow={true}
            onError={this.handleImageErrorBound}
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
                onError={this.handleImageErrorBound}
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
      </div>
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
      scrollToMessage,
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
          scrollToMessage({
            author: quote.authorId,
            sentAt: quote.sentAt,
            referencedMessageNotFound,
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
      />
    );
  }

  public renderSendMessageButton() {
    const { contact, openConversation, i18n } = this.props;
    if (!contact || !contact.signalAccount) {
      return null;
    }

    return (
      <div
        role="button"
        onClick={() => {
          if (contact.signalAccount) {
            openConversation(contact.signalAccount);
          }
        }}
        className="module-message__send-message-button"
      >
        {i18n('sendMessageToContact')}
      </div>
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
          size={36}
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

  public captureMenuTrigger(triggerRef: Trigger) {
    this.menuTriggerRef = triggerRef;
  }
  public showMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  }

  public renderMenu(isCorrectSide: boolean, triggerId: string) {
    const {
      attachments,
      direction,
      disableMenu,
      downloadAttachment,
      id,
      isSticker,
      isTapToView,
      replyToMessage,
      timestamp,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    const fileName =
      attachments && attachments[0] ? attachments[0].fileName : null;
    const isDangerous = isFileDangerous(fileName || '');
    const multipleAttachments = attachments && attachments.length > 1;
    const firstAttachment = attachments && attachments[0];

    const downloadButton =
      !isSticker &&
      !multipleAttachments &&
      !isTapToView &&
      firstAttachment &&
      !firstAttachment.pending ? (
        <div
          onClick={() => {
            downloadAttachment({
              isDangerous,
              attachment: firstAttachment,
              timestamp,
            });
          }}
          role="button"
          className={classNames(
            'module-message__buttons__download',
            `module-message__buttons__download--${direction}`
          )}
        />
      ) : null;

    const replyButton = (
      <div
        onClick={() => {
          replyToMessage(id);
        }}
        role="button"
        className={classNames(
          'module-message__buttons__reply',
          `module-message__buttons__download--${direction}`
        )}
      />
    );

    const menuButton = (
      <ContextMenuTrigger id={triggerId} ref={this.captureMenuTriggerBound}>
        <div
          role="button"
          onClick={this.showMenuBound}
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
      downloadAttachment,
      i18n,
      id,
      isSticker,
      isTapToView,
      replyToMessage,
      retrySend,
      showMessageDetail,
      status,
      timestamp,
    } = this.props;

    const showRetry = status === 'error' && direction === 'outgoing';
    const fileName =
      attachments && attachments[0] ? attachments[0].fileName : null;
    const isDangerous = isFileDangerous(fileName || '');
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
            onClick={() => {
              downloadAttachment({
                attachment: attachments[0],
                timestamp,
                isDangerous,
              });
            }}
          >
            {i18n('downloadAttachment')}
          </MenuItem>
        ) : null}
        <MenuItem
          attributes={{
            className: 'module-message__context__reply',
          }}
          onClick={() => {
            replyToMessage(id);
          }}
        >
          {i18n('replyToMessage')}
        </MenuItem>
        <MenuItem
          attributes={{
            className: 'module-message__context__more-info',
          }}
          onClick={() => {
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
            onClick={() => {
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
          onClick={() => {
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
        // Padding is 8px, on both sides
        return STICKER_SIZE + 8 * 2;
      }

      const dimensions = getGridDimensions(attachments);
      if (dimensions) {
        return dimensions.width;
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
          return dimensions.width;
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
      direction,
      i18n,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;

    const incomingString = isTapToViewExpired
      ? i18n('Message--tap-to-view-expired')
      : i18n('Message--tap-to-view--incoming');
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
  public render() {
    const {
      authorPhoneNumber,
      authorColor,
      attachments,
      direction,
      displayTapToViewMessage,
      id,
      isSticker,
      isTapToView,
      isTapToViewExpired,
      isTapToViewError,
      timestamp,
    } = this.props;
    const { expired, expiring, imageBroken } = this.state;
    const isAttachmentPending = this.isAttachmentPending();
    const isButton = isTapToView && !isTapToViewExpired && !isAttachmentPending;

    // This id is what connects our triple-dot click with our associated pop-up menu.
    //   It needs to be unique.
    const triggerId = String(id || `${authorPhoneNumber}-${timestamp}`);

    if (expired) {
      return null;
    }

    if (isSticker && (imageBroken || !attachments || !attachments.length)) {
      return null;
    }

    const width = this.getWidth();
    const isShowingImage = this.isShowingImage();
    const role = isButton ? 'button' : undefined;
    const onClick = isButton ? () => displayTapToViewMessage(id) : undefined;

    return (
      <div
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          expiring ? 'module-message--expired' : null
        )}
      >
        {this.renderError(direction === 'incoming')}
        {this.renderMenu(direction === 'outgoing', triggerId)}
        <div
          className={classNames(
            'module-message__container',
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
          )}
          style={{
            width: isShowingImage ? width : undefined,
          }}
          role={role}
          onClick={onClick}
        >
          {this.renderAuthor()}
          {this.renderContents()}
          {this.renderAvatar()}
        </div>
        {this.renderError(direction === 'outgoing')}
        {this.renderMenu(direction === 'incoming', triggerId)}
        {this.renderContextMenu(triggerId)}
      </div>
    );
  }
}
