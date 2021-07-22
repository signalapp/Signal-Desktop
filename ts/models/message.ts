import Backbone from 'backbone';
// tslint:disable-next-line: match-default-export-name
import filesize from 'filesize';
import _, { noop } from 'lodash';
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
  MessageModelType,
  PropsForDataExtractionNotification,
} from './messageType';

import autoBind from 'auto-bind';
import { saveMessage } from '../../ts/data/data';
import { ConversationModel, ConversationTypeEnum } from './conversation';
import {
  actions as conversationActions,
  FindAndFormatContactType,
  LastMessageStatusType,
  MessageModelProps,
  MessagePropsDetails,
  PropsForAttachment,
  PropsForExpirationTimer,
  PropsForGroupInvitation,
  PropsForGroupUpdate,
  PropsForGroupUpdateAdd,
  PropsForGroupUpdateArray,
  PropsForGroupUpdateGeneral,
  PropsForGroupUpdateKicked,
  PropsForGroupUpdateName,
  PropsForGroupUpdateRemove,
  PropsForMessage,
  PropsForSearchResults,
} from '../state/ducks/conversations';
import { VisibleMessage } from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { buildSyncMessage } from '../session/utils/syncUtils';
import { isOpenGroupV2 } from '../opengroup/utils/OpenGroupUtils';
import { MessageInteraction } from '../interactions';
import {
  uploadAttachmentsV2,
  uploadLinkPreviewsV2,
  uploadQuoteThumbnailsV2,
} from '../session/utils/AttachmentsV2';
import { OpenGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { getMessageController } from '../session/messages';
import { isUsFromCache } from '../session/utils/User';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { AttachmentTypeWithPath } from '../types/Attachment';

export class MessageModel extends Backbone.Model<MessageAttributes> {
  constructor(attributes: MessageAttributesOptionals) {
    const filledAttrs = fillMessageAttributesWithDefaults(attributes);
    super(filledAttrs);

    this.set(
      window.Signal.Types.Message.initializeSchemaVersion({
        message: filledAttrs,
        logger: window.log,
      })
    );

    if (!this.attributes.id) {
      throw new Error('A message always needs to have an id.');
    }
    if (!this.attributes.conversationId) {
      throw new Error('A message always needs to have an conversationId.');
    }

    // this.on('expired', this.onExpired);
    void this.setToExpire();
    autoBind(this);

    this.dispatchMessageUpdate = _.throttle(this.dispatchMessageUpdate, 300);

    window.contextMenuShown = false;

    this.getProps();
  }

  public getProps(): MessageModelProps {
    perfStart(`getPropsMessage-${this.id}`);
    const messageProps: MessageModelProps = {
      propsForMessage: this.getPropsForMessage(),
      propsForSearchResult: this.getPropsForSearchResult(),
      propsForDataExtractionNotification: this.getPropsForDataExtractionNotification(),
      propsForGroupInvitation: this.getPropsForGroupInvitation(),
      propsForGroupNotification: this.getPropsForGroupNotification(),
      propsForTimerNotification: this.getPropsForTimerNotification(),
    };
    perfEnd(`getPropsMessage-${this.id}`, 'getPropsMessage');
    return messageProps;
  }

  private dispatchMessageUpdate() {
    window.inboxStore?.dispatch(conversationActions.messageChanged(this.getProps()));
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

  public isGroupUpdate() {
    return Boolean(this.get('group_update'));
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

  // tslint:disable-next-line: cyclomatic-complexity
  public getDescription() {
    if (this.isGroupUpdate()) {
      const groupUpdate = this.get('group_update');

      const ourPrimary = window.textsecure.storage.get('primaryDevicePubKey');
      if (
        groupUpdate.left === 'You' ||
        (Array.isArray(groupUpdate.left) &&
          groupUpdate.left.length === 1 &&
          groupUpdate.left[0] === ourPrimary)
      ) {
        return window.i18n('youLeftTheGroup');
      } else if (
        (groupUpdate.left && Array.isArray(groupUpdate.left) && groupUpdate.left.length === 1) ||
        typeof groupUpdate.left === 'string'
      ) {
        return window.i18n(
          'leftTheGroup',
          getConversationController().getContactProfileNameOrShortenedPubKey(groupUpdate.left)
        );
      }
      if (groupUpdate.kicked === 'You') {
        return window.i18n('youGotKickedFromGroup');
      }

      const messages = [];
      if (!groupUpdate.name && !groupUpdate.joined && !groupUpdate.kicked) {
        messages.push(window.i18n('updatedTheGroup'));
      }
      if (groupUpdate.name) {
        messages.push(window.i18n('titleIsNow', groupUpdate.name));
      }
      if (groupUpdate.joined && groupUpdate.joined.length) {
        const names = groupUpdate.joined.map((pubKey: string) =>
          getConversationController().getContactProfileNameOrFullPubKey(pubKey)
        );

        if (names.length > 1) {
          messages.push(window.i18n('multipleJoinedTheGroup', names.join(', ')));
        } else {
          messages.push(window.i18n('joinedTheGroup', names[0]));
        }
      }

      if (groupUpdate.kicked && groupUpdate.kicked.length) {
        const names = _.map(
          groupUpdate.kicked,
          getConversationController().getContactProfileNameOrShortenedPubKey
        );

        if (names.length > 1) {
          messages.push(window.i18n('multipleKickedFromTheGroup', names.join(', ')));
        } else {
          messages.push(window.i18n('kickedFromTheGroup', names[0]));
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
        return window.i18n(
          'tookAScreenshot',
          getConversationController().getContactProfileNameOrShortenedPubKey(dataExtraction.source)
        );
      }

      return window.i18n(
        'savedTheFile',
        getConversationController().getContactProfileNameOrShortenedPubKey(dataExtraction.source)
      );
    }
    return this.get('body');
  }

  public isGroupInvitation() {
    return !!this.get('groupInvitation');
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
          description = description.replace(pubkey, `@${displayName}`);
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

      return window.i18n(
        'timerSetTo',
        window.Whisper.ExpirationTimerOptions.getAbbreviated(expireTimerUpdate.expireTimer || 0)
      );
    }

    return '';
  }

  public onDestroy() {
    void this.cleanup();
  }

  public async cleanup() {
    getMessageController().unregister(this.id);
    await window.Signal.Migrations.deleteExternalMessageFiles(this.attributes);
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
    const timespan = window.Whisper.ExpirationTimerOptions.getName(expireTimer || 0) as string;
    const disabled = !expireTimer;

    const basicProps: PropsForExpirationTimer = {
      ...this.findAndFormatContact(source),
      timespan,
      disabled,
      type: fromSync ? 'fromSync' : UserUtils.isUsFromCache(source) ? 'fromMe' : 'fromOther',
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
    };
  }

  public findContact(pubkey: string) {
    return getConversationController().get(pubkey);
  }

  public findAndFormatContact(pubkey: string): FindAndFormatContactType {
    const contactModel = this.findContact(pubkey);
    let profileName;
    let isMe = false;
    UserUtils.getOurPubKeyStrFromCache();
    if (pubkey === UserUtils.getOurPubKeyStrFromCache()) {
      profileName = window.i18n('you');
      isMe = true;
    } else {
      profileName = contactModel ? contactModel.getProfileName() : null;
    }

    return {
      phoneNumber: pubkey as string,
      avatarPath: (contactModel ? contactModel.getAvatarPath() : null) as string | null,
      name: (contactModel ? contactModel.getName() : null) as string | null,
      profileName: profileName as string | null,
      title: (contactModel ? contactModel.getTitle() : null) as string | null,
      isMe,
    };
  }

  public getPropsForGroupNotification(): PropsForGroupUpdate | null {
    if (!this.isGroupUpdate()) {
      return null;
    }
    const groupUpdate = this.get('group_update');
    const changes: PropsForGroupUpdateArray = [];

    if (!groupUpdate.name && !groupUpdate.left && !groupUpdate.joined) {
      const change: PropsForGroupUpdateGeneral = {
        type: 'general',
      };
      changes.push(change);
    }

    if (groupUpdate.joined) {
      const change: PropsForGroupUpdateAdd = {
        type: 'add',
        contacts: _.map(
          Array.isArray(groupUpdate.joined) ? groupUpdate.joined : [groupUpdate.joined],
          phoneNumber => this.findAndFormatContact(phoneNumber)
        ),
      };
      changes.push(change);
    }

    if (groupUpdate.kicked === 'You') {
      const change: PropsForGroupUpdateKicked = {
        type: 'kicked',
        isMe: true,
      };
      changes.push(change);
    } else if (groupUpdate.kicked) {
      const change: PropsForGroupUpdateKicked = {
        type: 'kicked',
        isMe: false,
        contacts: _.map(
          Array.isArray(groupUpdate.kicked) ? groupUpdate.kicked : [groupUpdate.kicked],
          phoneNumber => this.findAndFormatContact(phoneNumber)
        ),
      };
      changes.push(change);
    }

    if (groupUpdate.left === 'You') {
      const change: PropsForGroupUpdateRemove = {
        type: 'remove',
        isMe: true,
      };
      changes.push(change);
    } else if (groupUpdate.left) {
      if (
        Array.isArray(groupUpdate.left) &&
        groupUpdate.left.length === 1 &&
        groupUpdate.left[0] === UserUtils.getOurPubKeyStrFromCache()
      ) {
        const change: PropsForGroupUpdateRemove = {
          type: 'remove',
          isMe: true,
        };
        changes.push(change);
      } else if (
        typeof groupUpdate.left === 'string' ||
        (Array.isArray(groupUpdate.left) && groupUpdate.left.length === 1)
      ) {
        const change: PropsForGroupUpdateRemove = {
          type: 'remove',
          isMe: false,
          contacts: _.map(
            Array.isArray(groupUpdate.left) ? groupUpdate.left : [groupUpdate.left],
            phoneNumber => this.findAndFormatContact(phoneNumber)
          ),
        };
        changes.push(change);
      }
    }

    if (groupUpdate.name) {
      const change: PropsForGroupUpdateName = {
        type: 'name',
        newName: groupUpdate.name as string,
      };
      changes.push(change);
    }

    return {
      changes,
    };
  }

  public getMessagePropStatus(): LastMessageStatusType {
    if (this.hasErrors()) {
      return 'error';
    }

    // Only return the status on outgoing messages
    if (!this.isOutgoing()) {
      return null;
    }

    if (this.isDataExtractionNotification()) {
      return null;
    }

    const readBy = this.get('read_by') || [];
    if (window.storage.get('read-receipt-setting') && readBy.length > 0) {
      return 'read';
    }
    const sent = this.get('sent');
    const sentTo = this.get('sent_to') || [];
    if (sent || sentTo.length > 0) {
      return 'sent';
    }

    return 'sending';
  }

  public getPropsForSearchResult(): PropsForSearchResults {
    const fromNumber = this.getSource();
    const from = this.findAndFormatContact(fromNumber);

    const toNumber = this.get('conversationId');
    const to = this.findAndFormatContact(toNumber);

    return {
      from,
      to,
      // isSelected: this.isSelected,
      id: this.id as string,
      conversationId: this.get('conversationId'),
      receivedAt: this.get('received_at'),
      snippet: this.get('snippet'),
    };
  }

  public getPropsForMessage(options: any = {}): PropsForMessage {
    const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
    const sender = this.getSource();
    const senderContact = this.findAndFormatContact(sender);
    const senderContactModel = this.findContact(sender);

    const authorAvatarPath = senderContactModel ? senderContactModel.getAvatarPath() : null;

    const expirationLength = this.get('expireTimer') * 1000;
    const expireTimerStart = this.get('expirationStartTimestamp');
    const expirationTimestamp =
      expirationLength && expireTimerStart ? expireTimerStart + expirationLength : null;

    const conversation = this.getConversation();

    const isGroup = !!conversation && !conversation.isPrivate();
    const isBlocked = conversation?.isBlocked() || false;
    const isPublic = !!this.get('isPublic');
    const isPublicOpenGroupV2 = isOpenGroupV2(this.getConversation()?.id || '');

    const attachments = this.get('attachments') || [];
    const isTrustedForAttachmentDownload = this.isTrustedForAttachmentDownload();
    const groupAdmins = (isGroup && conversation?.get('groupAdmins')) || [];
    const weAreAdmin = groupAdmins.includes(ourPubkey) || false;
    // a message is deletable if
    // either we sent it,
    // or the convo is not a public one (in this case, we will only be able to delete for us)
    // or the convo is public and we are an admin
    const isDeletable = sender === ourPubkey || !isPublic || (isPublic && !!weAreAdmin);

    const isSenderAdmin = groupAdmins.includes(sender);

    const props: PropsForMessage = {
      text: this.createNonBreakingLastSeparator(this.get('body')),
      id: this.id as string,
      direction: (this.isIncoming() ? 'incoming' : 'outgoing') as MessageModelType,
      timestamp: this.get('sent_at') || 0,
      receivedAt: this.get('received_at'),
      serverTimestamp: this.get('serverTimestamp'),
      serverId: this.get('serverId'),
      status: this.getMessagePropStatus(),
      authorName: senderContact.name,
      authorProfileName: senderContact.profileName,
      authorPhoneNumber: senderContact.phoneNumber,
      conversationType: isGroup ? ConversationTypeEnum.GROUP : ConversationTypeEnum.PRIVATE,
      convoId: this.get('conversationId'),
      attachments: attachments
        .filter((attachment: any) => !attachment.error)
        .map((attachment: any) => this.getPropsForAttachment(attachment)),
      previews: this.getPropsForPreview(),
      quote: this.getPropsForQuote(options),
      authorAvatarPath,
      isUnread: this.isUnread(),
      expirationLength,
      expirationTimestamp,
      isPublic,
      isBlocked,
      isOpenGroupV2: isPublicOpenGroupV2,
      isKickedFromGroup: conversation?.get('isKickedFromGroup'),
      isTrustedForAttachmentDownload,
      weAreAdmin,
      isDeletable,
      isSenderAdmin,
      isExpired: this.isExpired(),
    };

    return props;
  }

  public createNonBreakingLastSeparator(text?: string) {
    if (!text) {
      return null;
    }

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
    const path =
      thumbnail &&
      thumbnail.path &&
      window.Signal.Migrations.getAbsoluteAttachmentPath(thumbnail.path);
    const objectUrl = thumbnail && thumbnail.objectUrl;

    const thumbnailWithObjectUrl =
      !path && !objectUrl
        ? null
        : // tslint:disable: prefer-object-spread
          Object.assign({}, attachment.thumbnail || {}, {
            objectUrl: path || objectUrl,
          });

    return Object.assign({}, attachment, {
      isVoiceMessage: window.Signal.Types.Attachment.isVoiceMessage(attachment),
      thumbnail: thumbnailWithObjectUrl,
    });
    // tslint:enable: prefer-object-spread
  }

  public getPropsForPreview() {
    // Don't generate link previews if user has turned them off
    if (!window.storage.get('link-preview-setting', false)) {
      return null;
    }

    const previews = this.get('preview') || [];

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
        domain: window.Signal.LinkPreviews.getDomain(preview.url),
        image,
      };
    });
  }

  public getPropsForQuote(options: any = {}) {
    const quote = this.get('quote');

    if (!quote) {
      return null;
    }

    const { author, id, referencedMessageNotFound } = quote;
    const contact: ConversationModel = author && getConversationController().get(author);

    const authorName = contact ? contact.getContactProfileNameOrShortenedPubKey() : null;

    const isFromMe = contact ? contact.id === UserUtils.getOurPubKeyStrFromCache() : false;

    const firstAttachment = quote.attachments && quote.attachments[0];

    return {
      text: this.createNonBreakingLastSeparator(quote.text),
      attachment: firstAttachment ? this.processQuoteAttachment(firstAttachment) : null,
      isFromMe,
      authorPhoneNumber: author,
      messageId: id,
      authorName,
      referencedMessageNotFound,
    };
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
    } = attachment;

    const isVoiceMessage =
      // tslint:disable-next-line: no-bitwise
      Boolean(flags && flags & SignalService.AttachmentPointer.Flags.VOICE_MESSAGE) || false;
    return {
      id: id ? `${id}` : undefined,
      contentType,
      size: size || 0,
      width: width || 0,
      height: height || 0,
      path,
      fileName,
      fileSize: size ? filesize(size) : null,
      isVoiceMessage,
      pending: Boolean(pending),
      url: path ? window.Signal.Migrations.getAbsoluteAttachmentPath(path) : null,
      screenshot: screenshot
        ? {
            ...screenshot,
            url: window.Signal.Migrations.getAbsoluteAttachmentPath(screenshot.path),
          }
        : null,
      thumbnail: thumbnail
        ? {
            ...thumbnail,
            url: window.Signal.Migrations.getAbsoluteAttachmentPath(thumbnail.path),
          }
        : null,
    };
  }

  public async getPropsForMessageDetail(): Promise<MessagePropsDetails> {
    // We include numbers we didn't successfully send to so we can display errors.
    // Older messages don't have the recipients included on the message, so we fall
    //   back to the conversation's current recipients
    const phoneNumbers = this.isIncoming()
      ? [this.get('source')]
      : _.union(
          this.get('sent_to') || [],
          this.get('recipients') || this.getConversation()?.getRecipients() || []
        );

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
      contact => `${contact.isPrimaryDevice ? '0' : '1'}${contact.phoneNumber}`
    );
    const toRet: MessagePropsDetails = {
      sentAt: this.get('sent_at') || 0,
      receivedAt: this.get('received_at') || 0,
      message: {
        ...this.getPropsForMessage(),
        disableMenu: true,
        // To ensure that group avatar doesn't show up
        conversationType: ConversationTypeEnum.PRIVATE,
        multiSelectMode: false,
        firstMessageOfSeries: false,
      },
      errors,
      contacts: sortedContacts || [],
    };

    return toRet;
  }

  public copyPubKey() {
    // this.getSource return out pubkey if this is an outgoing message, or the sender pubkey
    MessageInteraction.copyPubKey(this.getSource());
  }

  /**
   * Uploads attachments, previews and quotes.
   *
   * @returns The uploaded data which includes: body, attachments, preview and quote.
   */
  public async uploadData() {
    // TODO: In the future it might be best if we cache the upload results if possible.
    // This way we don't upload duplicated data.

    const attachmentsWithData = await Promise.all(
      (this.get('attachments') || []).map(window.Signal.Migrations.loadAttachmentData)
    );
    const body = this.get('body');
    const finalAttachments = attachmentsWithData as Array<any>;

    const quoteWithData = await window.Signal.Migrations.loadQuoteData(this.get('quote'));
    const previewWithData = await window.Signal.Migrations.loadPreviewData(this.get('preview'));

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

    return {
      body,
      attachments,
      preview,
      quote,
    };
  }

  // One caller today: event handler for the 'Retry Send' entry on right click of a failed send message
  public async retrySend() {
    if (!window.textsecure.messaging) {
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
      (dataMessage.body && dataMessage.body.length) ||
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

  public async markMessageSyncOnly(dataMessage: DataMessage) {
    this.set({
      // These are the same as a normal send()
      dataMessage,
      sent_to: [UserUtils.getOurPubKeyStrFromCache()],
      sent: true,
      expirationStartTimestamp: Date.now(),
    });

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

  public async commit() {
    if (!this.attributes.id) {
      throw new Error('A message always needs an id');
    }

    perfStart(`messageCommit-${this.attributes.id}`);
    const id = await saveMessage(this.attributes);
    this.dispatchMessageUpdate();
    perfEnd(`messageCommit-${this.attributes.id}`, 'messageCommit');

    return id;
  }

  public async markRead(readAt: number) {
    this.markReadNoCommit(readAt);
    await this.commit();

    const convo = this.getConversation();
    if (convo) {
      const beforeUnread = convo.get('unreadCount');
      const unreadCount = await convo.getUnreadCount();
      if (beforeUnread !== unreadCount) {
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

    window.Whisper.Notifications.remove(
      window.Whisper.Notifications.where({
        messageId: this.id,
      })
    );
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
}
export class MessageCollection extends Backbone.Collection<MessageModel> {}

MessageCollection.prototype.model = MessageModel;
