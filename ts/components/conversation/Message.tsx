import React from 'react';
import classNames from 'classnames';
import moment from 'moment';
import { padStart } from 'lodash';

import { formatRelativeTime } from '../../util/formatRelativeTime';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';

import { MessageBody } from './MessageBody';
import { Emojify } from './Emojify';
import { Quote, QuotedAttachment } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';

import { Contact } from '../../types/Contact';
import { Localizer } from '../../types/Util';
import * as MIME from '../../../ts/types/MIME';

interface Attachment {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage: boolean;
  /** For messages not already on disk, this will be a data url */
  url: string;
  fileSize?: string;
}

interface Props {
  text?: string;
  id?: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  contacts?: Array<Contact>;
  color:
    | 'gray'
    | 'blue'
    | 'cyan'
    | 'deep-orange'
    | 'green'
    | 'indigo'
    | 'pink'
    | 'purple'
    | 'red'
    | 'teal';
  i18n: Localizer;
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber?: string;
  conversationType: 'group' | 'direct';
  attachment?: Attachment;
  quote?: {
    text: string;
    attachments: Array<QuotedAttachment>;
    isFromMe: boolean;
    authorName?: string;
    authorPhoneNumber?: string;
    authorProfileName?: string;
  };
  authorAvatarPath?: string;
  contactHasSignalAccount: boolean;
  expirationLength?: number;
  expirationTimestamp?: number;
  onClickQuote?: () => void;
  onSendMessageToContact?: () => void;
  onClickContact?: () => void;
  onClickAttachment?: () => void;
}

function isImage(attachment?: Attachment) {
  return (
    attachment &&
    attachment.contentType &&
    isImageTypeSupported(attachment.contentType)
  );
}

function isVideo(attachment?: Attachment) {
  return (
    attachment &&
    attachment.contentType &&
    isVideoTypeSupported(attachment.contentType)
  );
}

function isAudio(attachment?: Attachment) {
  return (
    attachment && attachment.contentType && MIME.isAudio(attachment.contentType)
  );
}

function getTimerBucket(expiration: number, length: number): string {
  const delta = expiration - Date.now();
  if (delta < 0) {
    return '00';
  }
  if (delta > length) {
    return '60';
  }

  const increment = Math.round(delta / length * 12);

  return padStart(String(increment * 5), 2, '0');
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

export class Message extends React.Component<Props> {
  public renderTimer() {
    const {
      attachment,
      direction,
      expirationLength,
      expirationTimestamp,
      text,
    } = this.props;

    if (!expirationLength || !expirationTimestamp) {
      return null;
    }

    const withImageNoCaption = !text && isImage(attachment);
    const bucket = getTimerBucket(expirationTimestamp, expirationLength);

    return (
      <div
        className={classNames(
          'module-message__metadata__timer',
          `module-message__metadata__timer--${bucket}`,
          `module-message__metadata__timer--${direction}`,
          withImageNoCaption
            ? 'module-message__metadata__timer--with-image-no-caption'
            : null
        )}
      />
    );
  }

  public renderMetadata() {
    const {
      collapseMetadata,
      color,
      direction,
      i18n,
      status,
      timestamp,
      text,
      attachment,
    } = this.props;

    if (collapseMetadata) {
      return null;
    }
    // We're not showing metadata on top of videos since they still have native controls
    if (!text && isVideo(attachment)) {
      return null;
    }

    const withImageNoCaption = !text && isImage(attachment);

    return (
      <div
        className={classNames(
          'module-message__metadata',
          withImageNoCaption
            ? 'module-message__metadata--with-image-no-caption'
            : null
        )}
      >
        <span
          className={classNames(
            'module-message__metadata__date',
            `module-message__metadata__date--${direction}`,
            withImageNoCaption
              ? 'module-message__metadata__date--with-image-no-caption'
              : null
          )}
          title={moment(timestamp).format('llll')}
        >
          {formatRelativeTime(timestamp, { i18n, extended: true })}
        </span>
        {this.renderTimer()}
        <span className="module-message__metadata__spacer" />
        {direction === 'outgoing' ? (
          <div
            className={classNames(
              'module-message__metadata__status-icon',
              `module-message__metadata__status-icon-${status}`,
              status === 'read'
                ? `module-message__metadata__status-icon-${color}`
                : null,
              withImageNoCaption
                ? 'module-message__metadata__status-icon--with-image-no-caption'
                : null,
              withImageNoCaption && status === 'read'
                ? 'module-message__metadata__status-icon--read-with-image-no-caption'
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
      conversationType,
      direction,
      i18n,
      authorPhoneNumber,
      authorProfileName,
    } = this.props;

    const title = authorName ? authorName : authorPhoneNumber;

    if (direction !== 'incoming' || conversationType !== 'group' || !title) {
      return null;
    }

    const profileElement =
      authorProfileName && !authorName ? (
        <span className="module-message__author__profile-name">
          ~<Emojify text={authorProfileName} i18n={i18n} />
        </span>
      ) : null;

    return (
      <div className="module-message__author">
        <Emojify text={title} i18n={i18n} /> {profileElement}
      </div>
    );
  }

  // tslint:disable-next-line max-func-body-length
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

    if (!attachment) {
      return null;
    }

    const withCaption = Boolean(text);
    // For attachments which aren't full-frame
    const withContentBelow = withCaption || !collapseMetadata;
    const withContentAbove =
      quote || (conversationType === 'group' && direction === 'incoming');

    if (isImage(attachment)) {
      return (
        <div className="module-message__attachment-container">
          <img
            className={classNames(
              'module-message__img-attachment',
              withCaption
                ? 'module-message__img-attachment--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__img-attachment--with-content-above'
                : null
            )}
            src={attachment.url}
            alt={i18n('imageAttachmentAlt')}
            onClick={onClickAttachment}
          />
          {!withCaption && !collapseMetadata ? (
            <div className="module-message__img-overlay" />
          ) : null}
        </div>
      );
    } else if (isVideo(attachment)) {
      return (
        <video
          controls={true}
          className={classNames(
            'module-message__img-attachment',
            withCaption
              ? 'module-message__img-attachment--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__img-attachment--with-content-above'
              : null
          )}
        >
          <source src={attachment.url} />
        </video>
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
          <div className="module-message__generic-attachment__icon">
            {extension ? (
              <div className="module-message__generic-attachment__icon__extension">
                {extension}
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
      color,
      conversationType,
      direction,
      i18n,
      onClickQuote,
      quote,
    } = this.props;

    if (!quote) {
      return null;
    }

    const authorTitle = quote.authorName
      ? quote.authorName
      : quote.authorPhoneNumber;
    const authorProfileName = !quote.authorName
      ? quote.authorProfileName
      : undefined;
    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';

    return (
      <Quote
        i18n={i18n}
        onClick={onClickQuote}
        color={color}
        text={quote.text}
        attachments={quote.attachments}
        isIncoming={direction === 'incoming'}
        authorTitle={authorTitle || ''}
        authorProfileName={authorProfileName}
        isFromMe={quote.isFromMe}
        withContentAbove={withContentAbove}
      />
    );
  }

  public renderEmbeddedContact() {
    const {
      collapseMetadata,
      contactHasSignalAccount,
      contacts,
      conversationType,
      direction,
      i18n,
      onClickContact,
      onSendMessageToContact,
      text,
    } = this.props;
    const first = contacts && contacts[0];

    if (!first) {
      return null;
    }

    const withCaption = Boolean(text);
    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';
    const withContentBelow = withCaption || !collapseMetadata;

    return (
      <EmbeddedContact
        contact={first}
        hasSignalAccount={contactHasSignalAccount}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onSendMessage={onSendMessageToContact}
        onClickContact={onClickContact}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
      />
    );
  }

  public renderSendMessageButton() {
    const {
      contactHasSignalAccount,
      contacts,
      i18n,
      onSendMessageToContact,
    } = this.props;
    const first = contacts && contacts[0];

    if (!first || !contactHasSignalAccount) {
      return null;
    }

    return (
      <div
        role="button"
        onClick={onSendMessageToContact}
        className="module-message__send-message-button"
      >
        {i18n('sendMessageToContact')}
      </div>
    );
  }

  public renderAvatar() {
    const {
      authorName,
      authorPhoneNumber,
      authorProfileName,
      authorAvatarPath,
      collapseMetadata,
      color,
      conversationType,
      direction,
      i18n,
    } = this.props;

    const title = `${authorName || authorPhoneNumber}${
      !authorName && authorProfileName ? ` ~${authorProfileName}` : ''
    }`;

    if (
      collapseMetadata ||
      conversationType !== 'group' ||
      direction === 'outgoing'
    ) {
      return;
    }

    if (!authorAvatarPath) {
      return (
        <div
          className={classNames(
            'module-message__author-default-avatar',
            `module-message__author-default-avatar--${color}`
          )}
        >
          <div className="module-message__author-default-avatar__label">#</div>
        </div>
      );
    }

    return (
      <div className="module-message__author-avatar">
        <img alt={i18n('contactAvatarAlt', [title])} src={authorAvatarPath} />
      </div>
    );
  }

  public renderText() {
    const { text, i18n, direction } = this.props;

    if (!text) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`
        )}
      >
        <MessageBody text={text || ''} i18n={i18n} />
      </div>
    );
  }

  public render() {
    const {
      attachment,
      color,
      conversationType,
      direction,
      id,
      quote,
      text,
    } = this.props;

    const imageAndNothingElse =
      !text && isImage(attachment) && conversationType !== 'group' && !quote;

    return (
      <li>
        <div
          id={id}
          className={classNames(
            'module-message',
            `module-message--${direction}`,
            imageAndNothingElse ? 'module-message--with-image-only' : null,
            direction === 'incoming'
              ? `module-message--incoming-${color}`
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
      </li>
    );
  }
}
