import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from '../Avatar';
import { Spinner } from '../basic/Spinner';
import { MessageBody } from './MessageBody';
import { ImageGrid } from './ImageGrid';
import { Image } from './Image';
import { ContactName } from './ContactName';
import { Quote } from './Quote';

import {
  AttachmentType,
  AttachmentTypeWithPath,
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

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import _ from 'lodash';
import { contextMenu } from 'react-contexify';
import uuid from 'uuid';
import { PubKey } from '../../session/types';
import { MessageRenderingProps } from '../../models/messageType';
import { updateUserDetailsModal } from '../../state/ducks/modalDialog';
import autoBind from 'auto-bind';
import { AudioPlayerWithEncryptedFile } from './H5AudioPlayer';
import { ClickToTrustSender } from './message/ClickToTrustSender';
import { getMessageById } from '../../data/data';
import { connect } from 'react-redux';
import { StateType } from '../../state/reducer';
import {
  getQuotedMessageToAnimate,
  getSelectedMessageIds,
} from '../../state/selectors/conversations';
import {
  messageExpired,
  showLightBox,
  toggleSelectedMessageId,
} from '../../state/ducks/conversations';
import { saveAttachmentToDisk } from '../../util/attachmentsUtil';
import { LightBoxOptions } from '../session/conversation/SessionConversation';
import { MessageContextMenu } from './MessageContextMenu';
import { ReadableMessage } from './ReadableMessage';
import { isElectronWindowFocused } from '../../session/utils/WindowUtils';
import { getConversationController } from '../../session/conversations';
import { MessageMetadata } from './message/MessageMetadata';

// Same as MIN_WIDTH in ImageGrid.tsx
const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;
}

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

type Props = MessageRenderingProps & {
  selectedMessages: Array<string>;
  quotedMessageToAnimate: string | undefined;
};

function attachmentIsAttachmentTypeWithPath(attac: any): attac is AttachmentTypeWithPath {
  return attac.path !== undefined;
}

const onClickAttachment = async (onClickProps: {
  attachment: AttachmentTypeWithPath | AttachmentType;
  messageId: string;
}) => {
  let index = -1;

  const found = await getMessageById(onClickProps.messageId);
  if (!found) {
    window.log.warn('Such message not found');
    return;
  }
  const msgAttachments = found.getPropsForMessage().attachments;

  const media = (msgAttachments || []).map(attachmentForMedia => {
    index++;
    const messageTimestamp =
      found.get('timestamp') || found.get('serverTimestamp') || found.get('received_at');

    return {
      index: _.clone(index),
      objectURL: attachmentForMedia.url || undefined,
      contentType: attachmentForMedia.contentType,
      attachment: attachmentForMedia,
      messageSender: found.getSource(),
      messageTimestamp,
      messageId: onClickProps.messageId,
    };
  });

  if (attachmentIsAttachmentTypeWithPath(onClickProps.attachment)) {
    const lightBoxOptions: LightBoxOptions = {
      media: media as any,
      attachment: onClickProps.attachment,
    };
    window.inboxStore?.dispatch(showLightBox(lightBoxOptions));
  } else {
    window.log.warn('Attachment is not of the right type');
  }
};

class MessageInner extends React.PureComponent<Props, State> {
  public expirationCheckInterval: any;
  public expiredTimeout: any;
  public ctxMenuID: string;

  public constructor(props: Props) {
    super(props);
    autoBind(this);

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,
    };
    this.ctxMenuID = `ctx-menu-message-${uuid()}`;
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
    const { isExpired, expirationTimestamp, expirationLength, convoId, id } = this.props;

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

      const setExpired = async () => {
        this.setState({
          expired: true,
        });
        await window.Signal.Data.removeMessage(id);
        window.inboxStore?.dispatch(
          messageExpired({
            conversationKey: convoId,
            messageId: id,
          })
        );
        const convo = getConversationController().get(convoId);
        convo?.updateLastMessage();
      };
      // as 'checkExpired' is potentially called more than once (componentDidUpdate & componentDidMount),
      //  we need to clear the timeout call to 'setExpired' first to avoid multiple calls to 'setExpired'.
      clearTimeout(this.expiredTimeout);
      this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);
    }
  }

  public handleImageError() {
    this.setState({
      imageBroken: true,
    });
  }

  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  public renderAttachment() {
    const {
      id,
      attachments,
      text,
      collapseMetadata,
      conversationType,
      direction,
      quote,
      isTrustedForAttachmentDownload,
    } = this.props;
    const { imageBroken } = this.state;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    // For attachments which aren't full-frame
    const withContentBelow = Boolean(text);
    const withContentAbove =
      Boolean(quote) || (conversationType === 'group' && direction === 'incoming');
    const displayImage = canDisplayImage(attachments);

    if (!isTrustedForAttachmentDownload) {
      return <ClickToTrustSender messageId={id} />;
    }

    if (
      displayImage &&
      !imageBroken &&
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
    ) {
      return (
        <div
          className={classNames(
            'module-message__attachment-container',
            withContentAbove ? 'module-message__attachment-container--with-content-above' : null,
            withContentBelow ? 'module-message__attachment-container--with-content-below' : null
          )}
        >
          <ImageGrid
            attachments={attachments}
            withContentAbove={withContentAbove}
            withContentBelow={withContentBelow}
            bottomOverlay={!collapseMetadata}
            onError={this.handleImageError}
            onClickAttachment={this.onClickOnImageGrid}
          />
        </div>
      );
    } else if (!firstAttachment.pending && isAudio(attachments)) {
      return (
        <div
          role="main"
          onClick={(e: any) => {
            e.stopPropagation();
          }}
        >
          <AudioPlayerWithEncryptedFile
            src={firstAttachment.url}
            contentType={firstAttachment.contentType}
            playNextMessage={this.props.playNextMessage}
            playableMessageIndex={this.props.playableMessageIndex}
            nextMessageToPlay={this.props.nextMessageToPlay}
          />
        </div>
      );
    } else {
      const { pending, fileName, fileSize, contentType } = firstAttachment;
      const extension = getExtensionForDisplay({ contentType, fileName });
      const isDangerous = isFileDangerous(fileName || '');

      return (
        <div
          className={classNames(
            'module-message__generic-attachment',
            withContentBelow ? 'module-message__generic-attachment--with-content-below' : null,
            withContentAbove ? 'module-message__generic-attachment--with-content-above' : null
          )}
        >
          {pending ? (
            <div className="module-message__generic-attachment__spinner-container">
              <Spinner size="small" direction={direction} />
            </div>
          ) : (
            <div className="module-message__generic-attachment__icon-container">
              <div
                role="button"
                className="module-message__generic-attachment__icon"
                onClick={this.onClickOnGenericAttachment}
              >
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

  // tslint:disable-next-line cyclomatic-complexity
  public renderPreview() {
    const { attachments, conversationType, direction, previews, quote } = this.props;

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
      Boolean(quote) || (conversationType === 'group' && direction === 'incoming');

    const previewHasImage = first.image && isImageAttachment(first.image);
    const width = first.image && first.image.width;
    const isFullSizeImage = width && width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH;

    return (
      <div
        role="button"
        className={classNames(
          'module-message__link-preview',
          withContentAbove ? 'module-message__link-preview--with-content-above' : null
        )}
      >
        {first.image && previewHasImage && isFullSizeImage ? (
          <ImageGrid
            attachments={[first.image]}
            withContentAbove={withContentAbove}
            withContentBelow={true}
            onError={this.handleImageError}
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
                softCorners={true}
                alt={window.i18n('previewThumbnail', [first.domain])}
                height={72}
                width={72}
                url={first.image.url}
                attachment={first.image}
                onError={this.handleImageError}
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
            <div className="module-message__link-preview__title">{first.title}</div>
            <div className="module-message__link-preview__location">{first.domain}</div>
          </div>
        </div>
      </div>
    );
  }

  public renderQuote() {
    const { conversationType, direction, quote, isPublic, convoId } = this.props;

    if (!quote || !quote.authorPhoneNumber || !quote.messageId) {
      return null;
    }
    const withContentAbove = conversationType === 'group' && direction === 'incoming';

    const shortenedPubkey = PubKey.shorten(quote.authorPhoneNumber);

    const displayedPubkey = quote.authorProfileName ? shortenedPubkey : quote.authorPhoneNumber;

    return (
      <Quote
        onClick={this.onQuoteClick}
        text={quote.text}
        attachment={quote.attachment}
        isIncoming={direction === 'incoming'}
        conversationType={conversationType}
        convoId={convoId}
        isPublic={isPublic}
        authorPhoneNumber={displayedPubkey}
        authorProfileName={quote.authorProfileName}
        authorName={quote.authorName}
        referencedMessageNotFound={quote.referencedMessageNotFound}
        isFromMe={quote.isFromMe}
        withContentAbove={withContentAbove}
      />
    );
  }

  public renderAvatar() {
    const {
      authorAvatarPath,
      authorName,
      authorPhoneNumber,
      authorProfileName,
      collapseMetadata,
      isSenderAdmin,
      conversationType,
      direction,
      isPublic,
      firstMessageOfSeries,
    } = this.props;

    if (collapseMetadata || conversationType !== 'group' || direction === 'outgoing') {
      return;
    }
    const userName = authorName || authorProfileName || authorPhoneNumber;

    if (!firstMessageOfSeries) {
      return <div style={{ marginInlineEnd: '60px' }} key={`msg-avatar-${authorPhoneNumber}`} />;
    }

    return (
      <div className="module-message__author-avatar" key={`msg-avatar-${authorPhoneNumber}`}>
        <Avatar
          avatarPath={authorAvatarPath}
          name={userName}
          size={AvatarSize.S}
          onAvatarClick={this.onMessageAvatarClick}
          pubkey={authorPhoneNumber}
        />
        {isPublic && isSenderAdmin && (
          <div className="module-avatar__icon--crown-wrapper">
            <div className="module-avatar__icon--crown" />
          </div>
        )}
      </div>
    );
  }

  public renderText() {
    const { text, direction, status, conversationType, convoId, multiSelectMode } = this.props;

    const contents =
      direction === 'incoming' && status === 'error' ? window.i18n('incomingError') : text;

    if (!contents) {
      return null;
    }

    return (
      <div
        dir="auto"
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`,
          status === 'error' && direction === 'incoming' ? 'module-message__text--error' : null
        )}
      >
        <MessageBody
          text={contents || ''}
          isGroup={conversationType === 'group'}
          convoId={convoId}
          disableLinks={multiSelectMode}
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
          className={classNames('module-message__error', `module-message__error--${direction}`)}
        />
      </div>
    );
  }

  public getWidth(): number | undefined {
    const { attachments, previews } = this.props;

    if (attachments && attachments.length) {
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

      if (isImageAttachment(first.image) && width && width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH) {
        const dimensions = getImageDimensions(first.image);
        if (dimensions) {
          return dimensions.width;
        }
      }
    }

    return;
  }

  public isShowingImage(): boolean {
    const { attachments, previews } = this.props;
    const { imageBroken } = this.state;

    if (imageBroken) {
      return false;
    }

    if (attachments && attachments.length) {
      const displayImage = canDisplayImage(attachments);

      return Boolean(
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

  // tslint:disable-next-line: cyclomatic-complexity
  public render() {
    const { direction, id, conversationType, isUnread, selectedMessages } = this.props;
    const { expired, expiring } = this.state;

    if (expired) {
      return null;
    }

    const selected = selectedMessages.includes(id) || false;

    const width = this.getWidth();
    const isShowingImage = this.isShowingImage();

    const isIncoming = direction === 'incoming';
    const shouldMarkReadWhenVisible = isIncoming && isUnread;
    const divClasses = ['session-message-wrapper'];

    if (selected) {
      divClasses.push('message-selected');
    }

    if (conversationType === 'group') {
      divClasses.push('public-chat-message-wrapper');
    }

    if (this.props.quotedMessageToAnimate === this.props.id) {
      divClasses.push('flash-green-once');
    }

    const onVisible = async (inView: boolean | Object) => {
      if (inView === true && shouldMarkReadWhenVisible && isElectronWindowFocused()) {
        const found = await getMessageById(id);

        if (found && Boolean(found.get('unread'))) {
          // mark the message as read.
          // this will trigger the expire timer.
          void found.markRead(Date.now());
        }
      }
    };

    return (
      <ReadableMessage
        id={id}
        className={classNames(divClasses)}
        onChange={onVisible}
        onContextMenu={this.handleContextMenu}
        key={`readable-message-${this.props.id}`}
      >
        {this.renderAvatar()}
        <div
          className={classNames(
            'module-message',
            `module-message--${direction}`,
            expiring ? 'module-message--expired' : null
          )}
          role="button"
          onClick={this.onClickOnMessageOuterContainer}
        >
          {this.renderError(isIncoming)}

          <div
            className={classNames(
              'module-message__container',
              `module-message__container--${direction}`,
              isShowingImage
                ? `module-message__container--${direction}--transparent`
                : `module-message__container--${direction}--opaque`
            )}
            style={{
              width: isShowingImage ? width : undefined,
            }}
            role="button"
            onClick={this.onClickOnMessageInnerContainer}
          >
            {this.renderAuthor()}
            {this.renderQuote()}
            {this.renderAttachment()}
            {this.renderPreview()}
            {this.renderText()}
            <MessageMetadata
              direction={this.props.direction}
              id={this.props.id}
              timestamp={this.props.timestamp}
              collapseMetadata={this.props.collapseMetadata}
              expirationLength={this.props.expirationLength}
              isAdmin={this.props.isSenderAdmin}
              serverTimestamp={this.props.serverTimestamp}
              isPublic={this.props.isPublic}
              status={this.props.status}
              expirationTimestamp={this.props.expirationTimestamp}
              text={this.props.text}
              isShowingImage={this.isShowingImage()}
            />
          </div>
          {this.renderError(!isIncoming)}

          <MessageContextMenu
            authorPhoneNumber={this.props.authorPhoneNumber}
            convoId={this.props.convoId}
            contextMenuId={this.ctxMenuID}
            direction={this.props.direction}
            isBlocked={this.props.isBlocked}
            isDeletable={this.props.isDeletable}
            messageId={this.props.id}
            text={this.props.text}
            timestamp={this.props.timestamp}
            serverTimestamp={this.props.serverTimestamp}
            attachments={this.props.attachments}
            isAdmin={this.props.isSenderAdmin}
            isOpenGroupV2={this.props.isOpenGroupV2}
            isPublic={this.props.isPublic}
            status={this.props.status}
            weAreAdmin={this.props.weAreAdmin}
          />
        </div>
      </ReadableMessage>
    );
  }

  private handleContextMenu(e: any) {
    e.preventDefault();
    e.stopPropagation();
    const { multiSelectMode, isKickedFromGroup } = this.props;
    const enableContextMenu = !multiSelectMode && !isKickedFromGroup;

    if (enableContextMenu) {
      // Don't forget to pass the id and the event and voila!
      contextMenu.hideAll();
      contextMenu.show({
        id: this.ctxMenuID,
        event: e,
      });
    }
  }

  private onQuoteClick(e: any) {
    const { quote, multiSelectMode, id } = this.props;
    if (!quote) {
      window.log.warn('onQuoteClick: quote not valid');
      return;
    }
    const quoteId = _.toNumber(quote.messageId);
    const { authorPhoneNumber, referencedMessageNotFound } = quote;
    e.preventDefault();
    e.stopPropagation();
    if (multiSelectMode && id) {
      window.inboxStore?.dispatch(toggleSelectedMessageId(id));

      return;
    }
    void this.props.onQuoteClick?.({
      quoteAuthor: authorPhoneNumber,
      quoteId,
      referencedMessageNotFound,
    });
  }

  private renderAuthor() {
    const {
      authorName,
      authorPhoneNumber,
      authorProfileName,
      conversationType,
      direction,
      isPublic,
    } = this.props;

    const title = authorName ? authorName : authorPhoneNumber;

    if (direction !== 'incoming' || conversationType !== 'group' || !title) {
      return null;
    }

    const shortenedPubkey = PubKey.shorten(authorPhoneNumber);

    const displayedPubkey = authorProfileName ? shortenedPubkey : authorPhoneNumber;

    return (
      <div className="module-message__author">
        <ContactName
          phoneNumber={displayedPubkey}
          name={authorName}
          profileName={authorProfileName}
          module="module-message__author"
          boldProfileName={true}
          shouldShowPubkey={Boolean(isPublic)}
        />
      </div>
    );
  }

  private onMessageAvatarClick() {
    const userName =
      this.props.authorName || this.props.authorProfileName || this.props.authorPhoneNumber;

    window.inboxStore?.dispatch(
      updateUserDetailsModal({
        conversationId: this.props.authorPhoneNumber,
        userName,
        authorAvatarPath: this.props.authorAvatarPath,
      })
    );
  }

  private onClickOnImageGrid(attachment: AttachmentTypeWithPath | AttachmentType) {
    const { multiSelectMode, id } = this.props;

    if (multiSelectMode) {
      window.inboxStore?.dispatch(toggleSelectedMessageId(id));
    } else {
      void onClickAttachment({
        attachment,
        messageId: id,
      });
    }
  }

  private onClickOnGenericAttachment(e: any) {
    const { timestamp, serverTimestamp, authorPhoneNumber, attachments, convoId } = this.props;

    e.stopPropagation();

    if (!attachments?.length) {
      return;
    }

    const firstAttachment = attachments[0];

    const messageTimestamp = timestamp || serverTimestamp || 0;
    void saveAttachmentToDisk({
      attachment: firstAttachment,
      messageTimestamp,
      messageSender: authorPhoneNumber,
      conversationId: convoId,
    });
  }

  private onClickOnMessageOuterContainer(event: any) {
    const { multiSelectMode, id } = this.props;
    const selection = window.getSelection();
    // Text is being selected
    if (selection && selection.type === 'Range') {
      return;
    }

    // User clicked on message body
    const target = event.target as HTMLDivElement;
    if ((!multiSelectMode && target.className === 'text-selectable') || window.contextMenuShown) {
      return;
    }

    if (id) {
      window.inboxStore?.dispatch(toggleSelectedMessageId(id));
    }
  }

  private onClickOnMessageInnerContainer(event: any) {
    const selection = window.getSelection();
    // Text is being selected
    if (selection && selection.type === 'Range') {
      return;
    }

    // User clicked on message body
    const target = event.target as HTMLDivElement;
    if (target.className === 'text-selectable' || window.contextMenuShown) {
      return;
    }
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    selectedMessages: getSelectedMessageIds(state),
    quotedMessageToAnimate: getQuotedMessageToAnimate(state),
  };
};

const smart = connect(mapStateToProps);

export const Message = smart(MessageInner);
