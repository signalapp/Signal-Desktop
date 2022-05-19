import Backbone from 'backbone';
// tslint:disable-next-line: match-default-export-name
import filesize from 'filesize';
import { SignalService } from '../../ts/protobuf';
import { getMessageQueue, Utils } from '../../ts/session';
import { getConversationController } from '../../ts/session/conversations';
import { DataMessage } from '../../ts/session/messages/outgoing';
import { ClosedGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../../ts/session/types';
import { UserUtils } from '../../ts/session/utils';
import {
  DataExtractionNotificationMsg,
  fillMessageAttributesWithDefaults,
  MessageAttributes,
  MessageAttributesOptionals,
  MessageGroupUpdate,
  MessageModelType,
  PropsForDataExtractionNotification,
  PropsForMessageRequestResponse,
} from './messageType';

import autoBind from 'auto-bind';
import { getFirstUnreadMessageWithMention, saveMessage } from '../../ts/data/data';
import { ConversationModel, ConversationTypeEnum } from './conversation';
import {
  FindAndFormatContactType,
  LastMessageStatusType,
  MessageModelPropsWithoutConvoProps,
  MessagePropsDetails,
  messagesChanged,
  PropsForAttachment,
  PropsForExpirationTimer,
  PropsForGroupInvitation,
  PropsForGroupUpdate,
  PropsForGroupUpdateAdd,
  PropsForGroupUpdateGeneral,
  PropsForGroupUpdateKicked,
  PropsForGroupUpdateLeft,
  PropsForGroupUpdateName,
  PropsForMessageWithoutConvoProps,
} from '../state/ducks/conversations';
import { VisibleMessage } from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { buildSyncMessage } from '../session/utils/syncUtils';
import {
  uploadAttachmentsV2,
  uploadLinkPreviewsV2,
  uploadQuoteThumbnailsV2,
} from '../session/utils/AttachmentsV2';
import { OpenGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { isUsFromCache } from '../session/utils/User';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { AttachmentTypeWithPath, isVoiceMessage } from '../types/Attachment';
import _, { isEmpty } from 'lodash';
import { SettingsKey } from '../data/settings-key';
import {
  deleteExternalMessageFiles,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
  loadPreviewData,
  loadQuoteData,
} from '../types/MessageAttachment';
import { ExpirationTimerOptions } from '../util/expiringMessages';
import { Notifications } from '../util/notifications';
import { Storage } from '../util/storage';
import { LinkPreviews } from '../util/linkPreviews';
// tslint:disable: cyclomatic-complexity

/**
 * @returns true if the array contains only a single item being 'You', 'you' or our device pubkey
 */
export function arrayContainsUsOnly(arrayToCheck: Array<string> | undefined) {
  return (
    arrayToCheck &&
    arrayToCheck.length === 1 &&
    (arrayToCheck[0] === UserUtils.getOurPubKeyStrFromCache() ||
      arrayToCheck[0].toLowerCase() === 'you')
  );
}

export function arrayContainsOneItemOnly(arrayToCheck: Array<string> | undefined) {
  return arrayToCheck && arrayToCheck.length === 1;
}

export class MessageModel extends Backbone.Model<MessageAttributes> {
  constructor(attributes: MessageAttributesOptionals & { skipTimerInit?: boolean }) {
    const filledAttrs = fillMessageAttributesWithDefaults(attributes);
    super(filledAttrs);

    if (!this.attributes.id) {
      throw new Error('A message always needs to have an id.');
    }
    if (!this.attributes.conversationId) {
      throw new Error('A message always needs to have an conversationId.');
    }

    // this.on('expired', this.onExpired);
    if (!attributes.skipTimerInit) {
      void this.setToExpire();
    }
    autoBind(this);

    if (window) {
      window.contextMenuShown = false;
    }

    this.getMessageModelProps();
  }

  public getMessageModelProps(): MessageModelPropsWithoutConvoProps {
    perfStart(`getPropsMessage-${this.id}`);
    const propsForDataExtractionNotification = this.getPropsForDataExtractionNotification();
    const propsForGroupInvitation = this.getPropsForGroupInvitation();
    const propsForGroupUpdateMessage = this.getPropsForGroupUpdateMessage();
    const propsForTimerNotification = this.getPropsForTimerNotification();
    const propsForMessageRequestResponse = this.getPropsForMessageRequestResponse();
    const callNotificationType = this.get('callNotificationType');
    const messageProps: MessageModelPropsWithoutConvoProps = {
      propsForMessage: this.getPropsForMessage(),
    };
    if (propsForDataExtractionNotification) {
      messageProps.propsForDataExtractionNotification = propsForDataExtractionNotification;
    }
    if (propsForMessageRequestResponse) {
      messageProps.propsForMessageRequestResponse = propsForMessageRequestResponse;
    }
    if (propsForGroupInvitation) {
      messageProps.propsForGroupInvitation = propsForGroupInvitation;
    }
    if (propsForGroupUpdateMessage) {
      messageProps.propsForGroupUpdateMessage = propsForGroupUpdateMessage;
    }
    if (propsForTimerNotification) {
      messageProps.propsForTimerNotification = propsForTimerNotification;
    }

    if (callNotificationType) {
      messageProps.propsForCallNotification = {
        notificationType: callNotificationType,
        messageId: this.id,
        receivedAt: this.get('received_at') || Date.now(),
        isUnread: this.isUnread(),
      };
    }
    perfEnd(`getPropsMessage-${this.id}`, 'getPropsMessage');
    return messageProps;
  }

  public idForLogging() {
    return `${this.get('source')} ${this.get('sent_at')}`;
  }

  public isExpirationTimerUpdate() {
    const expirationTimerFlag = SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
    const flags = this.get('flags');
    if (!flags) {
      return false;
    }
    // eslint-disable-next-line no-bitwise
    // tslint:disable-next-line: no-bitwise
    return !!(flags & expirationTimerFlag);
  }

  public isIncoming() {
    return this.get('type') === 'incoming';
  }

  public isUnread() {
    return !!this.get('unread');
  }

  // Important to allow for this.set({ unread}), save to db, then fetch()
  // to propagate. We don't want the unset key in the db so our unread index
  // stays small.
  public merge(model: any) {
    const attributes = model.attributes || model;

    const { unread } = attributes;
    if (unread === undefined) {
      this.set({ unread: 0 });
    }

    this.set(attributes);
  }

  public isGroupInvitation() {
    return !!this.get('groupInvitation');
  }

  public isMessageRequestResponse() {
    return !!this.get('messageRequestResponse');
  }

  public isDataExtractionNotification() {
    return !!this.get('dataExtractionNotification');
  }

  public getNotificationText() {
    let description = this.getDescription();
    if (description) {
      // regex with a 'g' to ignore part groups
      const regex = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');
      const pubkeysInDesc = description.match(regex);
      (pubkeysInDesc || []).forEach((pubkey: string) => {
        const displayName = getConversationController().getContactProfileNameOrShortenedPubKey(
          pubkey.slice(1)
        );
        if (displayName && displayName.length) {
          description = description?.replace(pubkey, `@${displayName}`);
        }
      });
      return description;
    }
    if ((this.get('attachments') || []).length > 0) {
      return window.i18n('mediaMessage');
    }
    if (this.isExpirationTimerUpdate()) {
      const expireTimerUpdate = this.get('expirationTimerUpdate');
      if (!expireTimerUpdate || !expireTimerUpdate.expireTimer) {
        return window.i18n('disappearingMessagesDisabled');
      }

      return window.i18n('timerSetTo', [
        ExpirationTimerOptions.getAbbreviated(expireTimerUpdate.expireTimer || 0),
      ]);
    }

    return '';
  }

  public onDestroy() {
    void this.cleanup();
  }

  public async cleanup() {
    await deleteExternalMessageFiles(this.attributes);
  }

  public getPropsForTimerNotification(): PropsForExpirationTimer | null {
    if (!this.isExpirationTimerUpdate()) {
      return null;
    }
    const timerUpdate = this.get('expirationTimerUpdate');
    if (!timerUpdate || !timerUpdate.source) {
      return null;
    }

    const { expireTimer, fromSync, source } = timerUpdate;
    const timespan = ExpirationTimerOptions.getName(expireTimer || 0);
    const disabled = !expireTimer;

    const basicProps: PropsForExpirationTimer = {
      ...this.findAndFormatContact(source),
      timespan,
      disabled,
      type: fromSync ? 'fromSync' : UserUtils.isUsFromCache(source) ? 'fromMe' : 'fromOther',
      messageId: this.id,
      receivedAt: this.get('received_at'),
      isUnread: this.isUnread(),
    };

    return basicProps;
  }

  public getPropsForGroupInvitation(): PropsForGroupInvitation | null {
    if (!this.isGroupInvitation()) {
      return null;
    }
    const invitation = this.get('groupInvitation');

    let direction = this.get('direction');
    if (!direction) {
      direction = this.get('type') === 'outgoing' ? 'outgoing' : 'incoming';
    }

    let serverAddress = '';
    try {
      const url = new URL(invitation.url);
      serverAddress = url.origin;
    } catch (e) {
      window?.log?.warn('failed to get hostname from opengroupv2 invitation', invitation);
    }

    return {
      serverName: invitation.name,
      url: serverAddress,
      direction,
      acceptUrl: invitation.url,
      messageId: this.id as string,
      receivedAt: this.get('received_at'),
      isUnread: this.isUnread(),
    };
  }

  public getPropsForDataExtractionNotification(): PropsForDataExtractionNotification | null {
    if (!this.isDataExtractionNotification()) {
      return null;
    }
    const dataExtractionNotification = this.get('dataExtractionNotification');

    if (!dataExtractionNotification) {
      window.log.warn('dataExtractionNotification should not happen');
      return null;
    }

    const contact = this.findAndFormatContact(dataExtractionNotification.source);

    return {
      ...dataExtractionNotification,
      name: contact.profileName || contact.name || dataExtractionNotification.source,
      messageId: this.id,
      receivedAt: this.get('received_at'),
      isUnread: this.isUnread(),
    };
  }

  public getPropsForMessageRequestResponse(): PropsForMessageRequestResponse | null {
    if (!this.isMessageRequestResponse()) {
      return null;
    }
    const messageRequestResponse = this.get('messageRequestResponse');

    if (!messageRequestResponse) {
      window.log.warn('messageRequestResponse should not happen');
      return null;
    }

    const contact = this.findAndFormatContact(messageRequestResponse.source);

    return {
      ...messageRequestResponse,
      name: contact.profileName || contact.name || messageRequestResponse.source,
      messageId: this.id,
      receivedAt: this.get('received_at'),
      isUnread: this.isUnread(),
      conversationId: this.get('conversationId'),
      source: this.get('source'),
    };
  }

  public findContact(pubkey: string) {
    return getConversationController().get(pubkey);
  }

  public findAndFormatContact(pubkey: string): FindAndFormatContactType {
    const contactModel = this.findContact(pubkey);
    let profileName;
    let isMe = false;

    if (pubkey === UserUtils.getOurPubKeyStrFromCache()) {
      profileName = window.i18n('you');
      isMe = true;
    } else {
      profileName = contactModel ? contactModel.getProfileName() : null;
    }

    return {
      pubkey: pubkey,
      avatarPath: contactModel ? contactModel.getAvatarPath() : null,
      name: (contactModel ? contactModel.getName() : null) as string | null,
      profileName: profileName as string | null,
      title: (contactModel ? contactModel.getTitle() : null) as string | null,
      isMe,
    };
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public getPropsForGroupUpdateMessage(): PropsForGroupUpdate | null {
    const groupUpdate = this.getGroupUpdateAsArray();

    if (!groupUpdate || _.isEmpty(groupUpdate)) {
      return null;
    }

    const sharedProps = {
      messageId: this.id,
      isUnread: this.isUnread(),
      receivedAt: this.get('received_at'),
    };

    if (groupUpdate.joined?.length) {
      const change: PropsForGroupUpdateAdd = {
        type: 'add',
        added: groupUpdate.joined,
      };
      return { change, ...sharedProps };
    }

    if (groupUpdate.kicked?.length) {
      const change: PropsForGroupUpdateKicked = {
        type: 'kicked',
        kicked: groupUpdate.kicked,
      };
      return { change, ...sharedProps };
    }

    if (groupUpdate.left?.length) {
      const change: PropsForGroupUpdateLeft = {
        type: 'left',
        left: groupUpdate.left,
      };
      return { change, ...sharedProps };
    }

    if (groupUpdate.name) {
      const change: PropsForGroupUpdateName = {
        type: 'name',
        newName: groupUpdate.name,
      };
      return { change, ...sharedProps };
    }

    // Just show a "Group Updated" message, not sure what was changed
    const changeGeneral: PropsForGroupUpdateGeneral = {
      type: 'general',
    };
    return { change: changeGeneral, ...sharedProps };
  }

  public getMessagePropStatus(): LastMessageStatusType {
    if (this.hasErrors()) {
      return 'error';
    }

    // Only return the status on outgoing messages
    if (!this.isOutgoing()) {
      return undefined;
    }

    if (this.isDataExtractionNotification() || this.get('callNotificationType')) {
      return undefined;
    }

    const readBy = this.get('read_by') || [];
    if (Storage.get(SettingsKey.settingsReadReceipt) && readBy.length > 0) {
      return 'read';
    }
    const sent = this.get('sent');
    const sentTo = this.get('sent_to') || [];
    if (sent || sentTo.length > 0) {
      return 'sent';
    }

    return 'sending';
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public getPropsForMessage(options: any = {}): PropsForMessageWithoutConvoProps {
    const sender = this.getSource();
    const expirationLength = this.get('expireTimer') * 1000;
    const expireTimerStart = this.get('expirationStartTimestamp');
    const expirationTimestamp =
      expirationLength && expireTimerStart ? expireTimerStart + expirationLength : null;

    const attachments = this.get('attachments') || [];
    const isTrustedForAttachmentDownload = this.isTrustedForAttachmentDownload();
    const body = this.get('body');
    const props: PropsForMessageWithoutConvoProps = {
      id: this.id,
      direction: (this.isIncoming() ? 'incoming' : 'outgoing') as MessageModelType,
      timestamp: this.get('sent_at') || 0,
      sender,
      convoId: this.get('conversationId'),
    };
    if (body) {
      props.text = this.createNonBreakingLastSeparator(body);
    }
    if (this.get('isDeleted')) {
      props.isDeleted = this.get('isDeleted');
    }

    if (this.get('messageHash')) {
      props.messageHash = this.get('messageHash');
    }
    if (this.get('received_at')) {
      props.receivedAt = this.get('received_at');
    }
    if (this.get('serverTimestamp')) {
      props.serverTimestamp = this.get('serverTimestamp');
    }
    if (this.get('serverId')) {
      props.serverId = this.get('serverId');
    }
    if (expirationLength) {
      props.expirationLength = expirationLength;
    }
    if (expirationTimestamp) {
      props.expirationTimestamp = expirationTimestamp;
    }
    if (isTrustedForAttachmentDownload) {
      props.isTrustedForAttachmentDownload = isTrustedForAttachmentDownload;
    }
    const isUnread = this.isUnread();
    if (isUnread) {
      props.isUnread = isUnread;
    }
    const isExpired = this.isExpired();
    if (isExpired) {
      props.isExpired = isExpired;
    }
    const previews = this.getPropsForPreview();
    if (previews && previews.length) {
      props.previews = previews;
    }
    const quote = this.getPropsForQuote(options);
    if (quote) {
      props.quote = quote;
    }
    const status = this.getMessagePropStatus();
    if (status) {
      props.status = status;
    }

    const attachmentsProps = attachments.map(this.getPropsForAttachment);
    if (attachmentsProps && attachmentsProps.length) {
      props.attachments = attachmentsProps;
    }

    return props;
  }

  public createNonBreakingLastSeparator(text: string) {
    const nbsp = '\xa0';
    const regex = /(\S)( +)(\S+\s*)$/;
    return text.replace(regex, (_match, start, spaces, end) => {
      const newSpaces =
        end.length < 12 ? _.reduce(spaces, accumulator => accumulator + nbsp, '') : spaces;
      return `${start}${newSpaces}${end}`;
    });
  }

  public processQuoteAttachment(attachment: any) {
    const { thumbnail } = attachment;
    const path = thumbnail && thumbnail.path && getAbsoluteAttachmentPath(thumbnail.path);
    const objectUrl = thumbnail && thumbnail.objectUrl;

    const thumbnailWithObjectUrl =
      !path && !objectUrl
        ? null
        : // tslint:disable: prefer-object-spread
          Object.assign({}, attachment.thumbnail || {}, {
            objectUrl: path || objectUrl,
          });

    return Object.assign({}, attachment, {
      isVoiceMessage: isVoiceMessage(attachment),
      thumbnail: thumbnailWithObjectUrl,
    });
    // tslint:enable: prefer-object-spread
  }

  public getPropsForPreview(): Array<any> | null {
    const previews = this.get('preview') || null;

    if (!previews || previews.length === 0) {
      return null;
    }

    return previews.map((preview: any) => {
      let image: PropsForAttachment | null = null;
      try {
        if (preview.image) {
          image = this.getPropsForAttachment(preview.image);
        }
      } catch (e) {
        window?.log?.info('Failed to show preview');
      }

      return {
        ...preview,
        domain: LinkPreviews.getDomain(preview.url),
        image,
      };
    });
  }

  public getPropsForQuote(_options: any = {}) {
    const quote = this.get('quote');

    if (!quote) {
      return null;
    }

    const { author, id, referencedMessageNotFound } = quote;
    const contact: ConversationModel = author && getConversationController().get(author);

    const authorName = contact ? contact.getContactProfileNameOrShortenedPubKey() : null;

    const isFromMe = contact ? contact.id === UserUtils.getOurPubKeyStrFromCache() : false;

    const firstAttachment = quote.attachments && quote.attachments[0];
    const quoteProps: {
      referencedMessageNotFound?: boolean;
      sender: string;
      messageId: string;
      authorName: string;
      text?: string;
      attachment?: any;
      isFromMe?: boolean;
    } = {
      sender: author,
      messageId: id,
      authorName: authorName || 'Unknown',
    };

    if (referencedMessageNotFound) {
      quoteProps.referencedMessageNotFound = true;
    }

    if (!referencedMessageNotFound) {
      if (quote.text) {
        // do not show text of not found messages.
        // if the message was deleted better not show it's text content in the message
        quoteProps.text = this.createNonBreakingLastSeparator(sliceQuoteText(quote.text));
      }

      const quoteAttachment = firstAttachment
        ? this.processQuoteAttachment(firstAttachment)
        : undefined;
      if (quoteAttachment) {
        // only set attachment if referencedMessageNotFound is false and we have one
        quoteProps.attachment = quoteAttachment;
      }
    }
    if (isFromMe) {
      quoteProps.isFromMe = true;
    }

    return quoteProps;
  }

  public getPropsForAttachment(attachment: AttachmentTypeWithPath): PropsForAttachment | null {
    if (!attachment) {
      return null;
    }

    const {
      id,
      path,
      contentType,
      width,
      height,
      pending,
      flags,
      size,
      screenshot,
      thumbnail,
      fileName,
      caption,
    } = attachment;

    const isVoiceMessageBool =
      // tslint:disable-next-line: no-bitwise
      Boolean(flags && flags & SignalService.AttachmentPointer.Flags.VOICE_MESSAGE) || false;

    return {
      id,
      contentType,
      caption,
      size: size || 0,
      width: width || 0,
      height: height || 0,
      path,
      fileName,
      fileSize: size ? filesize(size) : null,
      isVoiceMessage: isVoiceMessageBool,
      pending: Boolean(pending),
      url: path ? getAbsoluteAttachmentPath(path) : '',
      screenshot: screenshot
        ? {
            ...screenshot,
            url: getAbsoluteAttachmentPath(screenshot.path),
          }
        : null,
      thumbnail: thumbnail
        ? {
            ...thumbnail,
            url: getAbsoluteAttachmentPath(thumbnail.path),
          }
        : null,
    };
  }

  public async getPropsForMessageDetail(): Promise<MessagePropsDetails> {
    // We include numbers we didn't successfully send to so we can display errors.
    // Older messages don't have the recipients included on the message, so we fall
    //   back to the conversation's current recipients
    const phoneNumbers: Array<string> = this.isIncoming()
      ? [this.get('source')]
      : this.get('sent_to') || [];

    // This will make the error message for outgoing key errors a bit nicer
    const allErrors = (this.get('errors') || []).map((error: any) => {
      return error;
    });

    // If an error has a specific number it's associated with, we'll show it next to
    //   that contact. Otherwise, it will be a standalone entry.
    const errors = _.reject(allErrors, error => Boolean(error.number));
    const errorsGroupedById = _.groupBy(allErrors, 'number');
    const finalContacts = await Promise.all(
      (phoneNumbers || []).map(async id => {
        const errorsForContact = errorsGroupedById[id];
        const isOutgoingKeyError = false;

        const contact = this.findAndFormatContact(id);
        return {
          ...contact,
          // fallback to the message status if we do not have a status with a user
          // this is useful for medium groups.
          status: this.getStatus(id) || this.getMessagePropStatus(),
          errors: errorsForContact,
          isOutgoingKeyError,
          isPrimaryDevice: true,
          profileName: contact.profileName,
        };
      })
    );

    // The prefix created here ensures that contacts with errors are listed
    //   first; otherwise it's alphabetical
    const sortedContacts = _.sortBy(
      finalContacts,
      contact => `${contact.isPrimaryDevice ? '0' : '1'}${contact.pubkey}`
    );
    const toRet: MessagePropsDetails = {
      sentAt: this.get('sent_at') || 0,
      receivedAt: this.get('received_at') || 0,
      convoId: this.get('conversationId'),
      messageId: this.get('id'),
      errors,
      direction: this.get('direction'),
      contacts: sortedContacts || [],
    };

    return toRet;
  }

  /**
   * Uploads attachments, previews and quotes.
   *
   * @returns The uploaded data which includes: body, attachments, preview and quote.
   */
  public async uploadData() {
    // TODO: In the future it might be best if we cache the upload results if possible.
    // This way we don't upload duplicated data.

    const finalAttachments = await Promise.all(
      (this.get('attachments') || []).map(loadAttachmentData)
    );
    const body = this.get('body');

    const quoteWithData = await loadQuoteData(this.get('quote'));
    const previewWithData = await loadPreviewData(this.get('preview'));

    const conversation = this.getConversation();

    let attachmentPromise;
    let linkPreviewPromise;
    let quotePromise;
    const { AttachmentFsV2Utils } = Utils;

    // we want to go for the v1, if this is an OpenGroupV1 or not an open group at all
    if (conversation?.isOpenGroupV2()) {
      const openGroupV2 = conversation.toOpenGroupV2();
      attachmentPromise = uploadAttachmentsV2(finalAttachments, openGroupV2);
      linkPreviewPromise = uploadLinkPreviewsV2(previewWithData, openGroupV2);
      quotePromise = uploadQuoteThumbnailsV2(openGroupV2, quoteWithData);
    } else {
      // NOTE: we want to go for the v1 if this is an OpenGroupV1 or not an open group at all
      // because there is a fallback invoked on uploadV1() for attachments for not open groups attachments
      attachmentPromise = AttachmentFsV2Utils.uploadAttachmentsToFsV2(finalAttachments);
      linkPreviewPromise = AttachmentFsV2Utils.uploadLinkPreviewsToFsV2(previewWithData);
      quotePromise = AttachmentFsV2Utils.uploadQuoteThumbnailsToFsV2(quoteWithData);
    }

    const [attachments, preview, quote] = await Promise.all([
      attachmentPromise,
      linkPreviewPromise,
      quotePromise,
    ]);
    window.log.info(`Upload of message data for message ${this.idForLogging()} is finished.`);

    return {
      body,
      attachments,
      preview,
      quote,
    };
  }

  /**
   * Marks the message as deleted to show the author has deleted this message for everyone.
   * Sets isDeleted property to true. Set message body text to deletion placeholder for conversation list items.
   */
  public async markAsDeleted() {
    this.set({
      isDeleted: true,
      body: window.i18n('messageDeletedPlaceholder'),
      quote: undefined,
      groupInvitation: undefined,
      dataExtractionNotification: undefined,
      hasAttachments: 0,
      hasFileAttachments: 0,
      hasVisualMediaAttachments: 0,
      attachments: undefined,
      preview: undefined,
    });
    await this.markRead(Date.now());
    await this.commit();
  }

  // One caller today: event handler for the 'Retry Send' entry on right click of a failed send message
  public async retrySend() {
    if (!window.isOnline) {
      window?.log?.error('retrySend: Cannot retry since we are offline!');
      return null;
    }

    this.set({ errors: null });
    await this.commit();
    try {
      const conversation: ConversationModel | undefined = this.getConversation();
      if (!conversation) {
        window?.log?.info(
          'cannot retry send message, the corresponding conversation was not found.'
        );
        return;
      }

      if (conversation.isPublic()) {
        if (!conversation.isOpenGroupV2()) {
          throw new Error('Only opengroupv2 are supported now');
        }
        const uploaded = await this.uploadData();

        const openGroupParams = {
          identifier: this.id,
          timestamp: Date.now(),
          lokiProfile: UserUtils.getOurProfile(),
          ...uploaded,
        };
        const roomInfos = await getV2OpenGroupRoom(conversation.id);
        if (!roomInfos) {
          throw new Error('Could not find roomInfos for this conversation');
        }

        const openGroupMessage = new OpenGroupVisibleMessage(openGroupParams);
        return getMessageQueue().sendToOpenGroupV2(openGroupMessage, roomInfos);
      }

      const { body, attachments, preview, quote } = await this.uploadData();

      const chatParams = {
        identifier: this.id,
        body,
        timestamp: Date.now(), // force a new timestamp to handle user fixed his clock
        expireTimer: this.get('expireTimer'),
        attachments,
        preview,
        quote,
        lokiProfile: UserUtils.getOurProfile(),
      };
      if (!chatParams.lokiProfile) {
        delete chatParams.lokiProfile;
      }

      const chatMessage = new VisibleMessage(chatParams);

      // Special-case the self-send case - we send only a sync message
      if (conversation.isMe()) {
        return this.sendSyncMessageOnly(chatMessage);
      }

      if (conversation.isPrivate()) {
        return getMessageQueue().sendToPubKey(PubKey.cast(conversation.id), chatMessage);
      }

      // Here, the convo is neither an open group, a private convo or ourself. It can only be a medium group.
      // For a medium group, retry send only means trigger a send again to all recipients
      // as they are all polling from the same group swarm pubkey
      if (!conversation.isMediumGroup()) {
        throw new Error(
          'We should only end up with a medium group here. Anything else is an error'
        );
      }

      const closedGroupVisibleMessage = new ClosedGroupVisibleMessage({
        identifier: this.id,
        chatMessage,
        groupId: this.get('conversationId'),
      });

      return getMessageQueue().sendToGroup(closedGroupVisibleMessage);
    } catch (e) {
      await this.saveErrors(e);
      return null;
    }
  }

  public removeOutgoingErrors(number: string) {
    const errors = _.partition(
      this.get('errors'),
      e => e.number === number && e.name === 'SendMessageNetworkError'
    );
    this.set({ errors: errors[1] });
    return errors[0][0];
  }

  public getConversation(): ConversationModel | undefined {
    // This needs to be an unsafe call, because this method is called during
    //   initial module setup. We may be in the middle of the initial fetch to
    //   the database.
    return getConversationController().getUnsafe(this.get('conversationId'));
  }

  public getQuoteContact() {
    const quote = this.get('quote');
    if (!quote) {
      return null;
    }
    const { author } = quote;
    if (!author) {
      return null;
    }

    return getConversationController().get(author);
  }

  public getSource() {
    if (this.isIncoming()) {
      return this.get('source');
    }

    return UserUtils.getOurPubKeyStrFromCache();
  }

  public getContact() {
    const source = this.getSource();

    if (!source) {
      return null;
    }

    return getConversationController().getOrCreate(source, ConversationTypeEnum.PRIVATE);
  }

  public isOutgoing() {
    return this.get('type') === 'outgoing';
  }

  public hasErrors() {
    return _.size(this.get('errors')) > 0;
  }

  public getStatus(pubkey: string) {
    const readBy = this.get('read_by') || [];
    if (readBy.indexOf(pubkey) >= 0) {
      return 'read';
    }
    const sentTo = this.get('sent_to') || [];
    if (sentTo.indexOf(pubkey) >= 0) {
      return 'sent';
    }

    return null;
  }

  public async updateMessageHash(messageHash: string) {
    if (!messageHash) {
      window?.log?.error('Message hash not provided to update message hash');
    }
    this.set({
      messageHash,
    });

    await this.commit();
  }

  public async sendSyncMessageOnly(dataMessage: DataMessage) {
    const now = Date.now();
    this.set({
      sent_to: [UserUtils.getOurPubKeyStrFromCache()],
      sent: true,
      expirationStartTimestamp: now,
    });

    await this.commit();

    const data = dataMessage instanceof DataMessage ? dataMessage.dataProto() : dataMessage;
    await this.sendSyncMessage(data, now);
  }

  public async sendSyncMessage(dataMessage: SignalService.DataMessage, sentTimestamp: number) {
    if (this.get('synced') || this.get('sentSync')) {
      return;
    }

    // if this message needs to be synced
    if (
      dataMessage.body?.length ||
      dataMessage.attachments.length ||
      dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
    ) {
      const conversation = this.getConversation();
      if (!conversation) {
        throw new Error('Cannot trigger syncMessage with unknown convo.');
      }
      const syncMessage = buildSyncMessage(this.id, dataMessage, conversation.id, sentTimestamp);
      await getMessageQueue().sendSyncMessage(syncMessage);
    }
    this.set({ sentSync: true });
    await this.commit();
  }

  public async saveErrors(providedErrors: any) {
    let errors = providedErrors;

    if (!(errors instanceof Array)) {
      errors = [errors];
    }
    errors.forEach((e: any) => {
      window?.log?.error(
        'Message.saveErrors:',
        e && e.reason ? e.reason : null,
        e && e.stack ? e.stack : e
      );
    });
    errors = errors.map((e: any) => {
      if (
        e.constructor === Error ||
        e.constructor === TypeError ||
        e.constructor === ReferenceError
      ) {
        return _.pick(e, 'name', 'message', 'code', 'number', 'reason');
      }
      return e;
    });
    errors = errors.concat(this.get('errors') || []);

    this.set({ errors });
    await this.commit();
  }

  public async commit(triggerUIUpdate = true) {
    if (!this.attributes.id) {
      throw new Error('A message always needs an id');
    }

    perfStart(`messageCommit-${this.attributes.id}`);
    // because the saving to db calls _cleanData which mutates the field for cleaning, we need to save a copy
    const id = await saveMessage(_.cloneDeep(this.attributes));
    if (triggerUIUpdate) {
      this.dispatchMessageUpdate();
    }
    perfEnd(`messageCommit-${this.attributes.id}`, 'messageCommit');

    return id;
  }

  public async markRead(readAt: number) {
    this.markReadNoCommit(readAt);
    await this.commit();
    // the line below makes sure that getNextExpiringMessage will find this message as expiring.
    // getNextExpiringMessage is used on app start to clean already expired messages which should have been removed already, but are not
    await this.setToExpire();

    const convo = this.getConversation();
    if (convo) {
      const beforeUnread = convo.get('unreadCount');
      const unreadCount = await convo.getUnreadCount();

      const nextMentionedUs = await getFirstUnreadMessageWithMention(
        convo.id,
        UserUtils.getOurPubKeyStrFromCache()
      );
      let mentionedUsChange = false;
      if (convo.get('mentionedUs') && !nextMentionedUs) {
        convo.set('mentionedUs', false);
        mentionedUsChange = true;
      }
      if (beforeUnread !== unreadCount || mentionedUsChange) {
        convo.set({ unreadCount });
        await convo.commit();
      }
    }
  }

  public markReadNoCommit(readAt: number) {
    this.set({ unread: 0 });

    if (this.get('expireTimer') && !this.get('expirationStartTimestamp')) {
      const expirationStartTimestamp = Math.min(Date.now(), readAt || Date.now());
      this.set({ expirationStartTimestamp });
    }

    Notifications.clearByMessageId(this.id);
  }

  public isExpiring() {
    return this.get('expireTimer') && this.get('expirationStartTimestamp');
  }

  public isExpired() {
    return this.msTilExpire() <= 0;
  }

  public msTilExpire() {
    if (!this.isExpiring()) {
      return Infinity;
    }
    const now = Date.now();
    const start = this.get('expirationStartTimestamp');
    if (!start) {
      return Infinity;
    }
    const delta = this.get('expireTimer') * 1000;
    let msFromNow = start + delta - now;
    if (msFromNow < 0) {
      msFromNow = 0;
    }
    return msFromNow;
  }

  public async setToExpire(force = false) {
    if (this.isExpiring() && (force || !this.get('expires_at'))) {
      const start = this.get('expirationStartTimestamp');
      const delta = this.get('expireTimer') * 1000;
      if (!start) {
        return;
      }
      const expiresAt = start + delta;

      this.set({ expires_at: expiresAt });
      const id = this.get('id');
      if (id) {
        await this.commit();
      }

      window?.log?.info('Set message expiration', {
        expiresAt,
        sentAt: this.get('sent_at'),
      });
    }
  }

  public isTrustedForAttachmentDownload() {
    try {
      const senderConvoId = this.getSource();
      const isClosedGroup = this.getConversation()?.isClosedGroup() || false;
      if (!!this.get('isPublic') || isClosedGroup || isUsFromCache(senderConvoId)) {
        return true;
      }
      // check the convo from this user
      // we want the convo of the sender of this message
      const senderConvo = getConversationController().get(senderConvoId);
      if (!senderConvo) {
        return false;
      }
      return senderConvo.get('isTrustedForAttachmentDownload') || false;
    } catch (e) {
      window.log.warn('isTrustedForAttachmentDownload: error; ', e.message);
      return false;
    }
  }
  private dispatchMessageUpdate() {
    updatesToDispatch.set(this.id, this.getMessageModelProps());
    throttledAllMessagesDispatch();
  }

  /**
   * Before, group_update attributes could be just the string 'You' and not an array.
   * Using this method to get the group update makes sure than the joined, kicked, or left are always an array of string, or undefined
   */
  private getGroupUpdateAsArray() {
    const groupUpdate = this.get('group_update');
    if (!groupUpdate || _.isEmpty(groupUpdate)) {
      return undefined;
    }
    const left: Array<string> | undefined = Array.isArray(groupUpdate.left)
      ? groupUpdate.left
      : groupUpdate.left
      ? [groupUpdate.left]
      : undefined;
    const kicked: Array<string> | undefined = Array.isArray(groupUpdate.kicked)
      ? groupUpdate.kicked
      : groupUpdate.kicked
      ? [groupUpdate.kicked]
      : undefined;
    const joined: Array<string> | undefined = Array.isArray(groupUpdate.joined)
      ? groupUpdate.joined
      : groupUpdate.joined
      ? [groupUpdate.joined]
      : undefined;

    const forcedArrayUpdate: MessageGroupUpdate = {};

    if (left) {
      forcedArrayUpdate.left = left;
    }
    if (joined) {
      forcedArrayUpdate.joined = joined;
    }
    if (kicked) {
      forcedArrayUpdate.kicked = kicked;
    }
    if (groupUpdate.name) {
      forcedArrayUpdate.name = groupUpdate.name;
    }
    return forcedArrayUpdate;
  }

  private getDescription() {
    const groupUpdate = this.getGroupUpdateAsArray();
    if (groupUpdate) {
      if (arrayContainsUsOnly(groupUpdate.kicked)) {
        return window.i18n('youGotKickedFromGroup');
      }
      if (arrayContainsUsOnly(groupUpdate.left)) {
        return window.i18n('youLeftTheGroup');
      }

      if (groupUpdate.left && groupUpdate.left.length === 1) {
        return window.i18n('leftTheGroup', [
          getConversationController().getContactProfileNameOrShortenedPubKey(groupUpdate.left[0]),
        ]);
      }

      const messages = [];
      if (!groupUpdate.name && !groupUpdate.joined && !groupUpdate.kicked && !groupUpdate.kicked) {
        return window.i18n('updatedTheGroup'); // Group Updated
      }
      if (groupUpdate.name) {
        return window.i18n('titleIsNow', [groupUpdate.name]);
      }
      if (groupUpdate.joined && groupUpdate.joined.length) {
        const names = groupUpdate.joined.map((pubKey: string) =>
          getConversationController().getContactProfileNameOrFullPubKey(pubKey)
        );

        if (names.length > 1) {
          messages.push(window.i18n('multipleJoinedTheGroup', [names.join(', ')]));
        } else {
          messages.push(window.i18n('joinedTheGroup', names));
        }
      }

      if (groupUpdate.kicked && groupUpdate.kicked.length) {
        const names = _.map(
          groupUpdate.kicked,
          getConversationController().getContactProfileNameOrShortenedPubKey
        );

        if (names.length > 1) {
          messages.push(window.i18n('multipleKickedFromTheGroup', [names.join(', ')]));
        } else {
          messages.push(window.i18n('kickedFromTheGroup', names));
        }
      }
      return messages.join(' ');
    }
    if (this.isIncoming() && this.hasErrors()) {
      return window.i18n('incomingError');
    }
    if (this.isGroupInvitation()) {
      return `😎 ${window.i18n('openGroupInvitation')}`;
    }

    if (this.isDataExtractionNotification()) {
      const dataExtraction = this.get(
        'dataExtractionNotification'
      ) as DataExtractionNotificationMsg;
      if (dataExtraction.type === SignalService.DataExtractionNotification.Type.SCREENSHOT) {
        return window.i18n('tookAScreenshot', [
          getConversationController().getContactProfileNameOrShortenedPubKey(dataExtraction.source),
        ]);
      }

      return window.i18n('savedTheFile', [
        getConversationController().getContactProfileNameOrShortenedPubKey(dataExtraction.source),
      ]);
    }
    if (this.get('callNotificationType')) {
      const displayName = getConversationController().getContactProfileNameOrShortenedPubKey(
        this.get('conversationId')
      );
      const callNotificationType = this.get('callNotificationType');
      if (callNotificationType === 'missed-call') {
        return window.i18n('callMissed', [displayName]);
      }
      if (callNotificationType === 'started-call') {
        return window.i18n('startedACall', [displayName]);
      }
      if (callNotificationType === 'answered-a-call') {
        return window.i18n('answeredACall', [displayName]);
      }
    }
    if (this.get('callNotificationType')) {
      const displayName = getConversationController().getContactProfileNameOrShortenedPubKey(
        this.get('conversationId')
      );
      const callNotificationType = this.get('callNotificationType');
      if (callNotificationType === 'missed-call') {
        return window.i18n('callMissed', [displayName]);
      }
      if (callNotificationType === 'started-call') {
        return window.i18n('startedACall', [displayName]);
      }
      if (callNotificationType === 'answered-a-call') {
        return window.i18n('answeredACall', [displayName]);
      }
    }
    return this.get('body');
  }
}

// this is to avoid saving 2k chars for just the quote object inside a message
export function sliceQuoteText(quotedText: string | undefined | null) {
  if (!quotedText || isEmpty(quotedText)) {
    return '';
  }
  return quotedText.slice(0, 60);
}

const throttledAllMessagesDispatch = _.debounce(
  () => {
    if (updatesToDispatch.size === 0) {
      return;
    }
    window.inboxStore?.dispatch(messagesChanged([...updatesToDispatch.values()]));
    updatesToDispatch.clear();
  },
  500,
  { trailing: true, leading: true, maxWait: 1000 }
);

const updatesToDispatch: Map<string, MessageModelPropsWithoutConvoProps> = new Map();
export class MessageCollection extends Backbone.Collection<MessageModel> {}

MessageCollection.prototype.model = MessageModel;
