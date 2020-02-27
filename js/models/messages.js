/* global
  _,
  Backbone,
  storage,
  filesize,
  ConversationController,
  MessageController,
  getAccountManager,
  i18n,
  Signal,
  textsecure,
  Whisper,
  clipboard,
  libloki,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { Message: TypedMessage, Contact, PhoneNumber, Errors } = Signal.Types;

  const {
    deleteExternalMessageFiles,
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    loadQuoteData,
    loadPreviewData,
    upgradeMessageSchema,
  } = window.Signal.Migrations;
  const { bytesFromString } = window.Signal.Crypto;

  window.AccountCache = Object.create(null);
  window.AccountJobs = Object.create(null);

  window.doesAcountCheckJobExist = number =>
    Boolean(window.AccountJobs[number]);
  window.checkForSignalAccount = number => {
    if (window.AccountJobs[number]) {
      return window.AccountJobs[number];
    }

    let job;
    if (textsecure.messaging) {
      // eslint-disable-next-line more/no-then
      job = textsecure.messaging
        .getProfile(number)
        .then(() => {
          window.AccountCache[number] = true;
        })
        .catch(() => {
          window.AccountCache[number] = false;
        });
    } else {
      // We're offline!
      job = Promise.resolve().then(() => {
        window.AccountCache[number] = false;
      });
    }

    window.AccountJobs[number] = job;

    return job;
  };

  window.isSignalAccountCheckComplete = number =>
    window.AccountCache[number] !== undefined;
  window.hasSignalAccount = number => window.AccountCache[number];

  window.Whisper.Message = Backbone.Model.extend({
    initialize(attributes) {
      if (_.isObject(attributes)) {
        this.set(
          TypedMessage.initializeSchemaVersion({
            message: attributes,
            logger: window.log,
          })
        );
      }

      this.OUR_NUMBER = textsecure.storage.user.getNumber();

      this.on('destroy', this.onDestroy);
      this.on('change:expirationStartTimestamp', this.setToExpire);
      this.on('change:expireTimer', this.setToExpire);
      this.on('unload', this.unload);
      this.on('expired', this.onExpired);
      this.setToExpire();
      // Keep props ready
      const generateProps = () => {
        if (this.isExpirationTimerUpdate()) {
          this.propsForTimerNotification = this.getPropsForTimerNotification();
        } else if (this.isKeyChange()) {
          this.propsForSafetyNumberNotification = this.getPropsForSafetyNumberNotification();
        } else if (this.isVerifiedChange()) {
          this.propsForVerificationNotification = this.getPropsForVerificationNotification();
        } else if (this.isEndSession()) {
          this.propsForResetSessionNotification = this.getPropsForResetSessionNotification();
        } else if (this.isGroupUpdate()) {
          this.propsForGroupNotification = this.getPropsForGroupNotification();
        } else if (this.isSessionRestoration()) {
          // do nothing
        } else if (this.isFriendRequest()) {
          this.propsForFriendRequest = this.getPropsForFriendRequest();
        } else if (this.isGroupInvitation()) {
          this.propsForGroupInvitation = this.getPropsForGroupInvitation();
        } else {
          this.propsForSearchResult = this.getPropsForSearchResult();
          this.propsForMessage = this.getPropsForMessage();
        }
      };
      this.on('change', generateProps);

      const applicableConversationChanges =
        'change:color change:name change:number change:profileName change:profileAvatar';

      const conversation = this.getConversation();
      const fromContact = this.getIncomingContact();

      this.listenTo(conversation, applicableConversationChanges, generateProps);
      if (fromContact) {
        this.listenTo(
          fromContact,
          applicableConversationChanges,
          generateProps
        );
      }

      this.selected = false;
      window.contextMenuShown = false;

      generateProps();
    },
    idForLogging() {
      return `${this.get('source')}.${this.get('sourceDevice')} ${this.get(
        'sent_at'
      )}`;
    },
    defaults() {
      return {
        timestamp: new Date().getTime(),
        attachments: [],
        sent: false,
      };
    },
    validate(attributes) {
      const required = ['conversationId', 'received_at', 'sent_at'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) {
        window.log.warn(`Message missing attributes: ${missing}`);
      }
    },
    isEndSession() {
      const flag = textsecure.protobuf.DataMessage.Flags.END_SESSION;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & flag);
    },
    getEndSessionTranslationKey() {
      const sessionType = this.get('endSessionType');
      if (sessionType === 'ongoing') {
        return 'sessionResetOngoing';
      } else if (sessionType === 'failed') {
        return 'sessionResetFailed';
      }
      return 'sessionEnded';
    },
    isExpirationTimerUpdate() {
      const flag =
        textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & flag);
    },
    isGroupUpdate() {
      return !!this.get('group_update');
    },
    isIncoming() {
      return this.get('type') === 'incoming';
    },
    isUnread() {
      return !!this.get('unread');
    },
    // Important to allow for this.unset('unread'), save to db, then fetch()
    // to propagate. We don't want the unset key in the db so our unread index
    // stays small.
    merge(model) {
      const attributes = model.attributes || model;

      const { unread } = attributes;
      if (typeof unread === 'undefined') {
        this.unset('unread');
      }

      this.set(attributes);
    },
    getNameForNumber(number) {
      const conversation = ConversationController.get(number);
      if (!conversation) {
        return number;
      }
      return conversation.getDisplayName();
    },
    getLokiNameForNumber(number) {
      const conversation = ConversationController.get(number);
      if (!conversation || !conversation.getLokiProfile()) {
        return number;
      }
      return conversation.getLokiProfile().displayName;
    },
    getDescription() {
      if (this.isGroupUpdate()) {
        const groupUpdate = this.get('group_update');
        if (groupUpdate.left === 'You') {
          return i18n('youLeftTheGroup');
        } else if (groupUpdate.left) {
          return i18n('leftTheGroup', this.getNameForNumber(groupUpdate.left));
        }

        if (groupUpdate.kicked === 'You') {
          return i18n('youGotKickedFromGroup');
        }

        const messages = [];
        if (!groupUpdate.name && !groupUpdate.joined && !groupUpdate.kicked) {
          messages.push(i18n('updatedTheGroup'));
        }
        if (groupUpdate.name) {
          messages.push(i18n('titleIsNow', groupUpdate.name));
        }
        if (groupUpdate.joined && groupUpdate.joined.length) {
          const names = groupUpdate.joined.map(name =>
            this.getLokiNameForNumber(name)
          );

          if (names.length > 1) {
            messages.push(i18n('multipleJoinedTheGroup', names.join(', ')));
          } else {
            messages.push(i18n('joinedTheGroup', names[0]));
          }
        }

        if (groupUpdate.kicked && groupUpdate.kicked.length) {
          const names = _.map(
            groupUpdate.kicked,
            this.getNameForNumber.bind(this)
          );

          if (names.length > 1) {
            messages.push(i18n('multipleKickedFromTheGroup', names.join(', ')));
          } else {
            messages.push(i18n('kickedFromTheGroup', names[0]));
          }
        }
        return messages.join(', ');
      }
      if (this.isEndSession()) {
        return i18n(this.getEndSessionTranslationKey());
      }
      if (this.isIncoming() && this.hasErrors()) {
        return i18n('incomingError');
      }
      if (this.isGroupInvitation()) {
        return `<${i18n('groupInvitation')}>`;
      }
      return this.get('body');
    },
    isVerifiedChange() {
      return this.get('type') === 'verified-change';
    },
    isKeyChange() {
      return this.get('type') === 'keychange';
    },
    isFriendRequest() {
      return this.get('type') === 'friend-request';
    },
    isGroupInvitation() {
      return !!this.get('groupInvitation');
    },
    isSessionRestoration() {
      const flag = textsecure.protobuf.DataMessage.Flags.SESSION_RESTORE;
      // eslint-disable-next-line no-bitwise
      const sessionRestoreFlag = !!(this.get('flags') & flag);

      return !!this.get('sessionRestoration') || sessionRestoreFlag;
    },
    getNotificationText() {
      const description = this.getDescription();
      if (description) {
        if (this.isFriendRequest()) {
          return `Friend Request: ${description}`;
        }
        return description;
      }
      if (this.get('attachments').length > 0) {
        return i18n('mediaMessage');
      }
      if (this.isExpirationTimerUpdate()) {
        const { expireTimer } = this.get('expirationTimerUpdate');
        if (!expireTimer) {
          return i18n('disappearingMessagesDisabled');
        }

        return i18n(
          'timerSetTo',
          Whisper.ExpirationTimerOptions.getAbbreviated(expireTimer || 0)
        );
      }
      if (this.isKeyChange()) {
        const phoneNumber = this.get('key_changed');
        const conversation = this.findContact(phoneNumber);
        return i18n(
          'safetyNumberChangedGroup',
          conversation ? conversation.getTitle() : null
        );
      }
      const contacts = this.get('contact');
      if (contacts && contacts.length) {
        return Contact.getName(contacts[0]);
      }

      return '';
    },
    onDestroy() {
      this.cleanup();
    },
    async cleanup() {
      MessageController.unregister(this.id);
      this.unload();
      await deleteExternalMessageFiles(this.attributes);
    },
    unload() {
      if (this.quotedMessage) {
        this.quotedMessage = null;
      }
    },
    onExpired() {
      this.hasExpired = true;
    },
    getPropsForTimerNotification() {
      const timerUpdate = this.get('expirationTimerUpdate');
      if (!timerUpdate) {
        return null;
      }

      const { expireTimer, fromSync, source } = timerUpdate;
      const timespan = Whisper.ExpirationTimerOptions.getName(expireTimer || 0);
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
      } else if (source === this.OUR_NUMBER) {
        return {
          ...basicProps,
          type: 'fromMe',
        };
      }

      return basicProps;
    },
    getPropsForSafetyNumberNotification() {
      const conversation = this.getConversation();
      const isGroup = conversation && !conversation.isPrivate();
      const phoneNumber = this.get('key_changed');
      const onVerify = () =>
        this.trigger('show-identity', this.findContact(phoneNumber));

      return {
        isGroup,
        contact: this.findAndFormatContact(phoneNumber),
        onVerify,
      };
    },
    getPropsForVerificationNotification() {
      const type = this.get('verified') ? 'markVerified' : 'markNotVerified';
      const isLocal = this.get('local');
      const phoneNumber = this.get('verifiedChanged');

      return {
        type,
        isLocal,
        contact: this.findAndFormatContact(phoneNumber),
      };
    },
    getPropsForResetSessionNotification() {
      return {
        sessionResetMessageKey: this.getEndSessionTranslationKey(),
      };
    },

    async acceptFriendRequest() {
      if (this.get('friendStatus') !== 'pending') {
        return;
      }
      const conversation = await this.getSourceDeviceConversation();
      // If we somehow received an old friend request (e.g. after having restored
      // from seed, we won't be able to accept it, we should initiate our own
      // friend request to reset the session:
      if (conversation.get('sessionRestoreSeen')) {
        conversation.sendMessage('', null, null, null, null, {
          sessionRestoration: true,
        });
        return;
      }
      this.set({ friendStatus: 'accepted' });
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
      conversation.onAcceptFriendRequest();
    },
    async declineFriendRequest() {
      if (this.get('friendStatus') !== 'pending') {
        return;
      }
      const conversation = this.getConversation();

      this.set({ friendStatus: 'declined' });
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
      conversation.onDeclineFriendRequest();
    },
    getPropsForFriendRequest() {
      const friendStatus = this.get('friendStatus') || 'pending';
      const direction = this.get('direction') || 'incoming';
      const conversation = this.getConversation();

      const onAccept = () => this.acceptFriendRequest();
      const onDecline = () => this.declineFriendRequest();
      const onRetrySend = () => this.retrySend();

      const onDeleteConversation = async () => {
        // Delete the whole conversation
        window.Whisper.events.trigger('deleteConversation', conversation);
      };

      const onBlockUser = () => {
        conversation.block();
        this.trigger('change');
      };

      const onUnblockUser = () => {
        conversation.unblock();
        this.trigger('change');
      };

      return {
        text: this.createNonBreakingLastSeparator(this.get('body')),
        timestamp: this.get('sent_at'),
        status: this.getMessagePropStatus(),
        direction,
        friendStatus,
        isBlocked: conversation.isBlocked(),
        onAccept,
        onDecline,
        onDeleteConversation,
        onBlockUser,
        onUnblockUser,
        onRetrySend,
      };
    },
    getPropsForGroupInvitation() {
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
          Whisper.events.trigger(
            'publicChatInvitationAccepted',
            invitation.serverAddress,
            invitation.channelId
          );
        },
      };
    },
    findContact(phoneNumber) {
      return ConversationController.get(phoneNumber);
    },
    findAndFormatContact(phoneNumber) {
      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');

      const contactModel = this.findContact(phoneNumber);
      const color = contactModel ? contactModel.getColor() : null;

      return {
        phoneNumber: format(phoneNumber, {
          ourRegionCode: regionCode,
        }),
        color,
        avatarPath: contactModel ? contactModel.getAvatarPath() : null,
        name: contactModel ? contactModel.getName() : null,
        profileName: contactModel ? contactModel.getProfileName() : null,
        title: contactModel ? contactModel.getTitle() : null,
      };
    },
    getPropsForGroupNotification() {
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

      if (groupUpdate.name) {
        changes.push({
          type: 'name',
          newName: groupUpdate.name,
        });
      }

      return {
        changes,
      };
    },
    getMessagePropStatus() {
      if (this.hasErrors()) {
        return 'error';
      }

      // Handle friend request statuses
      const isFriendRequest = this.isFriendRequest();
      const isOutgoingFriendRequest =
        isFriendRequest && this.get('direction') === 'outgoing';
      const isOutgoing = this.isOutgoing() || isOutgoingFriendRequest;

      // Only return the status on outgoing messages
      if (!isOutgoing) {
        return null;
      }

      const readBy = this.get('read_by') || [];
      if (storage.get('read-receipt-setting') && readBy.length > 0) {
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
    },
    getPropsForSearchResult() {
      const fromNumber = this.getSource();
      const from = this.findAndFormatContact(fromNumber);
      if (fromNumber === this.OUR_NUMBER) {
        from.isMe = true;
      }

      const toNumber = this.get('conversationId');
      let to = this.findAndFormatContact(toNumber);
      if (toNumber === this.OUR_NUMBER) {
        to.isMe = true;
      } else if (fromNumber === toNumber) {
        to = {
          isMe: true,
        };
      }

      return {
        from,
        to,

        isSelected: this.isSelected,

        id: this.id,
        conversationId: this.get('conversationId'),
        receivedAt: this.get('received_at'),
        snippet: this.get('snippet'),
      };
    },
    getPropsForMessage(options) {
      const phoneNumber = this.getSource();
      const contact = this.findAndFormatContact(phoneNumber);
      const contactModel = this.findContact(phoneNumber);

      const authorColor = contactModel ? contactModel.getColor() : null;
      const authorAvatarPath = contactModel
        ? contactModel.getAvatarPath()
        : null;

      const expirationLength = this.get('expireTimer') * 1000;
      const expireTimerStart = this.get('expirationStartTimestamp');
      const expirationTimestamp =
        expirationLength && expireTimerStart
          ? expireTimerStart + expirationLength
          : null;

      // TODO: investigate why conversation is undefined
      // for the public group chat
      const conversation = this.getConversation();

      const isModerator =
        conversation && !!conversation.isModerator(this.OUR_NUMBER);

      const convoId = conversation ? conversation.id : undefined;
      const isGroup = !!conversation && !conversation.isPrivate();

      const attachments = this.get('attachments') || [];
      const firstAttachment = attachments[0];

      return {
        text: this.createNonBreakingLastSeparator(this.get('body')),
        textPending: this.get('bodyPending'),
        id: this.id,
        direction: this.isIncoming() ? 'incoming' : 'outgoing',
        timestamp: this.get('sent_at'),
        status: this.getMessagePropStatus(),
        contact: this.getPropsForEmbeddedContact(),
        authorColor,
        authorName: contact.name,
        authorProfileName: contact.profileName,
        authorPhoneNumber: contact.phoneNumber,
        conversationType: isGroup ? 'group' : 'direct',
        convoId,
        attachments: attachments
          .filter(attachment => !attachment.error)
          .map(attachment => this.getPropsForAttachment(attachment)),
        previews: this.getPropsForPreview(),
        quote: this.getPropsForQuote(options),
        authorAvatarPath,
        isExpired: this.hasExpired,
        expirationLength,
        expirationTimestamp,
        selected: this.selected,
        multiSelectMode: conversation && conversation.selectedMessages.size > 0,
        isPublic: !!this.get('isPublic'),
        isRss: !!this.get('isRss'),
        senderIsModerator:
          !!this.get('isPublic') &&
          conversation &&
          conversation.isModerator(phoneNumber),
        isDeletable:
          !this.get('isPublic') ||
          isModerator ||
          phoneNumber === this.OUR_NUMBER,
        isModerator,

        onCopyText: () => this.copyText(),
        onSelectMessage: () => this.selectMessage(),
        onSelectMessageUnchecked: () => this.selectMessageUnchecked(),
        onCopyPubKey: () => this.copyPubKey(),
        onBanUser: () => this.banUser(),
        onReply: () => this.trigger('reply', this),
        onRetrySend: () => this.retrySend(),
        onShowDetail: () => this.trigger('show-message-detail', this),
        onDelete: () => this.trigger('delete', this),
        onClickLinkPreview: url => this.trigger('navigate-to', url),
        onClickAttachment: attachment =>
          this.trigger('show-lightbox', {
            attachment,
            message: this,
          }),

        onDownload: isDangerous =>
          this.trigger('download', {
            attachment: firstAttachment,
            message: this,
            isDangerous,
          }),
        onShowUserDetails: pubkey =>
          window.Whisper.events.trigger('onShowUserDetails', {
            userPubKey: pubkey,
          }),
      };
    },
    createNonBreakingLastSeparator(text) {
      if (!text) {
        return null;
      }

      const nbsp = '\xa0';
      const regex = /(\S)( +)(\S+\s*)$/;
      return text.replace(regex, (match, start, spaces, end) => {
        const newSpaces =
          end.length < 12
            ? _.reduce(spaces, accumulator => accumulator + nbsp, '')
            : spaces;
        return `${start}${newSpaces}${end}`;
      });
    },
    getPropsForEmbeddedContact() {
      const regionCode = storage.get('regionCode');
      const { contactSelector } = Contact;

      const contacts = this.get('contact');
      if (!contacts || !contacts.length) {
        return null;
      }

      const contact = contacts[0];
      const firstNumber =
        contact.number && contact.number[0] && contact.number[0].value;
      const onSendMessage = firstNumber
        ? () => {
            this.trigger('open-conversation', firstNumber);
          }
        : null;
      const onClick = async () => {
        // First let's be sure that the signal account check is complete.
        await window.checkForSignalAccount(firstNumber);

        this.trigger('show-contact-detail', {
          contact,
          hasSignalAccount: window.hasSignalAccount(firstNumber),
        });
      };

      // Would be nice to do this before render, on initial load of message
      if (!window.isSignalAccountCheckComplete(firstNumber)) {
        window.checkForSignalAccount(firstNumber).then(() => {
          this.trigger('change', this);
        });
      }

      return contactSelector(contact, {
        regionCode,
        getAbsoluteAttachmentPath,
        onSendMessage,
        onClick,
        hasSignalAccount: window.hasSignalAccount(firstNumber),
      });
    },
    processQuoteAttachment(attachment) {
      const { thumbnail } = attachment;
      const path =
        thumbnail &&
        thumbnail.path &&
        getAbsoluteAttachmentPath(thumbnail.path);
      const objectUrl = thumbnail && thumbnail.objectUrl;

      const thumbnailWithObjectUrl =
        !path && !objectUrl
          ? null
          : Object.assign({}, attachment.thumbnail || {}, {
              objectUrl: path || objectUrl,
            });

      return Object.assign({}, attachment, {
        isVoiceMessage: Signal.Types.Attachment.isVoiceMessage(attachment),
        thumbnail: thumbnailWithObjectUrl,
      });
    },
    getPropsForPreview() {
      // Don't generate link previews if user has turned them off
      if (!storage.get('link-preview-setting', false)) {
        return null;
      }

      const previews = this.get('preview') || [];

      return previews.map(preview => {
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
    },
    getPropsForQuote(options = {}) {
      const { noClick } = options;
      const quote = this.get('quote');
      if (!quote) {
        return null;
      }

      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');

      const { author, id, referencedMessageNotFound } = quote;
      const contact = author && ConversationController.get(author);
      const authorColor = contact ? contact.getColor() : 'grey';

      const authorPhoneNumber = format(author, {
        ourRegionCode: regionCode,
      });
      const authorProfileName = contact ? contact.getProfileName() : null;
      const authorName = contact ? contact.getName() : null;
      const isFromMe = contact ? contact.id === this.OUR_NUMBER : false;
      const onClick = noClick
        ? null
        : event => {
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
        authorPhoneNumber,
        authorProfileName,
        authorName,
        authorColor,
        onClick,
        referencedMessageNotFound,
      };
    },
    getPropsForAttachment(attachment) {
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
          flags & textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
        pending,
        url: path ? getAbsoluteAttachmentPath(path) : null,
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
    },
    isUnidentifiedDelivery(contactId, lookup) {
      if (this.isIncoming()) {
        return this.get('unidentifiedDeliveryReceived');
      }

      return Boolean(lookup[contactId]);
    },
    getPropsForMessageDetail() {
      const newIdentity = i18n('newIdentity');
      const OUTGOING_KEY_ERROR = 'OutgoingIdentityKeyError';

      const unidentifiedLookup = (
        this.get('unidentifiedDeliveries') || []
      ).reduce((accumulator, item) => {
        // eslint-disable-next-line no-param-reassign
        accumulator[item] = true;
        return accumulator;
      }, Object.create(null));

      // We include numbers we didn't successfully send to so we can display errors.
      // Older messages don't have the recipients included on the message, so we fall
      //   back to the conversation's current recipients
      const phoneNumbers = this.isIncoming()
        ? [this.get('source')]
        : _.union(
            this.get('sent_to') || [],
            this.get('recipients') || this.getConversation().getRecipients()
          );

      // This will make the error message for outgoing key errors a bit nicer
      const allErrors = (this.get('errors') || []).map(error => {
        if (error.name === OUTGOING_KEY_ERROR) {
          // eslint-disable-next-line no-param-reassign
          error.message = newIdentity;
        }

        return error;
      });

      // If an error has a specific number it's associated with, we'll show it next to
      //   that contact. Otherwise, it will be a standalone entry.
      const errors = _.reject(allErrors, error => Boolean(error.number));
      const errorsGroupedById = _.groupBy(allErrors, 'number');
      const primaryDevicePubKey = this.get('conversationId');
      const finalContacts = (phoneNumbers || []).map(id => {
        const errorsForContact = errorsGroupedById[id];
        const isOutgoingKeyError = Boolean(
          _.find(errorsForContact, error => error.name === OUTGOING_KEY_ERROR)
        );
        const isUnidentifiedDelivery =
          storage.get('unidentifiedDeliveryIndicators') &&
          this.isUnidentifiedDelivery(id, unidentifiedLookup);

        const isPrimaryDevice = id === primaryDevicePubKey;

        const contact = this.findAndFormatContact(id);
        const profileName = isPrimaryDevice
          ? contact.profileName
          : `${contact.profileName} (Secondary Device)`;
        return {
          ...contact,
          status: this.getStatus(id),
          errors: errorsForContact,
          isOutgoingKeyError,
          isUnidentifiedDelivery,
          isPrimaryDevice,
          profileName,
          onSendAnyway: () =>
            this.trigger('force-send', {
              contact: this.findContact(id),
              message: this,
            }),
          onShowSafetyNumber: () =>
            this.trigger('show-identity', this.findContact(id)),
        };
      });

      // The prefix created here ensures that contacts with errors are listed
      //   first; otherwise it's alphabetical
      const sortedContacts = _.sortBy(
        finalContacts,
        contact =>
          `${contact.isPrimaryDevice ? '0' : '1'}${contact.phoneNumber}`
      );

      return {
        sentAt: this.get('sent_at'),
        receivedAt: this.get('received_at'),
        message: {
          ...this.getPropsForMessage({ noClick: true }),
          disableMenu: true,
          // To ensure that group avatar doesn't show up
          conversationType: 'direct',
        },
        errors,
        contacts: sortedContacts,
      };
    },

    copyPubKey() {
      if (this.isIncoming()) {
        clipboard.writeText(this.get('source'));
      } else {
        clipboard.writeText(this.OUR_NUMBER);
      }

      window.pushToast({
        title: i18n('copiedPublicKey'),
        type: 'success',
        id: 'copiedPublicKey',
      });
    },

    banUser() {
      window.confirmationDialog({
        title: i18n('banUser'),
        message: i18n('banUserConfirm'),
        resolve: async () => {
          const source = this.get('source');
          const conversation = this.getConversation();

          const channelAPI = await conversation.getPublicSendData();
          const success = await channelAPI.banUser(source);

          if (success) {
            window.pushToast({
              title: i18n('userBanned'),
              type: 'success',
              id: 'userBanned',
            });
          } else {
            window.pushToast({
              title: i18n('userBanFailed'),
              type: 'error',
              id: 'userBanFailed',
            });
          }
        },
      });
    },

    // Select message even if the context menu is shown
    selectMessageUnchecked() {
      this.selected = !this.selected;

      const convo = this.getConversation();

      if (this.selected) {
        convo.addMessageSelection(this);
      } else {
        convo.removeMessageSelection(this);
      }

      this.trigger('change');
    },

    selectMessage() {
      if (window.contextMenuShown || this.get('isRss')) {
        return;
      }

      this.selectMessageUnchecked();
    },

    copyText() {
      clipboard.writeText(this.get('body'));

      window.pushToast({
        title: i18n('copiedMessage'),
        type: 'success',
        id: 'copiedMessage',
      });
    },

    // One caller today: event handler for the 'Retry Send' entry in triple-dot menu
    async retrySend() {
      if (!textsecure.messaging) {
        window.log.error('retrySend: Cannot retry since we are offline!');
        return null;
      }

      this.set({ errors: null });

      const conversation = this.getConversation();
      const intendedRecipients = this.get('recipients') || [];
      const successfulRecipients = this.get('sent_to') || [];
      const currentRecipients = conversation.getRecipients();

      const profileKey = conversation.get('profileSharing')
        ? storage.get('profileKey')
        : null;

      let recipients = _.intersection(intendedRecipients, currentRecipients);
      recipients = _.without(recipients, successfulRecipients);

      if (!recipients.length) {
        window.log.warn('retrySend: Nobody to send to!');

        return window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }

      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const { body, attachments } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const previewWithData = await loadPreviewData(this.get('preview'));

      // Special-case the self-send case - we send only a sync message
      if (recipients.length === 1 && recipients[0] === this.OUR_NUMBER) {
        const [number] = recipients;
        const dataMessage = await textsecure.messaging.getMessageProto(
          number,
          body,
          attachments,
          quoteWithData,
          previewWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey
        );
        return this.sendSyncMessageOnly(dataMessage);
      }

      let promise;
      const options = conversation.getSendOptions();
      options.messageType = this.get('type');

      if (conversation.isPrivate()) {
        const [number] = recipients;
        promise = textsecure.messaging.sendMessageToNumber(
          number,
          body,
          attachments,
          quoteWithData,
          previewWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          options
        );
      } else {
        // Because this is a partial group send, we manually construct the request like
        //   sendMessageToGroup does.

        promise = textsecure.messaging.sendMessage(
          {
            recipients,
            body,
            timestamp: this.get('sent_at'),
            attachments,
            quote: quoteWithData,
            preview: previewWithData,
            needsSync: !this.get('synced'),
            expireTimer: this.get('expireTimer'),
            profileKey,
            group: {
              id: this.get('conversationId'),
              type: textsecure.protobuf.GroupContext.Type.DELIVER,
            },
          },
          options
        );
      }

      return this.send(conversation.wrapSend(promise));
    },
    isReplayableError(e) {
      return (
        e.name === 'MessageError' ||
        e.name === 'OutgoingMessageError' ||
        e.name === 'SendMessageNetworkError' ||
        e.name === 'SignedPreKeyRotationError' ||
        e.name === 'OutgoingIdentityKeyError' ||
        e.name === 'DNSResolutionError' ||
        e.name === 'EmptySwarmError' ||
        e.name === 'PoWError'
      );
    },

    // Called when the user ran into an error with a specific user, wants to send to them
    //   One caller today: ConversationView.forceSend()
    async resend(number) {
      const error = this.removeOutgoingErrors(number);
      if (!error) {
        window.log.warn('resend: requested number was not present in errors');
        return null;
      }

      const profileKey = null;
      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const { body, attachments } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const previewWithData = await loadPreviewData(this.get('preview'));

      // Special-case the self-send case - we send only a sync message
      if (number === this.OUR_NUMBER) {
        const dataMessage = await textsecure.messaging.getMessageProto(
          number,
          body,
          attachments,
          quoteWithData,
          previewWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey
        );
        return this.sendSyncMessageOnly(dataMessage);
      }

      const { wrap, sendOptions } = ConversationController.prepareForSend(
        number
      );
      const promise = textsecure.messaging.sendMessageToNumber(
        number,
        body,
        attachments,
        quoteWithData,
        previewWithData,
        this.get('sent_at'),
        this.get('expireTimer'),
        profileKey,
        sendOptions
      );

      return this.send(wrap(promise));
    },
    removeOutgoingErrors(number) {
      const errors = _.partition(
        this.get('errors'),
        e =>
          e.number === number &&
          (e.name === 'MessageError' ||
            e.name === 'OutgoingMessageError' ||
            e.name === 'SendMessageNetworkError' ||
            e.name === 'SignedPreKeyRotationError' ||
            e.name === 'OutgoingIdentityKeyError')
      );
      this.set({ errors: errors[1] });
      return errors[0][0];
    },

    getConversation() {
      // This needs to be an unsafe call, because this method is called during
      //   initial module setup. We may be in the middle of the initial fetch to
      //   the database.
      return ConversationController.getUnsafe(this.get('conversationId'));
    },
    getSourceDeviceConversation() {
      // This gets the conversation of the device that sent this message
      // while getConversation will return the primary device conversation
      return ConversationController.getOrCreateAndWait(
        this.get('source'),
        'private'
      );
    },
    getIncomingContact() {
      if (!this.isIncoming()) {
        return null;
      }
      const source = this.get('source');
      if (!source) {
        return null;
      }

      return ConversationController.getOrCreate(source, 'private');
    },
    getQuoteContact() {
      const quote = this.get('quote');
      if (!quote) {
        return null;
      }
      const { author } = quote;
      if (!author) {
        return null;
      }

      return ConversationController.get(author);
    },

    getSource() {
      if (this.isIncoming()) {
        return this.get('source');
      }

      return this.OUR_NUMBER;
    },
    getContact() {
      const source = this.getSource();

      if (!source) {
        return null;
      }

      return ConversationController.getOrCreate(source, 'private');
    },
    isOutgoing() {
      return this.get('type') === 'outgoing';
    },
    hasErrors() {
      return _.size(this.get('errors')) > 0;
    },

    getStatus(number) {
      const readBy = this.get('read_by') || [];
      if (readBy.indexOf(number) >= 0) {
        return 'read';
      }
      const deliveredTo = this.get('delivered_to') || [];
      if (deliveredTo.indexOf(number) >= 0) {
        return 'delivered';
      }
      const sentTo = this.get('sent_to') || [];
      if (sentTo.indexOf(number) >= 0) {
        return 'sent';
      }

      return null;
    },
    async setCalculatingPoW() {
      if (this.calculatingPoW) {
        return;
      }

      this.set({
        calculatingPoW: true,
      });

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    getServerId() {
      return this.get('serverId');
    },
    async setServerId(serverId) {
      if (_.isEqual(this.get('serverId'), serverId)) {
        return;
      }

      this.set({
        serverId,
      });

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    async setIsPublic(isPublic) {
      if (_.isEqual(this.get('isPublic'), isPublic)) {
        return;
      }

      this.set({
        isPublic: !!isPublic,
      });

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    send(promise) {
      this.trigger('pending');
      return promise
        .then(async result => {
          this.trigger('done');

          // This is used by sendSyncMessage, then set to null
          if (!this.get('synced') && result.dataMessage) {
            this.set({ dataMessage: result.dataMessage });
          }

          const sentTo = this.get('sent_to') || [];
          this.set({
            sent_to: _.union(sentTo, result.successfulNumbers),
            sent: true,
            expirationStartTimestamp: Date.now(),
            unidentifiedDeliveries: result.unidentifiedDeliveries,
          });

          await window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });

          this.trigger('sent', this);
          if (this.get('type') !== 'friend-request') {
            const c = this.getConversation();
            // Don't bother sending sync messages to public chats
            if (c && !c.isPublic()) {
              this.sendSyncMessage();
            }
          }
        })
        .catch(result => {
          this.trigger('done');

          if (result.dataMessage) {
            this.set({ dataMessage: result.dataMessage });
          }

          let promises = [];

          if (result instanceof Error) {
            this.saveErrors(result);
            if (result.name === 'SignedPreKeyRotationError') {
              promises.push(getAccountManager().rotateSignedPreKey());
            } else if (result.name === 'OutgoingIdentityKeyError') {
              const c = ConversationController.get(result.number);
              promises.push(c.getProfiles());
            }
          } else {
            if (result.successfulNumbers.length > 0) {
              const sentTo = this.get('sent_to') || [];

              // In groups, we don't treat unregistered users as a user-visible
              //   error. The message will look successful, but the details
              //   screen will show that we didn't send to these unregistered users.
              const filteredErrors = _.reject(
                result.errors,
                error => error.name === 'UnregisteredUserError'
              );

              // We don't start the expiration timer if there are real errors
              //   left after filtering out all of the unregistered user errors.
              const expirationStartTimestamp = filteredErrors.length
                ? null
                : Date.now();

              this.saveErrors(filteredErrors);

              this.set({
                sent_to: _.union(sentTo, result.successfulNumbers),
                sent: true,
                expirationStartTimestamp,
                unidentifiedDeliveries: result.unidentifiedDeliveries,
              });
              promises.push(this.sendSyncMessage());
            } else {
              this.saveErrors(result.errors);
            }
            promises = promises.concat(
              _.map(result.errors, error => {
                if (error.name === 'OutgoingIdentityKeyError') {
                  const c = ConversationController.get(error.number);
                  promises.push(c.getProfiles());
                }
              })
            );
          }

          this.trigger('send-error', this.get('errors'));

          return Promise.all(promises);
        });
    },

    someRecipientsFailed() {
      const c = this.getConversation();
      if (!c || c.isPrivate()) {
        return false;
      }

      const recipients = c.contactCollection.length - 1;
      const errors = this.get('errors');
      if (!errors) {
        return false;
      }

      if (errors.length > 0 && recipients > 0 && errors.length < recipients) {
        return true;
      }

      return false;
    },

    async sendSyncMessageOnly(dataMessage) {
      this.set({ dataMessage });

      try {
        this.set({
          // These are the same as a normal send()
          sent_to: [this.OUR_NUMBER],
          sent: true,
          expirationStartTimestamp: Date.now(),
        });
        const result = await this.sendSyncMessage();
        this.set({
          // We have to do this afterward, since we didn't have a previous send!
          unidentifiedDeliveries: result ? result.unidentifiedDeliveries : null,

          // These are unique to a Note to Self message - immediately read/delivered
          delivered_to: [this.OUR_NUMBER],
          read_by: [this.OUR_NUMBER],
        });
      } catch (result) {
        const errors = (result && result.errors) || [
          new Error('Unknown error'),
        ];
        this.set({ errors });
      } finally {
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
        this.trigger('done');

        const errors = this.get('errors');
        if (errors) {
          this.trigger('send-error', errors);
        } else {
          this.trigger('sent');
        }
      }
    },

    sendSyncMessage() {
      const ourNumber = textsecure.storage.user.getNumber();
      const { wrap, sendOptions } = ConversationController.prepareForSend(
        ourNumber,
        { syncMessage: true }
      );

      this.syncPromise = this.syncPromise || Promise.resolve();
      const next = () => {
        const dataMessage = this.get('dataMessage');
        if (this.get('synced') || !dataMessage) {
          return Promise.resolve();
        }
        return wrap(
          textsecure.messaging.sendSyncMessage(
            dataMessage,
            this.get('sent_at'),
            this.get('destination'),
            this.get('expirationStartTimestamp'),
            this.get('sent_to'),
            this.get('unidentifiedDeliveries'),
            sendOptions
          )
        ).then(result => {
          this.set({
            synced: true,
            dataMessage: null,
          });
          return window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          }).then(() => result);
        });
      };

      this.syncPromise = this.syncPromise.then(next, next);

      return this.syncPromise;
    },

    async saveErrors(providedErrors) {
      let errors = providedErrors;

      if (!(errors instanceof Array)) {
        errors = [errors];
      }
      errors.forEach(e => {
        window.log.error(
          'Message.saveErrors:',
          e && e.reason ? e.reason : null,
          e && e.stack ? e.stack : e
        );
      });
      errors = errors.map(e => {
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

      if (this.isEndSession) {
        this.set({ endSessionType: 'failed' });
      }

      this.set({ errors });
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    hasNetworkError() {
      const error = _.find(
        this.get('errors'),
        e =>
          e.name === 'MessageError' ||
          e.name === 'OutgoingMessageError' ||
          e.name === 'SendMessageNetworkError' ||
          e.name === 'SignedPreKeyRotationError'
      );
      return !!error;
    },
    async queueAttachmentDownloads() {
      const messageId = this.id;
      let count = 0;
      let bodyPending;

      const [longMessageAttachments, normalAttachments] = _.partition(
        this.get('attachments') || [],
        attachment =>
          attachment.contentType === Whisper.Message.LONG_MESSAGE_CONTENT_TYPE
      );

      if (longMessageAttachments.length > 1) {
        window.log.error(
          `Received more than one long message attachment in message ${this.idForLogging()}`
        );
      }
      if (longMessageAttachments.length > 0) {
        count += 1;
        bodyPending = true;
        await window.Signal.AttachmentDownloads.addJob(
          longMessageAttachments[0],
          {
            messageId,
            type: 'long-message',
            index: 0,
          }
        );
      }

      const attachments = await Promise.all(
        normalAttachments.map((attachment, index) => {
          count += 1;
          return window.Signal.AttachmentDownloads.addJob(attachment, {
            messageId,
            type: 'attachment',
            index,
          });
        })
      );

      const preview = await Promise.all(
        (this.get('preview') || []).map(async (item, index) => {
          if (!item.image) {
            return item;
          }

          count += 1;
          return {
            ...item,
            image: await window.Signal.AttachmentDownloads.addJob(item.image, {
              messageId,
              type: 'preview',
              index,
            }),
          };
        })
      );

      const contact = await Promise.all(
        (this.get('contact') || []).map(async (item, index) => {
          if (!item.avatar || !item.avatar.avatar) {
            return item;
          }

          count += 1;
          return {
            ...item,
            avatar: {
              ...item.avatar,
              avatar: await window.Signal.AttachmentDownloads.addJob(
                item.avatar.avatar,
                {
                  messageId,
                  type: 'contact',
                  index,
                }
              ),
            },
          };
        })
      );

      let quote = this.get('quote');
      if (quote && quote.attachments && quote.attachments.length) {
        quote = {
          ...quote,
          attachments: await Promise.all(
            (quote.attachments || []).map(async (item, index) => {
              // If we already have a path, then we copied this image from the quoted
              //    message and we don't need to download the attachment.
              if (!item.thumbnail || item.thumbnail.path) {
                return item;
              }

              count += 1;
              return {
                ...item,
                thumbnail: await window.Signal.AttachmentDownloads.addJob(
                  item.thumbnail,
                  {
                    messageId,
                    type: 'quote',
                    index,
                  }
                ),
              };
            })
          ),
        };
      }

      let group = this.get('group');
      if (group && group.avatar) {
        group = {
          ...group,
          avatar: await window.Signal.AttachmentDownloads.addJob(group.avatar, {
            messageId,
            type: 'group-avatar',
            index: 0,
          }),
        };
      }

      if (count > 0) {
        this.set({ bodyPending, attachments, preview, contact, quote, group });

        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });

        return true;
      }

      return false;
    },

    async copyFromQuotedMessage(message, attemptCount = 1) {
      const { quote } = message;
      if (!quote) {
        return message;
      }

      const { attachments, id, author } = quote;
      const firstAttachment = attachments[0];

      const collection = await window.Signal.Data.getMessagesBySentAt(id, {
        MessageCollection: Whisper.MessageCollection,
      });
      const found = collection.find(item => {
        const messageAuthor = item.getContact();

        return messageAuthor && author === messageAuthor.id;
      });

      if (!found) {
        // Exponential backoff, giving up after 5 attempts:
        if (attemptCount < 5) {
          setTimeout(() => {
            window.log.info(
              `Looking for the message id : ${id}, attempt: ${attemptCount + 1}`
            );
            this.copyFromQuotedMessage(message, attemptCount + 1);
          }, attemptCount * attemptCount * 500);
        }

        quote.referencedMessageNotFound = true;
        return message;
      }

      window.log.info(`Found quoted message id: ${id}`);
      quote.referencedMessageNotFound = false;

      const queryMessage = MessageController.register(found.id, found);
      quote.text = queryMessage.get('body');

      if (attemptCount > 1) {
        // Normally the caller would save the message, but in case we are
        // called by a timer, we need to update the message manually
        this.set({ quote });
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
        return null;
      }

      if (firstAttachment) {
        firstAttachment.thumbnail = null;
      }

      if (
        !firstAttachment ||
        (!window.Signal.Util.GoogleChrome.isImageTypeSupported(
          firstAttachment.contentType
        ) &&
          !window.Signal.Util.GoogleChrome.isVideoTypeSupported(
            firstAttachment.contentType
          ))
      ) {
        return message;
      }

      try {
        if (
          queryMessage.get('schemaVersion') <
          TypedMessage.VERSION_NEEDED_FOR_DISPLAY
        ) {
          const upgradedMessage = await upgradeMessageSchema(
            queryMessage.attributes
          );
          queryMessage.set(upgradedMessage);
          await window.Signal.Data.saveMessage(upgradedMessage, {
            Message: Whisper.Message,
          });
        }
      } catch (error) {
        window.log.error(
          'Problem upgrading message quoted message from database',
          Errors.toLogFormat(error)
        );
        return message;
      }

      const queryAttachments = queryMessage.get('attachments') || [];

      if (queryAttachments.length > 0) {
        const queryFirst = queryAttachments[0];
        const { thumbnail } = queryFirst;

        if (thumbnail && thumbnail.path) {
          firstAttachment.thumbnail = {
            ...thumbnail,
            copied: true,
          };
        }
      }

      const queryPreview = queryMessage.get('preview') || [];
      if (queryPreview.length > 0) {
        const queryFirst = queryPreview[0];
        const { image } = queryFirst;

        if (image && image.path) {
          firstAttachment.thumbnail = {
            ...image,
            copied: true,
          };
        }
      }

      return message;
    },

    async handleDataMessage(initialMessage, confirm) {
      // This function is called from the background script in a few scenarios:
      //   1. on an incoming message
      //   2. on a sent message sync'd from another device
      //   3. in rare cases, an incoming message can be retried, though it will
      //      still go through one of the previous two codepaths
      const ourNumber = textsecure.storage.user.getNumber();
      const message = this;
      const source = message.get('source');
      const type = message.get('type');
      let conversationId = message.get('conversationId');
      const authorisation = await libloki.storage.getGrantAuthorisationForSecondaryPubKey(
        source
      );
      const primarySource =
        (authorisation && authorisation.primaryDevicePubKey) || source;
      const isGroupMessage = !!initialMessage.group;
      if (isGroupMessage) {
        conversationId = initialMessage.group.id;
      } else if (source !== ourNumber && authorisation) {
        // Ignore auth from our devices
        conversationId = authorisation.primaryDevicePubKey;
      }

      const GROUP_TYPES = textsecure.protobuf.GroupContext.Type;

      const conversation = ConversationController.get(conversationId);

      // NOTE: we use friends status to tell if this is
      // the creation of the group (initial update)
      const newGroup = !conversation.isFriend();
      const knownMembers = conversation.get('members');

      if (!newGroup && knownMembers) {
        const fromMember = knownMembers.includes(primarySource);

        if (!fromMember) {
          window.log.warn(
            `Ignoring group message from non-member: ${primarySource}`
          );
          confirm();
          return null;
        }
      }

      if (initialMessage.group) {
        if (
          initialMessage.group.type === GROUP_TYPES.REQUEST_INFO &&
          !newGroup
        ) {
          conversation.sendGroupInfo([source]);
          return null;
        } else if (
          initialMessage.group.members &&
          initialMessage.group.type === GROUP_TYPES.UPDATE
        ) {
          if (newGroup) {
            conversation.updateGroupAdmins(initialMessage.group.admins);

            conversation.setFriendRequestStatus(
              window.friends.friendRequestStatusEnum.friends
            );
          } else {
            const fromAdmin = conversation
              .get('groupAdmins')
              .includes(primarySource);

            if (!fromAdmin) {
              // Make sure the message is not removing members / renaming the group
              const nameChanged =
                conversation.get('name') !== initialMessage.group.name;

              if (nameChanged) {
                window.log.warn(
                  'Non-admin attempts to change the name of the group'
                );
              }

              const membersMissing =
                _.difference(
                  conversation.get('members'),
                  initialMessage.group.members
                ).length > 0;

              if (membersMissing) {
                window.log.warn('Non-admin attempts to remove group members');
              }

              const messageAllowed = !nameChanged && !membersMissing;

              if (!messageAllowed) {
                confirm();
                return null;
              }
            }
          }
          // For every member, see if we need to establish a session:
          initialMessage.group.members.forEach(memberPubKey => {
            const haveSession = _.some(
              textsecure.storage.protocol.sessions,
              s => s.number === memberPubKey
            );

            const ourPubKey = textsecure.storage.user.getNumber();
            if (!haveSession && memberPubKey !== ourPubKey) {
              ConversationController.getOrCreateAndWait(
                memberPubKey,
                'private'
              ).then(() => {
                textsecure.messaging.sendMessageToNumber(
                  memberPubKey,
                  '(If you see this message, you must be using an out-of-date client)',
                  [],
                  undefined,
                  [],
                  Date.now(),
                  undefined,
                  undefined,
                  { messageType: 'friend-request', sessionRequest: true }
                );
              });
            }
          });
        } else if (newGroup) {
          // We have an unknown group, we should request info from the sender
          textsecure.messaging.requestGroupInfo(conversationId, [
            primarySource,
          ]);
        }
      }

      const isSessionRequest =
        initialMessage.flags ===
        textsecure.protobuf.DataMessage.Flags.SESSION_REQUEST;

      if (
        // eslint-disable-next-line no-bitwise
        initialMessage.flags &
        textsecure.protobuf.DataMessage.Flags.SESSION_RESTORE
      ) {
        // Show that the session reset is "in progress" even though we had a valid session
        this.set({ endSessionType: 'ongoing' });
      }

      if (message.isFriendRequest() && isSessionRequest) {
        // Check if the contact is a member in one of our private groups:
        const groupMember = window
          .getConversations()
          .models.filter(c => c.get('members'))
          .reduce((acc, x) => window.Lodash.concat(acc, x.get('members')), [])
          .includes(primarySource);

        if (groupMember) {
          window.log.info(
            `Auto accepting a 'group' friend request for a known group member: ${primarySource}`
          );

          window.libloki.api.sendBackgroundMessage(message.get('source'));

          confirm();
        }

        // Wether or not we accepted the FR, we exit early so background friend requests
        // cannot be used for establishing regular private conversations
        return null;
      }

      return conversation.queueJob(async () => {
        window.log.info(
          `Starting handleDataMessage for message ${message.idForLogging()} in conversation ${conversation.idForLogging()}`
        );

        const withQuoteReference = await this.copyFromQuotedMessage(
          initialMessage
        );
        const dataMessage = await upgradeMessageSchema(withQuoteReference);

        try {
          const now = new Date().getTime();
          let attributes = {
            ...conversation.attributes,
          };
          if (dataMessage.group) {
            let groupUpdate = null;
            attributes = {
              ...attributes,
              type: 'group',
              groupId: dataMessage.group.id,
            };
            if (dataMessage.group.type === GROUP_TYPES.UPDATE) {
              attributes = {
                ...attributes,
                name: dataMessage.group.name,
                members: dataMessage.group.members,
              };

              groupUpdate =
                conversation.changedAttributes(
                  _.pick(dataMessage.group, 'name', 'avatar')
                ) || {};

              const addedMembers = _.difference(
                attributes.members,
                conversation.get('members')
              );
              if (addedMembers.length > 0) {
                groupUpdate.joined = addedMembers;
              }
              if (conversation.get('left')) {
                // TODO: Maybe we shouldn't assume this message adds us:
                // we could maybe still get this message by mistake
                window.log.warn('re-added to a left group');
                attributes.left = false;
              }

              if (attributes.isKickedFromGroup) {
                // Assume somebody re-invited us since we received this update
                attributes.isKickedFromGroup = false;
              }

              // Check if anyone got kicked:
              const removedMembers = _.difference(
                conversation.get('members'),
                attributes.members
              );

              if (removedMembers.length > 0) {
                if (
                  removedMembers.includes(textsecure.storage.user.getNumber())
                ) {
                  groupUpdate.kicked = 'You';
                  attributes.isKickedFromGroup = true;
                } else {
                  groupUpdate.kicked = removedMembers;
                }
              }
            } else if (dataMessage.group.type === GROUP_TYPES.QUIT) {
              if (source === textsecure.storage.user.getNumber()) {
                attributes.left = true;
                groupUpdate = { left: 'You' };
              } else {
                groupUpdate = { left: source };
              }
              attributes.members = _.without(
                conversation.get('members'),
                source
              );
            }

            if (groupUpdate !== null) {
              message.set({ group_update: groupUpdate });
            }
          }

          if (initialMessage.groupInvitation) {
            message.set({ groupInvitation: initialMessage.groupInvitation });
          }

          const urls = window.Signal.LinkPreviews.findLinks(dataMessage.body);
          const incomingPreview = dataMessage.preview || [];
          const preview = incomingPreview.filter(
            item =>
              (item.image || item.title) &&
              urls.includes(item.url) &&
              window.Signal.LinkPreviews.isLinkInWhitelist(item.url)
          );
          if (preview.length < incomingPreview.length) {
            window.log.info(
              `${message.idForLogging()}: Eliminated ${preview.length -
                incomingPreview.length} previews with invalid urls'`
            );
          }

          message.set({
            attachments: dataMessage.attachments,
            body: dataMessage.body,
            contact: dataMessage.contact,
            conversationId: conversation.id,
            decrypted_at: now,
            errors: [],
            flags: dataMessage.flags,
            hasAttachments: dataMessage.hasAttachments,
            hasFileAttachments: dataMessage.hasFileAttachments,
            hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
            quote: dataMessage.quote,
            preview,
            schemaVersion: dataMessage.schemaVersion,
          });

          if (type === 'outgoing') {
            const receipts = Whisper.DeliveryReceipts.forMessage(
              conversation,
              message
            );
            receipts.forEach(receipt =>
              message.set({
                delivered: (message.get('delivered') || 0) + 1,
                delivered_to: _.union(message.get('delivered_to') || [], [
                  receipt.get('source'),
                ]),
              })
            );
          }
          attributes.active_at = now;
          conversation.set(attributes);

          // Re-enable typing if re-joined the group
          conversation.updateTextInputState();

          if (message.isExpirationTimerUpdate()) {
            message.set({
              expirationTimerUpdate: {
                source,
                expireTimer: dataMessage.expireTimer,
              },
            });
            conversation.set({ expireTimer: dataMessage.expireTimer });
          } else if (dataMessage.expireTimer) {
            message.set({ expireTimer: dataMessage.expireTimer });
          }

          // NOTE: Remove once the above uses
          // `Conversation::updateExpirationTimer`:
          const { expireTimer } = dataMessage;
          const shouldLogExpireTimerChange =
            message.isExpirationTimerUpdate() || expireTimer;
          if (shouldLogExpireTimerChange) {
            window.log.info("Update conversation 'expireTimer'", {
              id: conversation.idForLogging(),
              expireTimer,
              source: 'handleDataMessage',
            });
          }

          if (!message.isEndSession()) {
            if (dataMessage.expireTimer) {
              if (dataMessage.expireTimer !== conversation.get('expireTimer')) {
                conversation.updateExpirationTimer(
                  dataMessage.expireTimer,
                  source,
                  message.get('received_at'),
                  {
                    fromGroupUpdate: message.isGroupUpdate(),
                  }
                );
              }
            } else if (
              conversation.get('expireTimer') &&
              // We only turn off timers if it's not a group update
              !message.isGroupUpdate()
            ) {
              conversation.updateExpirationTimer(
                null,
                source,
                message.get('received_at')
              );
            }
          } else {
            const endSessionType = conversation.isSessionResetReceived()
              ? 'ongoing'
              : 'done';
            this.set({ endSessionType });
          }
          if (type === 'incoming' || type === 'friend-request') {
            const readSync = Whisper.ReadSyncs.forMessage(message);
            if (readSync) {
              if (
                message.get('expireTimer') &&
                !message.get('expirationStartTimestamp')
              ) {
                message.set(
                  'expirationStartTimestamp',
                  Math.min(readSync.get('read_at'), Date.now())
                );
              }
            }
            if (readSync || message.isExpirationTimerUpdate()) {
              message.unset('unread');
              // This is primarily to allow the conversation to mark all older
              // messages as read, as is done when we receive a read sync for
              // a message we already know about.
              const c = message.getConversation();
              if (c) {
                c.onReadMessage(message);
              }
            } else {
              if (
                message.attributes.body &&
                message.attributes.body.indexOf(`@${ourNumber}`) !== -1
              ) {
                conversation.set({ mentionedUs: true });
              }

              conversation.set({
                unreadCount: conversation.get('unreadCount') + 1,
                isArchived: false,
              });
            }
          }

          if (type === 'outgoing') {
            const reads = Whisper.ReadReceipts.forMessage(
              conversation,
              message
            );
            if (reads.length) {
              const readBy = reads.map(receipt => receipt.get('reader'));
              message.set({
                read_by: _.union(message.get('read_by'), readBy),
              });
            }

            // A sync'd message to ourself is automatically considered read and delivered
            if (conversation.isMe()) {
              message.set({
                read_by: conversation.getRecipients(),
                delivered_to: conversation.getRecipients(),
              });
            }

            message.set({ recipients: conversation.getRecipients() });
          }

          const conversationTimestamp = conversation.get('timestamp');
          if (
            !conversationTimestamp ||
            message.get('sent_at') > conversationTimestamp
          ) {
            conversation.lastMessage = message.getNotificationText();
            conversation.set({
              timestamp: message.get('sent_at'),
            });
          }

          const sendingDeviceConversation = await ConversationController.getOrCreateAndWait(
            source,
            'private'
          );
          if (dataMessage.profileKey) {
            const profileKey = dataMessage.profileKey.toString('base64');
            if (source === textsecure.storage.user.getNumber()) {
              conversation.set({ profileSharing: true });
            } else if (conversation.isPrivate()) {
              conversation.setProfileKey(profileKey);
            } else {
              sendingDeviceConversation.setProfileKey(profileKey);
            }
          }

          let autoAccept = false;
          // Make sure friend request logic doesn't trigger on messages aimed at groups
          if (!isGroupMessage) {
            if (message.get('type') === 'friend-request') {
              /*
              Here is the before and after state diagram for the operation before.

              None -> RequestReceived
              PendingSend -> RequestReceived
              RequestReceived -> RequestReceived
              Sent -> Friends
              Expired -> Friends
              Friends -> Friends

              The cases where we auto accept are the following:
                - We sent the user a friend request,
                  and that user sent us a friend request.
                - We are friends with the user,
                  and that user just sent us a friend request.
              */
              const isFriend = sendingDeviceConversation.isFriend();
              const hasSentFriendRequest = sendingDeviceConversation.hasSentFriendRequest();
              autoAccept = isFriend || hasSentFriendRequest;

              if (autoAccept) {
                message.set({ friendStatus: 'accepted' });
              }

              if (isFriend) {
                window.Whisper.events.trigger('endSession', source);
              } else if (hasSentFriendRequest) {
                await sendingDeviceConversation.onFriendRequestAccepted();
              } else {
                await sendingDeviceConversation.onFriendRequestReceived();
              }
            } else if (message.get('type') !== 'outgoing') {
              // Ignore 'outgoing' messages because they are sync messages
              await sendingDeviceConversation.onFriendRequestAccepted();
            }
          }

          // We need to map the original message source to the primary device
          if (source !== ourNumber) {
            message.set({ source: primarySource });
          }

          const id = await window.Signal.Data.saveMessage(message.attributes, {
            Message: Whisper.Message,
          });
          message.set({ id });
          MessageController.register(message.id, message);

          // Note that this can save the message again, if jobs were queued. We need to
          //   call it after we have an id for this message, because the jobs refer back
          //   to their source message.
          await message.queueAttachmentDownloads();

          await window.Signal.Data.updateConversation(
            conversationId,
            conversation.attributes,
            { Conversation: Whisper.Conversation }
          );

          conversation.trigger('newmessage', message);

          try {
            // We go to the database here because, between the message save above and
            // the previous line's trigger() call, we might have marked all messages
            // unread in the database. This message might already be read!
            const fetched = await window.Signal.Data.getMessageById(
              message.get('id'),
              {
                Message: Whisper.Message,
              }
            );
            const previousUnread = message.get('unread');

            // Important to update message with latest read state from database
            message.merge(fetched);

            if (previousUnread !== message.get('unread')) {
              window.log.warn(
                'Caught race condition on new message read state! ' +
                  'Manually starting timers.'
              );
              // We call markRead() even though the message is already
              // marked read because we need to start expiration
              // timers, etc.
              message.markRead();
            }
          } catch (error) {
            window.log.warn(
              'handleDataMessage: Message',
              message.idForLogging(),
              'was deleted'
            );
          }

          if (message.get('unread')) {
            // Need to do this here because the conversation has already changed states
            if (autoAccept) {
              await conversation.notifyFriendRequest(source, 'accepted');
            } else {
              await conversation.notify(message);
            }
          }

          confirm();
        } catch (error) {
          const errorForLog = error && error.stack ? error.stack : error;
          window.log.error(
            'handleDataMessage',
            message.idForLogging(),
            'error:',
            errorForLog
          );
          throw error;
        }
      });
    },
    async markRead(readAt) {
      this.unset('unread');

      if (this.get('expireTimer') && !this.get('expirationStartTimestamp')) {
        const expirationStartTimestamp = Math.min(
          Date.now(),
          readAt || Date.now()
        );
        this.set({ expirationStartTimestamp });
      }

      Whisper.Notifications.remove(
        Whisper.Notifications.where({
          messageId: this.id,
        })
      );

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    isExpiring() {
      return this.get('expireTimer') && this.get('expirationStartTimestamp');
    },
    isExpired() {
      return this.msTilExpire() <= 0;
    },
    msTilExpire() {
      if (!this.isExpiring()) {
        return Infinity;
      }
      const now = Date.now();
      const start = this.get('expirationStartTimestamp');
      const delta = this.get('expireTimer') * 1000;
      let msFromNow = start + delta - now;
      if (msFromNow < 0) {
        msFromNow = 0;
      }
      return msFromNow;
    },
    async setToExpire(force = false) {
      if (this.isExpiring() && (force || !this.get('expires_at'))) {
        const start = this.get('expirationStartTimestamp');
        const delta = this.get('expireTimer') * 1000;
        const expiresAt = start + delta;

        this.set({ expires_at: expiresAt });
        const id = this.get('id');
        if (id) {
          await window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });
        }

        window.log.info('Set message expiration', {
          expiresAt,
          sentAt: this.get('sent_at'),
        });
      }
    },
  });

  // Receive will be enabled before we enable send
  Whisper.Message.LONG_MESSAGE_CONTENT_TYPE = 'text/x-signal-plain';

  Whisper.Message.getLongMessageAttachment = ({ body, attachments, now }) => {
    if (body.length <= 2048) {
      return {
        body,
        attachments,
      };
    }

    const data = bytesFromString(body);
    const attachment = {
      contentType: Whisper.Message.LONG_MESSAGE_CONTENT_TYPE,
      fileName: `long-message-${now}.txt`,
      data,
      size: data.byteLength,
    };

    return {
      body: body.slice(0, 2048),
      attachments: [attachment, ...attachments],
    };
  };

  Whisper.Message.refreshExpirationTimer = () =>
    Whisper.ExpiringMessagesListener.update();

  Whisper.MessageCollection = Backbone.Collection.extend({
    model: Whisper.Message,
    comparator(left, right) {
      if (left.get('sent_at') === right.get('sent_at')) {
        return (left.get('received_at') || 0) - (right.get('received_at') || 0);
      }

      return (left.get('sent_at') || 0) - (right.get('sent_at') || 0);
    },
    initialize(models, options) {
      if (options) {
        this.conversation = options.conversation;
      }
    },
    async destroyAll() {
      await Promise.all(
        this.models.map(message =>
          window.Signal.Data.removeMessage(message.id, {
            Message: Whisper.Message,
          })
        )
      );
      this.reset([]);
    },

    getLoadedUnreadCount() {
      return this.reduce((total, model) => {
        const unread = model.get('unread') && model.isIncoming();
        return total + (unread ? 1 : 0);
      }, 0);
    },

    async fetchConversation(conversationId, limit = 100, unreadCount = 0) {
      const startingLoadedUnread =
        unreadCount > 0 ? this.getLoadedUnreadCount() : 0;

      // We look for older messages if we've fetched once already
      const receivedAt =
        this.length === 0 ? Number.MAX_VALUE : this.at(0).get('received_at');

      const messages = await window.Signal.Data.getMessagesByConversation(
        conversationId,
        {
          limit,
          receivedAt,
          MessageCollection: Whisper.MessageCollection,
        }
      );

      const models = messages
        .filter(message => Boolean(message.id))
        .map(message => MessageController.register(message.id, message));
      const eliminated = messages.length - models.length;
      if (eliminated > 0) {
        window.log.warn(
          `fetchConversation: Eliminated ${eliminated} messages without an id`
        );
      }

      this.add(models);

      if (unreadCount <= 0) {
        return;
      }
      const loadedUnread = this.getLoadedUnreadCount();
      if (loadedUnread >= unreadCount) {
        return;
      }
      if (startingLoadedUnread === loadedUnread) {
        // that fetch didn't get us any more unread. stop fetching more.
        return;
      }

      window.log.info(
        'fetchConversation: doing another fetch to get all unread'
      );
      await this.fetchConversation(conversationId, limit, unreadCount);
    },
  });
})();
