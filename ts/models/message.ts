import Backbone from 'backbone';
// tslint:disable-next-line: match-default-export-name
import filesize from 'filesize';
import _ from 'lodash';
import { SignalService } from '../../ts/protobuf';
import { getMessageQueue, Types, Utils } from '../../ts/session';
import { ConversationController } from '../../ts/session/conversations';
import { MessageController } from '../../ts/session/messages';
import {
  ChatMessage,
  DataMessage,
  OpenGroupMessage,
} from '../../ts/session/messages/outgoing';
import { ClosedGroupChatMessage } from '../../ts/session/messages/outgoing/content/data/group/ClosedGroupChatMessage';
import { EncryptionType, PubKey, RawMessage } from '../../ts/session/types';
import { ToastUtils, UserUtils } from '../../ts/session/utils';
import {
  fillMessageAttributesWithDefaults,
  MessageAttributes,
  MessageAttributesOptionals,
} from './messageType';

import autoBind from 'auto-bind';
import { saveMessage } from '../../ts/data/data';
import { ConversationModel } from './conversation';
export class MessageModel extends Backbone.Model<MessageAttributes> {
  public propsForTimerNotification: any;
  public propsForGroupNotification: any;
  public propsForGroupInvitation: any;
  public propsForSearchResult: any;
  public propsForMessage: any;

  constructor(attributes: MessageAttributesOptionals) {
    const filledAttrs = fillMessageAttributesWithDefaults(attributes);
    super(filledAttrs);

    this.set(
      window.Signal.Types.Message.initializeSchemaVersion({
        message: filledAttrs,
        logger: window.log,
      })
    );

    // this.on('expired', this.onExpired);
    void this.setToExpire();
    autoBind(this);

    this.markRead = this.markRead.bind(this);
    // Keep props ready
    const generateProps = (triggerEvent = true) => {
      if (this.isExpirationTimerUpdate()) {
        this.propsForTimerNotification = this.getPropsForTimerNotification();
      } else if (this.isGroupUpdate()) {
        this.propsForGroupNotification = this.getPropsForGroupNotification();
      } else if (this.isGroupInvitation()) {
        this.propsForGroupInvitation = this.getPropsForGroupInvitation();
      } else {
        this.propsForSearchResult = this.getPropsForSearchResult();
        this.propsForMessage = this.getPropsForMessage();
      }
      if (triggerEvent) {
        window.Whisper.events.trigger('messageChanged', this);
      }
    };
    this.on('change', generateProps);
    window.contextMenuShown = false;

    generateProps(false);
  }

  public idForLogging() {
    return `${this.get('source')} ${this.get('sent_at')}`;
  }

  public isExpirationTimerUpdate() {
    const expirationTimerFlag =
      SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
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
      this.set({ unread: false });
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
      } else if (groupUpdate.left) {
        return window.i18n(
          'leftTheGroup',
          ConversationController.getInstance().getContactProfileNameOrShortenedPubKey(
            groupUpdate.left
          )
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
          ConversationController.getInstance().getContactProfileNameOrFullPubKey(
            pubKey
          )
        );

        if (names.length > 1) {
          messages.push(
            window.i18n('multipleJoinedTheGroup', names.join(', '))
          );
        } else {
          messages.push(window.i18n('joinedTheGroup', names[0]));
        }
      }

      if (groupUpdate.kicked && groupUpdate.kicked.length) {
        const names = _.map(
          groupUpdate.kicked,
          ConversationController.getInstance()
            .getContactProfileNameOrShortenedPubKey
        );

        if (names.length > 1) {
          messages.push(
            window.i18n('multipleKickedFromTheGroup', names.join(', '))
          );
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
      return `<${window.i18n('groupInvitation')}>`;
    }
    return this.get('body');
  }

  public isGroupInvitation() {
    return !!this.get('groupInvitation');
  }

  public getNotificationText() {
    let description = this.getDescription();
    if (description) {
      // regex with a 'g' to ignore part groups
      const regex = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');
      const pubkeysInDesc = description.match(regex);
      (pubkeysInDesc || []).forEach((pubkey: string) => {
        const displayName = ConversationController.getInstance().getContactProfileNameOrShortenedPubKey(
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
        window.Whisper.ExpirationTimerOptions.getAbbreviated(
          expireTimerUpdate.expireTimer || 0
        )
      );
    }
    const contacts = this.get('contact');
    if (contacts && contacts.length) {
      return window.Signal.Types.Contact.getName(contacts[0]);
    }

    return '';
  }

  public onDestroy() {
    void this.cleanup();
  }

  public async cleanup() {
    MessageController.getInstance().unregister(this.id);
    await window.Signal.Migrations.deleteExternalMessageFiles(this.attributes);
  }

  public getPropsForTimerNotification() {
    const timerUpdate = this.get('expirationTimerUpdate');
    if (!timerUpdate) {
      return null;
    }

    const { expireTimer, fromSync, source } = timerUpdate;
    const timespan = window.Whisper.ExpirationTimerOptions.getName(
      expireTimer || 0
    );
    const disabled = !expireTimer;

    const basicProps = {
      type: 'fromOther',
      ...this.findAndFormatContact(source),
      timespan,
      disabled,
    };

    if (fromSync) {
      return {
        ...basicProps,
        type: 'fromSync',
      };
    } else if (UserUtils.isUsFromCache(source)) {
      return {
        ...basicProps,
        type: 'fromMe',
      };
    }

    return basicProps;
  }

  public getPropsForGroupInvitation() {
    const invitation = this.get('groupInvitation');

    let direction = this.get('direction');
    if (!direction) {
      direction = this.get('type') === 'outgoing' ? 'outgoing' : 'incoming';
    }

    return {
      serverName: invitation.serverName,
      serverAddress: invitation.serverAddress,
      direction,
      onClick: () => {
        window.Whisper.events.trigger(
          'publicChatInvitationAccepted',
          invitation.serverAddress,
          invitation.channelId
        );
      },
    };
  }

  public findContact(pubkey: string) {
    return ConversationController.getInstance().get(pubkey);
  }

  public findAndFormatContact(pubkey: string) {
    const contactModel = this.findContact(pubkey);
    let profileName;
    if (pubkey === window.storage.get('primaryDevicePubKey')) {
      profileName = window.i18n('you');
    } else {
      profileName = contactModel ? contactModel.getProfileName() : null;
    }

    return {
      phoneNumber: pubkey,
      color: null,
      avatarPath: contactModel ? contactModel.getAvatarPath() : null,
      name: contactModel ? contactModel.getName() : null,
      profileName,
      title: contactModel ? contactModel.getTitle() : null,
    };
  }

  public getPropsForGroupNotification() {
    const groupUpdate = this.get('group_update');
    const changes = [];

    if (!groupUpdate.name && !groupUpdate.left && !groupUpdate.joined) {
      changes.push({
        type: 'general',
      });
    }

    if (groupUpdate.joined) {
      changes.push({
        type: 'add',
        contacts: _.map(
          Array.isArray(groupUpdate.joined)
            ? groupUpdate.joined
            : [groupUpdate.joined],
          phoneNumber => this.findAndFormatContact(phoneNumber)
        ),
      });
    }

    if (groupUpdate.kicked === 'You') {
      changes.push({
        type: 'kicked',
        isMe: true,
      });
    } else if (groupUpdate.kicked) {
      changes.push({
        type: 'kicked',
        contacts: _.map(
          Array.isArray(groupUpdate.kicked)
            ? groupUpdate.kicked
            : [groupUpdate.kicked],
          phoneNumber => this.findAndFormatContact(phoneNumber)
        ),
      });
    }

    if (groupUpdate.left === 'You') {
      changes.push({
        type: 'remove',
        isMe: true,
      });
    } else if (groupUpdate.left) {
      if (
        Array.isArray(groupUpdate.left) &&
        groupUpdate.left.length === 1 &&
        groupUpdate.left[0] === UserUtils.getOurPubKeyStrFromCache()
      ) {
        changes.push({
          type: 'remove',
          isMe: true,
        });
      } else {
        changes.push({
          type: 'remove',
          contacts: _.map(
            Array.isArray(groupUpdate.left)
              ? groupUpdate.left
              : [groupUpdate.left],
            phoneNumber => this.findAndFormatContact(phoneNumber)
          ),
        });
      }
    }

    if (groupUpdate.name) {
      changes.push({
        type: 'name',
        newName: groupUpdate.name,
      });
    }

    return {
      changes,
    };
  }

  public getMessagePropStatus() {
    if (this.hasErrors()) {
      return 'error';
    }

    // Only return the status on outgoing messages
    if (!this.isOutgoing()) {
      return null;
    }

    const readBy = this.get('read_by') || [];
    if (window.storage.get('read-receipt-setting') && readBy.length > 0) {
      return 'read';
    }
    const delivered = this.get('delivered');
    const deliveredTo = this.get('delivered_to') || [];
    if (delivered || deliveredTo.length > 0) {
      return 'delivered';
    }
    const sent = this.get('sent');
    const sentTo = this.get('sent_to') || [];
    if (sent || sentTo.length > 0) {
      return 'sent';
    }
    const calculatingPoW = this.get('calculatingPoW');
    if (calculatingPoW) {
      return 'pow';
    }

    return 'sending';
  }

  public getPropsForSearchResult() {
    const fromNumber = this.getSource();
    const from = this.findAndFormatContact(fromNumber);
    if (fromNumber === UserUtils.getOurPubKeyStrFromCache()) {
      (from as any).isMe = true;
    }

    const toNumber = this.get('conversationId');
    let to = this.findAndFormatContact(toNumber) as any;
    if (toNumber === UserUtils.getOurPubKeyStrFromCache()) {
      to.isMe = true;
    } else if (fromNumber === toNumber) {
      to = {
        isMe: true,
      };
    }

    return {
      from,
      to,

      // isSelected: this.isSelected,

      id: this.id,
      conversationId: this.get('conversationId'),
      receivedAt: this.get('received_at'),
      snippet: this.get('snippet'),
    };
  }

  public getPropsForMessage(options: any = {}) {
    const phoneNumber = this.getSource();
    const contact = this.findAndFormatContact(phoneNumber);
    const contactModel = this.findContact(phoneNumber);

    const authorAvatarPath = contactModel ? contactModel.getAvatarPath() : null;

    const expirationLength = this.get('expireTimer') * 1000;
    const expireTimerStart = this.get('expirationStartTimestamp');
    const expirationTimestamp =
      expirationLength && expireTimerStart
        ? expireTimerStart + expirationLength
        : null;

    // TODO: investigate why conversation is undefined
    // for the public group chat
    const conversation = this.getConversation();

    const convoId = conversation ? conversation.id : undefined;
    const isGroup = !!conversation && !conversation.isPrivate();
    const isPublic = !!this.get('isPublic');

    const attachments = this.get('attachments') || [];

    return {
      text: this.createNonBreakingLastSeparator(this.get('body')),
      id: this.id,
      direction: this.isIncoming() ? 'incoming' : 'outgoing',
      timestamp: this.get('sent_at'),
      serverTimestamp: this.get('serverTimestamp'),
      status: this.getMessagePropStatus(),
      authorName: contact.name,
      authorProfileName: contact.profileName,
      authorPhoneNumber: contact.phoneNumber,
      conversationType: isGroup ? 'group' : 'direct',
      convoId,
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
      isKickedFromGroup: conversation && conversation.get('isKickedFromGroup'),

      onCopyText: this.copyText,
      onCopyPubKey: this.copyPubKey,
      onBanUser: this.banUser,
      onRetrySend: this.retrySend,
      markRead: this.markRead,

      onShowUserDetails: (pubkey: string) =>
        window.Whisper.events.trigger('onShowUserDetails', {
          userPubKey: pubkey,
        }),
    };
  }

  public createNonBreakingLastSeparator(text?: string) {
    if (!text) {
      return null;
    }

    const nbsp = '\xa0';
    const regex = /(\S)( +)(\S+\s*)$/;
    return text.replace(regex, (_match, start, spaces, end) => {
      const newSpaces =
        end.length < 12
          ? _.reduce(spaces, accumulator => accumulator + nbsp, '')
          : spaces;
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
      let image = null;
      try {
        if (preview.image) {
          image = this.getPropsForAttachment(preview.image);
        }
      } catch (e) {
        window.log.info('Failed to show preview');
      }

      return {
        ...preview,
        domain: window.Signal.LinkPreviews.getDomain(preview.url),
        image,
      };
    });
  }

  public getPropsForQuote(options: any = {}) {
    const { noClick } = options;
    const quote = this.get('quote');

    if (!quote) {
      return null;
    }

    const { author, id, referencedMessageNotFound } = quote;
    const contact = author && ConversationController.getInstance().get(author);

    const authorName = contact ? contact.getName() : null;
    const isFromMe = contact
      ? contact.id === UserUtils.getOurPubKeyStrFromCache()
      : false;
    const onClick = noClick
      ? null
      : (event: any) => {
          event.stopPropagation();
          this.trigger('scroll-to-message', {
            author,
            id,
            referencedMessageNotFound,
          });
        };

    const firstAttachment = quote.attachments && quote.attachments[0];

    return {
      text: this.createNonBreakingLastSeparator(quote.text),
      attachment: firstAttachment
        ? this.processQuoteAttachment(firstAttachment)
        : null,
      isFromMe,
      authorPhoneNumber: author,
      messageId: id,
      authorName,
      onClick,
      referencedMessageNotFound,
    };
  }

  public getPropsForAttachment(attachment: any) {
    if (!attachment) {
      return null;
    }

    const { path, pending, flags, size, screenshot, thumbnail } = attachment;

    return {
      ...attachment,
      fileSize: size ? filesize(size) : null,
      isVoiceMessage:
        flags &&
        // eslint-disable-next-line no-bitwise
        // tslint:disable-next-line: no-bitwise
        flags & SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
      pending,
      url: path
        ? window.Signal.Migrations.getAbsoluteAttachmentPath(path)
        : null,
      screenshot: screenshot
        ? {
            ...screenshot,
            url: window.Signal.Migrations.getAbsoluteAttachmentPath(
              screenshot.path
            ),
          }
        : null,
      thumbnail: thumbnail
        ? {
            ...thumbnail,
            url: window.Signal.Migrations.getAbsoluteAttachmentPath(
              thumbnail.path
            ),
          }
        : null,
    };
  }

  public async getPropsForMessageDetail() {
    const newIdentity = window.i18n('newIdentity');

    // We include numbers we didn't successfully send to so we can display errors.
    // Older messages don't have the recipients included on the message, so we fall
    //   back to the conversation's current recipients
    const phoneNumbers = this.isIncoming()
      ? [this.get('source')]
      : _.union(
          this.get('sent_to') || [],
          this.get('recipients') ||
            this.getConversation()?.getRecipients() ||
            []
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

    return {
      sentAt: this.get('sent_at'),
      receivedAt: this.get('received_at'),
      message: {
        ...this.propsForMessage,
        disableMenu: true,
        // To ensure that group avatar doesn't show up
        conversationType: 'direct',
      },
      errors,
      contacts: sortedContacts,
    };
  }

  public copyPubKey() {
    if (this.isIncoming()) {
      window.clipboard.writeText(this.get('source'));
    } else {
      window.clipboard.writeText(UserUtils.getOurPubKeyStrFromCache());
    }

    ToastUtils.pushCopiedToClipBoard();
  }

  public banUser() {
    window.confirmationDialog({
      title: window.i18n('banUser'),
      message: window.i18n('banUserConfirm'),
      resolve: async () => {
        const source = this.get('source');
        const conversation = this.getConversation();
        if (!conversation) {
          window.log.info(
            'cannot ban user, the corresponding conversation was not found.'
          );
          return;
        }

        const channelAPI = await conversation.getPublicSendData();
        if (!channelAPI) {
          window.log.info(
            'cannot ban user, the corresponding channelAPI was not found.'
          );
          return;
        }
        const success = await channelAPI.banUser(source);

        if (success) {
          ToastUtils.pushUserBanSuccess();
        } else {
          ToastUtils.pushUserBanFailure();
        }
      },
    });
  }

  public copyText() {
    window.clipboard.writeText(this.get('body'));

    ToastUtils.pushCopiedToClipBoard();
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
      (this.get('attachments') || []).map(
        window.Signal.Migrations.loadAttachmentData
      )
    );
    const body = this.get('body');
    const finalAttachments = attachmentsWithData;

    const filenameOverridenAttachments = finalAttachments.map(
      (attachment: any) => ({
        ...attachment,
        fileName: window.Signal.Types.Attachment.getSuggestedFilenameSending({
          attachment,
          timestamp: Date.now(),
        }),
      })
    );

    const quoteWithData = await window.Signal.Migrations.loadQuoteData(
      this.get('quote')
    );
    const previewWithData = await window.Signal.Migrations.loadPreviewData(
      this.get('preview')
    );

    const conversation = this.getConversation();
    const openGroup =
      (conversation && conversation.isPublic() && conversation.toOpenGroup()) ||
      undefined;

    const { AttachmentUtils } = Utils;
    const [attachments, preview, quote] = await Promise.all([
      AttachmentUtils.uploadAttachments(
        filenameOverridenAttachments,
        openGroup
      ),
      AttachmentUtils.uploadLinkPreviews(previewWithData, openGroup),
      AttachmentUtils.uploadQuoteThumbnails(quoteWithData, openGroup),
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
      window.log.error('retrySend: Cannot retry since we are offline!');
      return null;
    }

    this.set({ errors: null });
    await this.commit();
    try {
      const conversation:
        | ConversationModel
        | undefined = this.getConversation();
      if (!conversation) {
        window.log.info(
          'cannot retry send message, the corresponding conversation was not found.'
        );
        return;
      }

      if (conversation.isPublic()) {
        const openGroup = {
          server: conversation.get('server'),
          channel: conversation.get('channelId'),
          conversationId: conversation.id,
        };
        const uploaded = await this.uploadData();

        const openGroupParams = {
          identifier: this.id,
          timestamp: Date.now(),
          group: openGroup,
          ...uploaded,
        };
        const openGroupMessage = new OpenGroupMessage(openGroupParams);
        return getMessageQueue().sendToOpenGroup(openGroupMessage);
      }

      const { body, attachments, preview, quote } = await this.uploadData();
      const ourNumber = UserUtils.getOurPubKeyStrFromCache();
      const ourConversation = ConversationController.getInstance().get(
        ourNumber
      );

      const chatParams = {
        identifier: this.id,
        body,
        timestamp: this.get('sent_at') || Date.now(),
        expireTimer: this.get('expireTimer'),
        attachments,
        preview,
        quote,
        lokiProfile:
          (ourConversation && ourConversation.getOurProfile()) || undefined,
      };
      if (!chatParams.lokiProfile) {
        delete chatParams.lokiProfile;
      }

      const chatMessage = new ChatMessage(chatParams);

      // Special-case the self-send case - we send only a sync message
      if (conversation.isMe()) {
        return this.sendSyncMessageOnly(chatMessage);
      }

      if (conversation.isPrivate()) {
        return getMessageQueue().sendToPubKey(
          PubKey.cast(conversation.id),
          chatMessage
        );
      }

      // Here, the convo is neither an open group, a private convo or ourself. It can only be a medium group.
      // For a medium group, retry send only means trigger a send again to all recipients
      // as they are all polling from the same group swarm pubkey
      if (!conversation.isMediumGroup()) {
        throw new Error(
          'We should only end up with a medium group here. Anything else is an error'
        );
      }

      const closedGroupChatMessage = new ClosedGroupChatMessage({
        identifier: this.id,
        chatMessage,
        groupId: this.get('conversationId'),
      });

      return getMessageQueue().sendToGroup(closedGroupChatMessage);
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
    return ConversationController.getInstance().getUnsafe(
      this.get('conversationId')
    );
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

    return ConversationController.getInstance().get(author);
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

    return ConversationController.getInstance().getOrCreate(source, 'private');
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
    const deliveredTo = this.get('delivered_to') || [];
    if (deliveredTo.indexOf(pubkey) >= 0) {
      return 'delivered';
    }
    const sentTo = this.get('sent_to') || [];
    if (sentTo.indexOf(pubkey) >= 0) {
      return 'sent';
    }

    return null;
  }

  public async setCalculatingPoW() {
    if (this.get('calculatingPoW')) {
      return;
    }

    this.set({
      calculatingPoW: true,
    });

    await this.commit();
  }

  public async sendSyncMessageOnly(dataMessage: any) {
    const now = Date.now();
    this.set({
      sent_to: [UserUtils.getOurPubKeyStrFromCache()],
      sent: true,
      expirationStartTimestamp: now,
    });

    await this.commit();

    const data =
      dataMessage instanceof DataMessage
        ? dataMessage.dataProto()
        : dataMessage;
    await this.sendSyncMessage(data, now);
  }

  public async sendSyncMessage(
    dataMessage: SignalService.DataMessage,
    sentTimestamp: number
  ) {
    if (this.get('synced') || this.get('sentSync')) {
      return;
    }

    // if this message needs to be synced
    if (
      (dataMessage.body && dataMessage.body.length) ||
      dataMessage.attachments.length
    ) {
      const conversation = this.getConversation();
      if (!conversation) {
        throw new Error('Cannot trigger syncMessage with unknown convo.');
      }
      const syncMessage = ChatMessage.buildSyncMessage(
        dataMessage,
        conversation.id,
        sentTimestamp
      );
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
      window.log.error(
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
    const id = await saveMessage(this.attributes);
    this.trigger('change');
    return id;
  }

  public async markRead(readAt: number) {
    this.set({ unread: false });

    if (this.get('expireTimer') && !this.get('expirationStartTimestamp')) {
      const expirationStartTimestamp = Math.min(
        Date.now(),
        readAt || Date.now()
      );
      this.set({ expirationStartTimestamp });
    }

    window.Whisper.Notifications.remove(
      window.Whisper.Notifications.where({
        messageId: this.id,
      })
    );

    await this.commit();
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

      window.log.info('Set message expiration', {
        expiresAt,
        sentAt: this.get('sent_at'),
      });
    }
  }
}
export class MessageCollection extends Backbone.Collection<MessageModel> {}

MessageCollection.prototype.model = MessageModel;
