import React from 'react';
import classNames from 'classnames';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';

import { Avatar } from '../Avatar';
import { MessageBody } from './MessageBody';
import { ExpireTimer, getIncrement } from './ExpireTimer';
import { Timestamp } from './Timestamp';
import { ContactName } from './ContactName';
import { Quote, QuotedAttachment } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';

import { isFileDangerous } from '../../util/isFileDangerous';
import { Contact } from '../../types/Contact';
import { Color, Localizer } from '../../types/Util';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';

import * as MIME from '../../../ts/types/MIME';

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

interface Attachment {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage: boolean;
  /** For messages not already on disk, this will be a data url */
  url: string;
  fileSize?: string;
  width: number;
  height: number;
  screenshot?: {
    height: number;
    width: number;
    url: string;
    contentType: MIME.MIMEType;
  };
  thumbnail?: {
    height: number;
    width: number;
    url: string;
    contentType: MIME.MIMEType;
  };
}

export interface Props {
  disableMenu?: boolean;
  text?: string;
  id?: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  // What if changed this over to a single contact like quote, and put the events on it?
  contact?: Contact & {
    hasSignalAccount: boolean;
    onSendMessage?: () => void;
    onClick?: () => void;
  };
  i18n: Localizer;
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber: string;
  authorColor?: Color;
  conversationType: 'group' | 'direct';
  attachment?: Attachment;
  quote?: {
    text: string;
    attachment?: QuotedAttachment;
    isFromMe: boolean;
    authorPhoneNumber: string;
    authorProfileName?: string;
    authorName?: string;
    authorColor?: Color;
    onClick?: () => void;
    referencedMessageNotFound: boolean;
  };
  authorAvatarPath?: string;
  isExpired: boolean;
  expirationLength?: number;
  expirationTimestamp?: number;
  onClickAttachment?: () => void;
  onReply?: () => void;
  onRetrySend?: () => void;
  onDownload?: (isDangerous: boolean) => void;
  onDelete?: () => void;
  onShowDetail: () => void;
}

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;
}

function isImage(attachment?: Attachment) {
  return (
    attachment &&
    attachment.contentType &&
    isImageTypeSupported(attachment.contentType)
  );
}

function hasImage(attachment?: Attachment) {
  return attachment && attachment.url;
}

function isVideo(attachment?: Attachment) {
  return (
    attachment &&
    attachment.contentType &&
    isVideoTypeSupported(attachment.contentType)
  );
}

function hasVideoScreenshot(attachment?: Attachment) {
  return attachment && attachment.screenshot && attachment.screenshot.url;
}

function isAudio(attachment?: Attachment) {
  return (
    attachment && attachment.contentType && MIME.isAudio(attachment.contentType)
  );
}

function canDisplayImage(attachment?: Attachment) {
  const { height, width } = attachment || { height: 0, width: 0 };

  return height > 0 && height <= 4096 && width > 0 && width <= 4096;
}

function getExtension({
  fileName,
  contentType,
}: {
  fileName: string;
  contentType: MIME.MIMEType;
}): string | null {
  if (fileName && fileName.indexOf('.') >= 0) {
    const lastPeriod = fileName.lastIndexOf('.');
    const extension = fileName.slice(lastPeriod + 1);
    if (extension.length) {
      return extension;
    }
  }

  const slash = contentType.indexOf('/');
  if (slash >= 0) {
    return contentType.slice(slash + 1);
  }

  return null;
}

const MINIMUM_IMG_HEIGHT = 150;
const MAXIMUM_IMG_HEIGHT = 300;
const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

export class Message extends React.Component<Props, State> {
  public captureMenuTriggerBound: (trigger: any) => void;
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public handleImageErrorBound: () => void;

  public menuTriggerRef: Trigger | null;
  public expirationCheckInterval: any;
  public expiredTimeout: any;

  public constructor(props: Props) {
    super(props);

    this.captureMenuTriggerBound = this.captureMenuTrigger.bind(this);
    this.showMenuBound = this.showMenu.bind(this);
    this.handleImageErrorBound = this.handleImageError.bind(this);

    this.menuTriggerRef = null;
    this.expirationCheckInterval = null;
    this.expiredTimeout = null;

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
      attachment,
      collapseMetadata,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      status,
      text,
      timestamp,
    } = this.props;
    const { imageBroken } = this.state;

    if (collapseMetadata) {
      return null;
    }

    const canDisplayAttachment = canDisplayImage(attachment);
    const withImageNoCaption = Boolean(
      !text &&
        canDisplayAttachment &&
        !imageBroken &&
        ((isImage(attachment) && hasImage(attachment)) ||
          (isVideo(attachment) && hasVideoScreenshot(attachment)))
    );
    const showError = status === 'error' && direction === 'outgoing';

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
              `module-message__metadata__date--${direction}`,
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
            direction={direction}
            withImageNoCaption={withImageNoCaption}
            module="module-message__metadata__date"
          />
        )}
        {expirationLength && expirationTimestamp ? (
          <ExpireTimer
            direction={direction}
            expirationLength={expirationLength}
            expirationTimestamp={expirationTimestamp}
            withImageNoCaption={withImageNoCaption}
          />
        ) : null}
        <span className="module-message__metadata__spacer" />
        {direction === 'outgoing' && status !== 'error' ? (
          <div
            className={classNames(
              'module-message__metadata__status-icon',
              `module-message__metadata__status-icon--${status}`,
              withImageNoCaption
                ? 'module-message__metadata__status-icon--with-image-no-caption'
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
      conversationType,
      direction,
      i18n,
    } = this.props;

    const title = authorName ? authorName : authorPhoneNumber;

    if (direction !== 'incoming' || conversationType !== 'group' || !title) {
      return null;
    }

    return (
      <div className="module-message__author">
        <ContactName
          phoneNumber={authorPhoneNumber}
          name={authorName}
          profileName={authorProfileName}
          module="module-message__author"
          i18n={i18n}
        />
      </div>
    );
  }

  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  public renderAttachment() {
    const {
      i18n,
      attachment,
      text,
      collapseMetadata,
      conversationType,
      direction,
      quote,
      onClickAttachment,
    } = this.props;
    const { imageBroken } = this.state;

    if (!attachment) {
      return null;
    }

    const withCaption = Boolean(text);
    // For attachments which aren't full-frame
    const withContentBelow = withCaption || !collapseMetadata;
    const withContentAbove =
      quote || (conversationType === 'group' && direction === 'incoming');
    const displayImage = canDisplayImage(attachment);

    if (isImage(attachment) && displayImage && !imageBroken && attachment.url) {
      // Calculating height to prevent reflow when image loads
      const imageHeight = Math.max(MINIMUM_IMG_HEIGHT, attachment.height || 0);

      return (
        <div
          onClick={onClickAttachment}
          role="button"
          className={classNames(
            'module-message__attachment-container',
            withCaption
              ? 'module-message__attachment-container--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__attachment-container--with-content-above'
              : null
          )}
        >
          <img
            onError={this.handleImageErrorBound}
            className="module-message__img-attachment"
            height={Math.min(MAXIMUM_IMG_HEIGHT, imageHeight)}
            src={attachment.url}
            alt={i18n('imageAttachmentAlt')}
          />
          <div
            className={classNames(
              'module-message__img-border-overlay',
              withCaption
                ? 'module-message__img-border-overlay--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__img-border-overlay--with-content-above'
                : null
            )}
          />
          {!withCaption && !collapseMetadata ? (
            <div className="module-message__img-overlay" />
          ) : null}
        </div>
      );
    } else if (
      isVideo(attachment) &&
      displayImage &&
      !imageBroken &&
      attachment.screenshot &&
      attachment.screenshot.url
    ) {
      const { screenshot } = attachment;
      // Calculating height to prevent reflow when image loads
      const imageHeight = Math.max(
        MINIMUM_IMG_HEIGHT,
        attachment.screenshot.height || 0
      );

      return (
        <div
          onClick={onClickAttachment}
          role="button"
          className={classNames(
            'module-message__attachment-container',
            withCaption
              ? 'module-message__attachment-container--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__attachment-container--with-content-above'
              : null
          )}
        >
          <img
            onError={this.handleImageErrorBound}
            className="module-message__img-attachment"
            alt={i18n('videoAttachmentAlt')}
            height={Math.min(MAXIMUM_IMG_HEIGHT, imageHeight)}
            src={screenshot.url}
          />
          <div
            className={classNames(
              'module-message__img-border-overlay',
              withCaption
                ? 'module-message__img-border-overlay--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__img-border-overlay--with-content-above'
                : null
            )}
          />
          {!withCaption && !collapseMetadata ? (
            <div className="module-message__img-overlay" />
          ) : null}
          <div className="module-message__video-overlay__circle">
            <div className="module-message__video-overlay__play-icon" />
          </div>
        </div>
      );
    } else if (isAudio(attachment)) {
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
        >
          <source src={attachment.url} />
        </audio>
      );
    } else {
      const { fileName, fileSize, contentType } = attachment;
      const extension = getExtension({ contentType, fileName });
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

  public renderQuote() {
    const {
      conversationType,
      authorColor,
      direction,
      i18n,
      quote,
    } = this.props;

    if (!quote) {
      return null;
    }

    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';
    const quoteColor =
      direction === 'incoming' ? authorColor : quote.authorColor;

    return (
      <Quote
        i18n={i18n}
        onClick={quote.onClick}
        text={quote.text}
        attachment={quote.attachment}
        isIncoming={direction === 'incoming'}
        authorPhoneNumber={quote.authorPhoneNumber}
        authorProfileName={quote.authorProfileName}
        authorName={quote.authorName}
        authorColor={quoteColor}
        referencedMessageNotFound={quote.referencedMessageNotFound}
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
        hasSignalAccount={contact.hasSignalAccount}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={contact.onClick}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
      />
    );
  }

  public renderSendMessageButton() {
    const { contact, i18n } = this.props;
    if (!contact || !contact.hasSignalAccount) {
      return null;
    }

    return (
      <div
        role="button"
        onClick={contact.onSendMessage}
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
    const { text, i18n, direction, status } = this.props;

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
        <MessageBody text={contents || ''} i18n={i18n} />
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
      attachment,
      direction,
      disableMenu,
      onDownload,
      onReply,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    const fileName = attachment ? attachment.fileName : null;
    const isDangerous = isFileDangerous(fileName || '');

    const downloadButton = attachment ? (
      <div
        onClick={() => {
          if (onDownload) {
            onDownload(isDangerous);
          }
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
        onClick={onReply}
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
      attachment,
      direction,
      status,
      onDelete,
      onDownload,
      onReply,
      onRetrySend,
      onShowDetail,
      i18n,
    } = this.props;

    const showRetry = status === 'error' && direction === 'outgoing';
    const fileName = attachment ? attachment.fileName : null;
    const isDangerous = isFileDangerous(fileName || '');

    return (
      <ContextMenu id={triggerId}>
        {attachment ? (
          <MenuItem
            attributes={{
              className: 'module-message__context__download',
            }}
            onClick={() => {
              if (onDownload) {
                onDownload(isDangerous);
              }
            }}
          >
            {i18n('downloadAttachment')}
          </MenuItem>
        ) : null}
        <MenuItem
          attributes={{
            className: 'module-message__context__reply',
          }}
          onClick={onReply}
        >
          {i18n('replyToMessage')}
        </MenuItem>
        <MenuItem
          attributes={{
            className: 'module-message__context__more-info',
          }}
          onClick={onShowDetail}
        >
          {i18n('moreInfo')}
        </MenuItem>
        {showRetry ? (
          <MenuItem
            attributes={{
              className: 'module-message__context__retry-send',
            }}
            onClick={onRetrySend}
          >
            {i18n('retrySend')}
          </MenuItem>
        ) : null}
        <MenuItem
          attributes={{
            className: 'module-message__context__delete-message',
          }}
          onClick={onDelete}
        >
          {i18n('deleteMessage')}
        </MenuItem>
      </ContextMenu>
    );
  }

  public render() {
    const {
      authorPhoneNumber,
      authorColor,
      direction,
      id,
      timestamp,
    } = this.props;
    const { expired, expiring } = this.state;

    // This id is what connects our triple-dot click with our associated pop-up menu.
    //   It needs to be unique.
    const triggerId = String(id || `${authorPhoneNumber}-${timestamp}`);

    if (expired) {
      return null;
    }

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
            `module-message__container--${direction}`,
            direction === 'incoming'
              ? `module-message__container--incoming-${authorColor}`
              : null
          )}
        >
          {this.renderAuthor()}
          {this.renderQuote()}
          {this.renderAttachment()}
          {this.renderEmbeddedContact()}
          {this.renderText()}
          {this.renderMetadata()}
          {this.renderSendMessageButton()}
          {this.renderAvatar()}
        </div>
        {this.renderError(direction === 'outgoing')}
        {this.renderMenu(direction === 'incoming', triggerId)}
        {this.renderContextMenu(triggerId)}
      </div>
    );
  }
}
