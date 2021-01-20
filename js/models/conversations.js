/* global
  _,
  log,
  i18n,
  Backbone,
  libsession,
  getMessageController,
  storage,
  textsecure,
  Whisper,
  profileImages,
  clipboard,
  BlockedNumberController,
  lokiPublicChatAPI,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const SEALED_SENDER = {
    UNKNOWN: 0,
    ENABLED: 1,
    DISABLED: 2,
    UNRESTRICTED: 3,
  };

  const { Conversation, Contact, Message, PhoneNumber } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    loadAttachmentData,
    getAbsoluteAttachmentPath,
    deleteAttachmentData,
  } = window.Signal.Migrations;

  Whisper.Conversation = Backbone.Model.extend({
    storeName: 'conversations',
    defaults() {
      return {
        unreadCount: 0,
        groupAdmins: [],
        isKickedFromGroup: false,
        profileSharing: false,
        left: false,
        lastJoinedTimestamp: new Date('1970-01-01Z00:00:00:000').getTime(),
      };
    },

    idForLogging() {
      if (this.isPrivate()) {
        return this.id;
      }

      return `group(${this.id})`;
    },

    getContactCollection() {
      const collection = new Backbone.Collection();
      const collator = new Intl.Collator();
      collection.comparator = (left, right) => {
        const leftLower = left.getTitle().toLowerCase();
        const rightLower = right.getTitle().toLowerCase();
        return collator.compare(leftLower, rightLower);
      };
      return collection;
    },

    initialize() {
      this.ourNumber = textsecure.storage.user.getNumber();

      // This may be overridden by ConversationController.getOrCreate, and signify
      //   our first save to the database. Or first fetch from the database.
      this.initialPromise = Promise.resolve();

      this.contactCollection = this.getContactCollection();
      this.messageCollection = new Whisper.MessageCollection([], {
        conversation: this,
      });

      this.throttledBumpTyping = _.throttle(this.bumpTyping, 300);
      const debouncedUpdateLastMessage = _.debounce(
        this.updateLastMessage.bind(this),
        200
      );
      this.listenTo(
        this.messageCollection,
        'add remove destroy',
        debouncedUpdateLastMessage
      );
      this.on('newmessage', this.onNewMessage);

      // Listening for out-of-band data updates
      this.on('updateMessage', this.updateAndMerge);
      this.on('delivered', this.updateAndMerge);
      this.on('read', this.updateAndMerge);
      this.on('expiration-change', this.updateAndMerge);
      this.on('expired', this.onExpired);

      this.on('ourAvatarChanged', avatar =>
        this.updateAvatarOnPublicChat(avatar)
      );

      // Always share profile pics with public chats
      if (this.isPublic) {
        this.set('profileSharing', true);
      }

      const sealedSender = this.get('sealedSender');
      if (sealedSender === undefined) {
        this.set({ sealedSender: SEALED_SENDER.UNKNOWN });
      }
      this.unset('unidentifiedDelivery');
      this.unset('unidentifiedDeliveryUnrestricted');
      this.unset('hasFetchedProfile');
      this.unset('tokens');

      this.typingRefreshTimer = null;
      this.typingPauseTimer = null;

      // Keep props ready
      const generateProps = () => {
        this.cachedProps = this.getProps();
      };
      this.on('change', generateProps);
      generateProps();
    },
    isMe() {
      return this.id === this.ourNumber;
    },
    isPublic() {
      return !!(this.id && this.id.match(/^publicChat:/));
    },
    isClosedGroup() {
      return this.get('type') === Message.GROUP && !this.isPublic();
    },
    isClosable() {
      return this.get('closable');
    },
    isBlocked() {
      if (!this.id || this.isMe()) {
        return false;
      }

      if (this.isClosedGroup()) {
        return BlockedNumberController.isGroupBlocked(this.id);
      }

      if (this.isPrivate()) {
        return BlockedNumberController.isBlocked(this.id);
      }

      return false;
    },
    isMediumGroup() {
      return this.get('is_medium_group');
    },
    async block() {
      if (!this.id || this.isPublic()) {
        return;
      }

      const promise = this.isPrivate()
        ? BlockedNumberController.block(this.id)
        : BlockedNumberController.blockGroup(this.id);
      await promise;
      this.commit();
    },
    async unblock() {
      if (!this.id || this.isPublic()) {
        return;
      }
      const promise = this.isPrivate()
        ? BlockedNumberController.unblock(this.id)
        : BlockedNumberController.unblockGroup(this.id);
      await promise;
      this.commit();
    },
    async bumpTyping() {
      if (this.isPublic() || this.isMediumGroup()) {
        return;
      }
      // We don't send typing messages if the setting is disabled
      // or we blocked that user

      if (!storage.get('typing-indicators-setting') || this.isBlocked()) {
        return;
      }

      if (!this.typingRefreshTimer) {
        const isTyping = true;
        this.setTypingRefreshTimer();
        this.sendTypingMessage(isTyping);
      }

      this.setTypingPauseTimer();
    },

    setTypingRefreshTimer() {
      if (this.typingRefreshTimer) {
        clearTimeout(this.typingRefreshTimer);
      }
      this.typingRefreshTimer = setTimeout(
        this.onTypingRefreshTimeout.bind(this),
        10 * 1000
      );
    },

    onTypingRefreshTimeout() {
      const isTyping = true;
      this.sendTypingMessage(isTyping);

      // This timer will continue to reset itself until the pause timer stops it
      this.setTypingRefreshTimer();
    },

    setTypingPauseTimer() {
      if (this.typingPauseTimer) {
        clearTimeout(this.typingPauseTimer);
      }
      this.typingPauseTimer = setTimeout(
        this.onTypingPauseTimeout.bind(this),
        10 * 1000
      );
    },

    onTypingPauseTimeout() {
      const isTyping = false;
      this.sendTypingMessage(isTyping);

      this.clearTypingTimers();
    },

    clearTypingTimers() {
      if (this.typingPauseTimer) {
        clearTimeout(this.typingPauseTimer);
        this.typingPauseTimer = null;
      }
      if (this.typingRefreshTimer) {
        clearTimeout(this.typingRefreshTimer);
        this.typingRefreshTimer = null;
      }
    },

    sendTypingMessage(isTyping) {
      if (!this.isPrivate()) {
        return;
      }

      const recipientId = this.id;

      if (!recipientId) {
        throw new Error('Need to provide either recipientId');
      }

      const primaryDevicePubkey = window.storage.get('primaryDevicePubKey');
      if (recipientId && primaryDevicePubkey === recipientId) {
        // note to self
        return;
      }

      const typingParams = {
        timestamp: Date.now(),
        isTyping,
        typingTimestamp: Date.now(),
      };
      const typingMessage = new libsession.Messages.Outgoing.TypingMessage(
        typingParams
      );

      // send the message to a single recipient if this is a session chat
      const device = new libsession.Types.PubKey(recipientId);
      libsession
        .getMessageQueue()
        .sendToPubKey(device, typingMessage)
        .catch(log.error);
    },

    async cleanup() {
      await window.Signal.Types.Conversation.deleteExternalFiles(
        this.attributes,
        {
          deleteAttachmentData,
        }
      );
      profileImages.removeImage(this.id);
    },

    async updateProfileAvatar() {
      if (this.isPublic()) {
        return;
      }

      // Remove old identicons
      if (profileImages.hasImage(this.id)) {
        profileImages.removeImage(this.id);
        await this.setProfileAvatar(null);
      }
    },

    async updateAndMerge(message) {
      this.updateLastMessage();

      const mergeMessage = () => {
        const existing = this.messageCollection.get(message.id);
        if (!existing) {
          return;
        }

        existing.merge(message.attributes);
      };

      await this.inProgressFetch;
      mergeMessage();
    },

    async onExpired(message) {
      this.updateLastMessage();

      const removeMessage = () => {
        const { id } = message;
        const existing = this.messageCollection.get(id);
        if (!existing) {
          return;
        }

        window.log.info('Remove expired message from collection', {
          sentAt: existing.get('sent_at'),
        });

        this.messageCollection.remove(id);
        existing.trigger('expired');
      };

      // If a fetch is in progress, then we need to wait until that's complete to
      //   do this removal. Otherwise we could remove from messageCollection, then
      //   the async database fetch could include the removed message.

      await this.inProgressFetch;
      removeMessage();
    },

    // Get messages with the given timestamp
    getMessagesWithTimestamp(pubKey, timestamp) {
      if (this.id !== pubKey) {
        return [];
      }

      // Go through our messages and find the one that we need to update
      return this.messageCollection.models.filter(
        m => m.get('sent_at') === timestamp
      );
    },

    async onCalculatingPoW(pubKey, timestamp) {
      const messages = this.getMessagesWithTimestamp(pubKey, timestamp);
      await Promise.all(messages.map(m => m.setCalculatingPoW()));
    },

    async onPublicMessageSent(identifier, serverId, serverTimestamp) {
      const registeredMessage = window.getMessageController().get(identifier);

      if (!registeredMessage || !registeredMessage.message) {
        return null;
      }
      const model = registeredMessage.message;
      await model.setIsPublic(true);
      await model.setServerId(serverId);
      await model.setServerTimestamp(serverTimestamp);
      return undefined;
    },

    async onNewMessage(message) {
      await this.updateLastMessage();

      // Clear typing indicator for a given contact if we receive a message from them
      const identifier = message.get
        ? `${message.get('source')}.${message.get('sourceDevice')}`
        : `${message.source}.${message.sourceDevice}`;
      this.clearContactTypingTimer(identifier);

      const model = this.addSingleMessage(message);
      getMessageController().register(model.id, model);

      window.Whisper.events.trigger('messageAdded', {
        conversationKey: this.id,
        messageModel: model,
      });

      this.commit();
    },
    addSingleMessage(message, setToExpire = true) {
      const model = this.messageCollection.add(message, { merge: true });
      if (setToExpire) {
        model.setToExpire();
      }
      return model;
    },
    format() {
      return this.cachedProps;
    },
    getGroupAdmins() {
      return this.get('groupAdmins') || this.get('moderators');
    },
    getProps() {
      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');
      const typingKeys = Object.keys(this.contactTypingTimers || {});

      const groupAdmins = this.getGroupAdmins();

      const members =
        this.isGroup() && !this.isPublic() ? this.get('members') : undefined;

      const result = {
        id: this.id,
        activeAt: this.get('active_at'),
        avatarPath: this.getAvatarPath(),
        type: this.isPrivate() ? 'direct' : 'group',
        isMe: this.isMe(),
        isPublic: this.isPublic(),
        isClosable: this.isClosable(),
        isTyping: typingKeys.length > 0,
        lastUpdated: this.get('timestamp'),
        name: this.getName(),
        profileName: this.getProfileName(),
        timestamp: this.get('timestamp'),
        title: this.getTitle(),
        unreadCount: this.get('unreadCount') || 0,
        mentionedUs: this.get('mentionedUs') || false,
        isBlocked: this.isBlocked(),
        primaryDevice: this.id,
        phoneNumber: format(this.id, {
          ourRegionCode: regionCode,
        }),
        lastMessage: {
          status: this.get('lastMessageStatus'),
          text: this.get('lastMessage'),
        },
        hasNickname: !!this.getNickname(),
        isKickedFromGroup: !!this.get('isKickedFromGroup'),
        left: !!this.get('left'),
        groupAdmins,
        members,
        onClick: () => this.trigger('select', this),
        onBlockContact: () => this.block(),
        onUnblockContact: () => this.unblock(),
        onCopyPublicKey: () => this.copyPublicKey(),
        onDeleteContact: () => this.deleteContact(),
        onLeaveGroup: () => {
          window.Whisper.events.trigger('leaveGroup', this);
        },
        onDeleteMessages: () => this.deleteMessages(),
        onInviteContacts: () => {
          window.Whisper.events.trigger('inviteContacts', this);
        },
        onClearNickname: () => {
          this.setLokiProfile({ displayName: null });
        },
      };

      return result;
    },

    async updateGroupAdmins(groupAdmins) {
      const existingAdmins = _.sortBy(this.getGroupAdmins());
      const newAdmins = _.sortBy(groupAdmins);

      if (_.isEqual(existingAdmins, newAdmins)) {
        window.log.info(
          'Skipping updates of groupAdmins/moderators. No change detected.'
        );
        return;
      }
      this.set({ groupAdmins });
      await this.commit();
    },

    async onReadMessage(message, readAt) {
      // We mark as read everything older than this message - to clean up old stuff
      //   still marked unread in the database. If the user generally doesn't read in
      //   the desktop app, so the desktop app only gets read syncs, we can very
      //   easily end up with messages never marked as read (our previous early read
      //   sync handling, read syncs never sent because app was offline)

      // We queue it because we often get a whole lot of read syncs at once, and
      //   their markRead calls could very easily overlap given the async pull from DB.

      // Lastly, we don't send read syncs for any message marked read due to a read
      //   sync. That's a notification explosion we don't need.
      return this.queueJob(() =>
        this.markRead(message.get('received_at'), {
          sendReadReceipts: false,
          readAt,
        })
      );
    },

    async getUnread() {
      return window.Signal.Data.getUnreadByConversation(this.id, {
        MessageCollection: Whisper.MessageCollection,
      });
    },

    async getUnreadCount() {
      return window.Signal.Data.getUnreadCountByConversation(this.id);
    },

    validate(attributes) {
      const required = ['id', 'type'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) {
        return `Conversation must have ${missing}`;
      }

      if (attributes.type !== 'private' && attributes.type !== 'group') {
        return `Invalid conversation type: ${attributes.type}`;
      }

      const error = this.validateNumber();
      if (error) {
        return error;
      }

      return null;
    },

    validateNumber() {
      if (!this.id) {
        return 'Invalid ID';
      }
      if (!this.isPrivate()) {
        return null;
      }

      // Check if it's hex
      const isHex = this.id.replace(/[\s]*/g, '').match(/^[0-9a-fA-F]+$/);
      if (!isHex) {
        return 'Invalid Hex ID';
      }

      // Check if the pubkey length is 33 and leading with 05 or of length 32
      const len = this.id.length;
      if ((len !== 33 * 2 || !/^05/.test(this.id)) && len !== 32 * 2) {
        return 'Invalid Pubkey Format';
      }

      this.set({ id: this.id });
      return null;
    },

    queueJob(callback) {
      const previous = this.pending || Promise.resolve();

      const taskWithTimeout = textsecure.createTaskWithTimeout(
        callback,
        `conversation ${this.idForLogging()}`
      );

      this.pending = previous.then(taskWithTimeout, taskWithTimeout);
      const current = this.pending;

      current.then(() => {
        if (this.pending === current) {
          delete this.pending;
        }
      });

      return current;
    },
    getRecipients() {
      if (this.isPrivate()) {
        return [this.id];
      }
      const me = textsecure.storage.user.getNumber();
      return _.without(this.get('members'), me);
    },

    async getQuoteAttachment(attachments, preview) {
      if (attachments && attachments.length) {
        return Promise.all(
          attachments
            .filter(
              attachment =>
                attachment &&
                attachment.contentType &&
                !attachment.pending &&
                !attachment.error
            )
            .slice(0, 1)
            .map(async attachment => {
              const { fileName, thumbnail, contentType } = attachment;

              return {
                contentType,
                // Our protos library complains about this field being undefined, so we
                //   force it to null
                fileName: fileName || null,
                thumbnail: thumbnail
                  ? {
                      ...(await loadAttachmentData(thumbnail)),
                      objectUrl: getAbsoluteAttachmentPath(thumbnail.path),
                    }
                  : null,
              };
            })
        );
      }

      if (preview && preview.length) {
        return Promise.all(
          preview
            .filter(item => item && item.image)
            .slice(0, 1)
            .map(async attachment => {
              const { image } = attachment;
              const { contentType } = image;

              return {
                contentType,
                // Our protos library complains about this field being undefined, so we
                //   force it to null
                fileName: null,
                thumbnail: image
                  ? {
                      ...(await loadAttachmentData(image)),
                      objectUrl: getAbsoluteAttachmentPath(image.path),
                    }
                  : null,
              };
            })
        );
      }

      return [];
    },

    async makeQuote(quotedMessage) {
      const { getName } = Contact;
      const contact = quotedMessage.getContact();
      const attachments = quotedMessage.get('attachments');
      const preview = quotedMessage.get('preview');

      const body = quotedMessage.get('body');
      const embeddedContact = quotedMessage.get('contact');
      const embeddedContactName =
        embeddedContact && embeddedContact.length > 0
          ? getName(embeddedContact[0])
          : '';

      return {
        author: contact.id,
        id: quotedMessage.get('sent_at'),
        text: body || embeddedContactName,
        attachments: await this.getQuoteAttachment(attachments, preview),
      };
    },

    toOpenGroup() {
      if (!this.isPublic()) {
        return undefined;
      }

      return new libsession.Types.OpenGroup({
        server: this.get('server'),
        channel: this.get('channelId'),
        conversationId: this.id,
      });
    },
    async sendMessageJob(message) {
      try {
        const uploads = await message.uploadData();
        const { id } = message;
        const expireTimer = this.get('expireTimer');
        const destination = this.id;

        const chatMessage = new libsession.Messages.Outgoing.ChatMessage({
          body: uploads.body,
          identifier: id,
          timestamp: message.get('sent_at'),
          attachments: uploads.attachments,
          expireTimer,
          preview: uploads.preview,
          quote: uploads.quote,
          lokiProfile: this.getOurProfile(),
        });

        if (this.isPublic()) {
          const openGroup = this.toOpenGroup();

          const openGroupParams = {
            body: uploads.body,
            timestamp: message.get('sent_at'),
            group: openGroup,
            attachments: uploads.attachments,
            preview: uploads.preview,
            quote: uploads.quote,
            identifier: id,
          };
          const openGroupMessage = new libsession.Messages.Outgoing.OpenGroupMessage(
            openGroupParams
          );
          // we need the return await so that errors are caught in the catch {}
          return await libsession
            .getMessageQueue()
            .sendToGroup(openGroupMessage);
        }

        const destinationPubkey = new libsession.Types.PubKey(destination);
        if (this.isPrivate()) {
          // Handle Group Invitation Message
          if (message.get('groupInvitation')) {
            const groupInvitation = message.get('groupInvitation');
            const groupInvitMessage = new libsession.Messages.Outgoing.GroupInvitationMessage(
              {
                identifier: id,
                timestamp: message.get('sent_at'),
                serverName: groupInvitation.name,
                channelId: groupInvitation.channelId,
                serverAddress: groupInvitation.address,
                expireTimer: this.get('expireTimer'),
              }
            );
            // we need the return await so that errors are caught in the catch {}
            return await libsession
              .getMessageQueue()
              .sendToPubKey(destinationPubkey, groupInvitMessage);
          }
          // we need the return await so that errors are caught in the catch {}
          return await libsession
            .getMessageQueue()
            .sendToPubKey(destinationPubkey, chatMessage);
        }

        if (this.isMediumGroup()) {
          const closedGroupV2ChatMessage = new libsession.Messages.Outgoing.ClosedGroupV2ChatMessage(
            {
              chatMessage,
              groupId: destination,
            }
          );

          // we need the return await so that errors are caught in the catch {}
          return await libsession
            .getMessageQueue()
            .sendToGroup(closedGroupV2ChatMessage);
        }

        if (this.isClosedGroup()) {
          throw new Error(
            'Legacy group are not supported anymore. You need to recreate this group.'
          );
        }

        throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
      } catch (e) {
        await message.saveErrors(e);
        return null;
      }
    },
    async sendMessage(
      body,
      attachments,
      quote,
      preview,
      groupInvitation = null
    ) {
      this.clearTypingTimers();

      const destination = this.id;
      const expireTimer = this.get('expireTimer');
      const recipients = this.getRecipients();

      const now = Date.now();

      window.log.info(
        'Sending message to conversation',
        this.idForLogging(),
        'with timestamp',
        now
      );
      // be sure an empty quote is marked as undefined rather than being empty
      // otherwise upgradeMessageSchema() will return an object with an empty array
      // and this.get('quote') will be true, even if there is no quote.
      const editedQuote = _.isEmpty(quote) ? undefined : quote;

      const messageWithSchema = await upgradeMessageSchema({
        type: 'outgoing',
        body,
        conversationId: destination,
        quote: editedQuote,
        preview,
        attachments,
        sent_at: now,
        received_at: now,
        expireTimer,
        recipients,
      });

      if (this.isPublic()) {
        // Public chats require this data to detect duplicates
        messageWithSchema.source = textsecure.storage.user.getNumber();
        messageWithSchema.sourceDevice = 1;
      } else {
        messageWithSchema.destination = destination;
      }

      const attributes = {
        ...messageWithSchema,
        groupInvitation,
        id: window.getGuid(),
      };

      const model = this.addSingleMessage(attributes);
      const message = getMessageController().register(model.id, model);

      await message.commit(true);

      if (this.isPrivate()) {
        message.set({ destination });
      }
      if (this.isPublic()) {
        message.setServerTimestamp(new Date().getTime());
      }

      const id = await message.commit();
      message.set({ id });

      window.Whisper.events.trigger('messageAdded', {
        conversationKey: this.id,
        messageModel: message,
      });

      this.set({
        lastMessage: model.getNotificationText(),
        lastMessageStatus: 'sending',
        active_at: now,
        timestamp: now,
      });
      await this.commit();

      // We're offline!
      if (!textsecure.messaging) {
        let errors;
        if (this.contactCollection.length) {
          errors = this.contactCollection.map(contact => {
            const error = new Error('Network is not available');
            error.name = 'SendMessageNetworkError';
            error.number = contact.id;
            return error;
          });
        } else {
          const error = new Error('Network is not available');
          error.name = 'SendMessageNetworkError';
          error.number = this.id;
          errors = [error];
        }
        await message.saveErrors(errors);
        return null;
      }

      this.queueJob(async () => {
        await this.sendMessageJob(message);
      });
      return null;
    },

    async updateAvatarOnPublicChat({ url, profileKey }) {
      if (!this.isPublic()) {
        return;
      }
      if (!this.get('profileSharing')) {
        return;
      }

      if (profileKey && typeof profileKey !== 'string') {
        // eslint-disable-next-line no-param-reassign
        profileKey = window.Signal.Crypto.arrayBufferToBase64(profileKey);
      }
      const serverAPI = await lokiPublicChatAPI.findOrCreateServer(
        this.get('server')
      );
      await serverAPI.setAvatar(url, profileKey);
    },
    async updateLastMessage() {
      if (!this.id) {
        return;
      }

      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        { limit: 1, MessageCollection: Whisper.MessageCollection }
      );

      const lastMessageModel = messages.at(0);
      const lastMessageJSON = lastMessageModel
        ? lastMessageModel.toJSON()
        : null;
      const lastMessageStatusModel = lastMessageModel
        ? lastMessageModel.getMessagePropStatus()
        : null;
      const lastMessageUpdate = Conversation.createLastMessageUpdate({
        currentTimestamp: this.get('timestamp') || null,
        lastMessage: lastMessageJSON,
        lastMessageStatus: lastMessageStatusModel,
        lastMessageNotificationText: lastMessageModel
          ? lastMessageModel.getNotificationText()
          : null,
      });

      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so our hasChanged() check below is useful.
      this.changed = {};
      this.set(lastMessageUpdate);

      if (this.hasChanged()) {
        await this.commit();
      }
    },



    async updateExpirationTimer(
      providedExpireTimer,
      providedSource,
      receivedAt,
      options = {}
    ) {
      let expireTimer = providedExpireTimer;
      let source = providedSource;

      _.defaults(options, { fromSync: false, fromGroupUpdate: false });

      if (!expireTimer) {
        expireTimer = null;
      }
      if (
        this.get('expireTimer') === expireTimer ||
        (!expireTimer && !this.get('expireTimer'))
      ) {
        return null;
      }

      window.log.info("Update conversation 'expireTimer'", {
        id: this.idForLogging(),
        expireTimer,
        source,
      });

      source = source || textsecure.storage.user.getNumber();

      // When we add a disappearing messages notification to the conversation, we want it
      //   to be above the message that initiated that change, hence the subtraction.
      const timestamp = (receivedAt || Date.now()) - 1;

      this.set({ expireTimer });
      await this.commit();

      const message = this.messageCollection.add({
        // Even though this isn't reflected to the user, we want to place the last seen
        //   indicator above it. We set it to 'unread' to trigger that placement.
        unread: 1,
        conversationId: this.id,
        // No type; 'incoming' messages are specially treated by conversation.markRead()
        sent_at: timestamp,
        received_at: timestamp,
        flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
        expirationTimerUpdate: {
          expireTimer,
          source,
          fromSync: options.fromSync,
          fromGroupUpdate: options.fromGroupUpdate,
        },
      });

      message.set({ destination: this.id });

      if (message.isOutgoing()) {
        message.set({ recipients: this.getRecipients() });
      }

      const id = await message.commit();

      message.set({ id });
      window.Whisper.events.trigger('messageAdded', {
        conversationKey: this.id,
        messageModel: message,
      });

      await this.commit();

      // if change was made remotely, don't send it to the number/group
      if (receivedAt) {
        return message;
      }

      let profileKey;
      if (this.get('profileSharing')) {
        profileKey = storage.get('profileKey');
      }

      const expireUpdate = {
        identifier: id,
        timestamp: message.get('sent_at'),
        expireTimer,
        profileKey,
      };

      if (this.isMe()) {
        const expirationTimerMessage = new libsession.Messages.Outgoing.ExpirationTimerUpdateMessage(
          expireUpdate
        );
        return message.sendSyncMessageOnly(expirationTimerMessage);
      }

      if (this.get('type') === 'private') {
        const expirationTimerMessage = new libsession.Messages.Outgoing.ExpirationTimerUpdateMessage(
          expireUpdate
        );
        const pubkey = new libsession.Types.PubKey(this.get('id'));
        await libsession
          .getMessageQueue()
          .sendToPubKey(pubkey, expirationTimerMessage);
      } else {
        expireUpdate.groupId = this.get('id');
        const expirationTimerMessage = new libsession.Messages.Outgoing.ExpirationTimerUpdateMessage(
          expireUpdate
        );
        // special case when we are the only member of a closed group
        const ourNumber = textsecure.storage.user.getNumber();

        if (
          this.get('members').length === 1 &&
          this.get('members')[0] === ourNumber
        ) {
          return message.sendSyncMessageOnly(expirationTimerMessage);
        }
        await libsession.getMessageQueue().sendToGroup(expirationTimerMessage);
      }
      return message;
    },

    isSearchable() {
      return !this.get('left');
    },

    async commit() {
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
      await this.trigger('change', this);
    },

    async addMessage(messageAttributes) {
      const message = this.messageCollection.add(messageAttributes);

      const messageId = await message.commit();
      message.set({ id: messageId });
      window.Whisper.events.trigger('messageAdded', {
        conversationKey: this.id,
        messageModel: message,
      });
      return message;
    },

    async leaveGroup() {
      if (this.get('type') !== 'group') {
        log.error('Cannot leave a non-group conversation');
        return;
      }

      if (this.isMediumGroup()) {
        await window.libsession.ClosedGroupV2.leaveClosedGroupV2(this.id);
      } else {
        throw new Error(
          'Legacy group are not supported anymore. You need to create this group again.'
        );
      }
    },

    async markRead(newestUnreadDate, providedOptions) {
      const options = providedOptions || {};
      _.defaults(options, { sendReadReceipts: true });

      const conversationId = this.id;
      Whisper.Notifications.remove(
        Whisper.Notifications.where({
          conversationId,
        })
      );
      let unreadMessages = await this.getUnread();

      const oldUnread = unreadMessages.filter(
        message => message.get('received_at') <= newestUnreadDate
      );

      let read = await Promise.all(
        _.map(oldUnread, async providedM => {
          const m = getMessageController().register(providedM.id, providedM);

          await m.markRead(options.readAt);
          const errors = m.get('errors');
          return {
            sender: m.get('source'),
            timestamp: m.get('sent_at'),
            hasErrors: Boolean(errors && errors.length),
          };
        })
      );

      // Some messages we're marking read are local notifications with no sender
      read = _.filter(read, m => Boolean(m.sender));
      const realUnreadCount = await this.getUnreadCount();
      if (read.length === 0) {
        const cachedUnreadCountOnConvo = this.get('unreadCount');
        if (cachedUnreadCountOnConvo !== read.length) {
          // reset the unreadCount on the convo to the real one coming from markRead messages on the db
          this.set({ unreadCount: 0 });
          this.commit();
        } else {
          // window.log.info('markRead(): nothing newly read.');
        }
        return;
      }
      unreadMessages = unreadMessages.filter(m => Boolean(m.isIncoming()));

      this.set({ unreadCount: realUnreadCount });

      const mentionRead = (() => {
        const stillUnread = unreadMessages.filter(
          m => m.get('received_at') > newestUnreadDate
        );
        const ourNumber = textsecure.storage.user.getNumber();
        return !stillUnread.some(
          m =>
            m.propsForMessage &&
            m.propsForMessage.text &&
            m.propsForMessage.text.indexOf(`@${ourNumber}`) !== -1
        );
      })();

      if (mentionRead) {
        this.set({ mentionedUs: false });
      }

      await this.commit();

      // If a message has errors, we don't want to send anything out about it.
      //   read syncs - let's wait for a client that really understands the message
      //      to mark it read. we'll mark our local error read locally, though.
      //   read receipts - here we can run into infinite loops, where each time the
      //      conversation is viewed, another error message shows up for the contact
      read = read.filter(item => !item.hasErrors);

      if (this.isPublic()) {
        window.log.debug('public conversation... No need to send read receipt');
        return;
      }

      if (this.isPrivate() && read.length && options.sendReadReceipts) {
        window.log.info(`Sending ${read.length} read receipts`);
        if (storage.get('read-receipt-setting')) {
          await Promise.all(
            _.map(_.groupBy(read, 'sender'), async (receipts, sender) => {
              const timestamps = _.map(receipts, 'timestamp');
              const receiptMessage = new libsession.Messages.Outgoing.ReadReceiptMessage(
                {
                  timestamp: Date.now(),
                  timestamps,
                }
              );

              const device = new libsession.Types.PubKey(sender);
              await libsession
                .getMessageQueue()
                .sendToPubKey(device, receiptMessage);
            })
          );
        }
      }
    },

    // LOKI PROFILES
    async setNickname(nickname) {
      const trimmed = nickname && nickname.trim();
      if (this.get('nickname') === trimmed) {
        return;
      }

      this.set({ nickname: trimmed });
      await this.commit();

      await this.updateProfileName();
    },
    async setLokiProfile(newProfile) {
      if (!_.isEqual(this.get('profile'), newProfile)) {
        this.set({ profile: newProfile });
        await this.commit();
      }

      // a user cannot remove an avatar. Only change it
      // if you change this behavior, double check all setLokiProfile calls (especially the one in EditProfileDialog)
      if (newProfile.avatar) {
        await this.setProfileAvatar({ path: newProfile.avatar });
      }

      await this.updateProfileName();
    },
    async updateProfileName() {
      // Prioritise nickname over the profile display name
      const nickname = this.getNickname();
      const profile = this.getLokiProfile();
      const displayName = profile && profile.displayName;

      const profileName = nickname || displayName || null;
      await this.setProfileName(profileName);
    },
    getLokiProfile() {
      return this.get('profile');
    },
    getNickname() {
      return this.get('nickname');
    },
    // maybe "Backend" instead of "Source"?
    async setPublicSource(newServer, newChannelId) {
      if (!this.isPublic()) {
        log.warn(
          `trying to setPublicSource on non public chat conversation ${this.id}`
        );
        return;
      }
      if (
        this.get('server') !== newServer ||
        this.get('channelId') !== newChannelId
      ) {
        // mark active so it's not in the contacts list but in the conversation list
        this.set({
          server: newServer,
          channelId: newChannelId,
          active_at: Date.now(),
        });
        await this.commit();
      }
    },
    getPublicSource() {
      if (!this.isPublic()) {
        log.warn(
          `trying to getPublicSource on non public chat conversation ${this.id}`
        );
        return null;
      }
      return {
        server: this.get('server'),
        channelId: this.get('channelId'),
        conversationId: this.get('id'),
      };
    },
    async getPublicSendData() {
      const channelAPI = await lokiPublicChatAPI.findOrCreateChannel(
        this.get('server'),
        this.get('channelId'),
        this.id
      );
      return channelAPI;
    },
    getLastRetrievedMessage() {
      if (!this.isPublic()) {
        return null;
      }
      const lastMessageId = this.get('lastPublicMessage') || 0;
      return lastMessageId;
    },
    async setLastRetrievedMessage(newLastMessageId) {
      if (!this.isPublic()) {
        return;
      }
      if (this.get('lastPublicMessage') !== newLastMessageId) {
        this.set({ lastPublicMessage: newLastMessageId });
        await this.commit();
      }
    },
    isAdmin(pubKey) {
      if (!this.isPublic()) {
        return false;
      }
      if (!pubKey) {
        throw new Error('isAdmin() pubKey is falsy');
      }
      const groupAdmins = this.getGroupAdmins();
      return Array.isArray(groupAdmins) && groupAdmins.includes(pubKey);
    },
    // SIGNAL PROFILES
    getProfiles() {
      // request all conversation members' keys
      let ids = [];
      if (this.isPrivate()) {
        ids = [this.id];
      } else {
        ids = this.get('members');
      }
      return Promise.all(_.map(ids, this.getProfile));
    },

    // This function is wrongly named by signal
    // This is basically an `update` function and thus we have overwritten it with such
    async getProfile(id) {
      const c = await window
        .getConversationController()
        .getOrCreateAndWait(id, 'private');

      // We only need to update the profile as they are all stored inside the conversation
      await c.updateProfileName();
    },
    async setProfileName(name) {
      const profileName = this.get('profileName');
      if (profileName !== name) {
        this.set({ profileName: name });
        await this.commit();
      }
    },
    async setGroupName(name) {
      const profileName = this.get('name');
      if (profileName !== name) {
        this.set({ name });
        await this.commit();
      }
    },
    async setSubscriberCount(count) {
      this.set({ subscriberCount: count });
      // Not sure if we care about updating the database
    },
    async setGroupNameAndAvatar(name, avatarPath) {
      const currentName = this.get('name');
      const profileAvatar = this.get('profileAvatar');
      if (profileAvatar !== avatarPath || currentName !== name) {
        // only update changed items
        if (profileAvatar !== avatarPath) {
          this.set({ profileAvatar: avatarPath });
        }
        if (currentName !== name) {
          this.set({ name });
        }
        // save
        await this.commit();
      }
    },
    async setProfileAvatar(avatar) {
      const profileAvatar = this.get('profileAvatar');
      if (profileAvatar !== avatar) {
        this.set({ profileAvatar: avatar });
        await this.commit();
      }
    },
    async setProfileKey(profileKey) {
      // profileKey is a string so we can compare it directly
      if (this.get('profileKey') !== profileKey) {
        window.log.info(
          `Setting sealedSender to UNKNOWN for conversation ${this.idForLogging()}`
        );
        this.set({
          profileKey,
          accessKey: null,
          sealedSender: SEALED_SENDER.UNKNOWN,
        });

        await this.deriveAccessKeyIfNeeded();

        await this.commit();
      }
    },

    async deriveAccessKeyIfNeeded() {
      const profileKey = this.get('profileKey');
      if (!profileKey) {
        return;
      }
      if (this.get('accessKey')) {
        return;
      }

      try {
        const profileKeyBuffer = window.Signal.Crypto.base64ToArrayBuffer(
          profileKey
        );
        const accessKeyBuffer = await window.Signal.Crypto.deriveAccessKey(
          profileKeyBuffer
        );
        const accessKey = window.Signal.Crypto.arrayBufferToBase64(
          accessKeyBuffer
        );
        this.set({ accessKey });
      } catch (e) {
        window.log.warn(`Failed to derive access key for ${this.id}`);
      }
    },

    async upgradeMessages(messages) {
      for (let max = messages.length, i = 0; i < max; i += 1) {
        const message = messages.at(i);
        const { attributes } = message;
        const { schemaVersion } = attributes;

        if (schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY) {
          // Yep, we really do want to wait for each of these
          // eslint-disable-next-line no-await-in-loop
          const upgradedMessage = await upgradeMessageSchema(attributes);
          message.set(upgradedMessage);
          // eslint-disable-next-line no-await-in-loop
          await upgradedMessage.commit();
        }
      }
    },

    hasMember(number) {
      return _.contains(this.get('members'), number);
    },
    fetchContacts() {
      if (this.isPrivate()) {
        this.contactCollection.reset([this]);
        return Promise.resolve();
      }
      const members = this.get('members') || [];
      const promises = members.map(number =>
        window.getConversationController().getOrCreateAndWait(number, 'private')
      );

      return Promise.all(promises).then(contacts => {
        this.contactCollection.reset(contacts);
      });
    },
    // returns true if this is a closed/medium or open group
    isGroup() {
      return this.get('type') === 'group';
    },

    copyPublicKey() {
      clipboard.writeText(this.id);

      window.libsession.Utils.ToastUtils.pushCopiedToClipBoard();
    },

    changeNickname() {
      window.Whisper.events.trigger('showNicknameDialog', {
        pubKey: this.id,
        nickname: this.getNickname(),
        onOk: newName => this.setNickname(newName),
      });
    },

    deleteContact() {
      let title = i18n('delete');
      let message = i18n('deleteContactConfirmation');

      if (this.isGroup()) {
        title = i18n('leaveGroup');
        message = i18n('leaveGroupConfirmation');
      }

      window.confirmationDialog({
        title,
        message,
        resolve: () => {
          window.getConversationController().deleteContact(this.id);
        },
      });
    },

    async deletePublicMessages(messages) {
      const channelAPI = await this.getPublicSendData();

      if (!channelAPI) {
        log.error('Unable to get public channel API');
        return false;
      }

      const invalidMessages = messages.filter(m => !m.attributes.serverId);
      const pendingMessages = messages.filter(m => m.attributes.serverId);

      let deletedServerIds = [];
      let ignoredServerIds = [];

      if (pendingMessages.length > 0) {
        const result = await channelAPI.deleteMessages(
          pendingMessages.map(m => m.attributes.serverId)
        );
        deletedServerIds = result.deletedIds;
        ignoredServerIds = result.ignoredIds;
      }

      const toDeleteLocallyServerIds = _.union(
        deletedServerIds,
        ignoredServerIds
      );
      let toDeleteLocally = messages.filter(m =>
        toDeleteLocallyServerIds.includes(m.attributes.serverId)
      );
      toDeleteLocally = _.union(toDeleteLocally, invalidMessages);

      toDeleteLocally.forEach(m => this.removeMessage(m.id));

      return toDeleteLocally;
    },

    removeMessage(messageId) {
      window.Signal.Data.removeMessage(messageId, {
        Message: Whisper.Message,
      });
      window.Whisper.events.trigger('messageDeleted', {
        conversationKey: this.id,
        messageId,
      });
    },

    deleteMessages() {
      let params;
      if (this.isPublic()) {
        throw new Error(
          'Called deleteMessages() on an open group. Only leave group is supported.'
        );
      } else {
        params = {
          title: i18n('deleteMessages'),
          message: i18n('deleteConversationConfirmation'),
          resolve: () => this.destroyMessages(),
        };
      }

      window.confirmationDialog(params);
    },

    async destroyMessages() {
      await window.Signal.Data.removeAllMessagesInConversation(this.id, {
        MessageCollection: Whisper.MessageCollection,
      });

      window.Whisper.events.trigger('conversationReset', {
        conversationKey: this.id,
      });
      // destroy message keeps the active timestamp set so the
      // conversation still appears on the conversation list but is empty
      this.set({
        lastMessage: null,
        unreadCount: 0,
        mentionedUs: false,
      });

      await this.commit();
    },

    getName() {
      if (this.isPrivate()) {
        return this.get('name');
      }
      return this.get('name') || i18n('unknown');
    },

    getTitle() {
      if (this.isPrivate()) {
        const profileName = this.getProfileName();
        const number = this.getNumber();
        let name;
        if (window.shortenPubkey) {
          name = profileName
            ? `${profileName} (${window.shortenPubkey(number)})`
            : number;
        } else {
          name = profileName ? `${profileName} (${number})` : number;
        }
        return this.get('name') || name;
      }
      return this.get('name') || 'Unknown group';
    },

    /**
     * For a private convo, returns the loki profilename if set, or a shortened
     * version of the contact pubkey.
     * Throws an error if called on a group convo.
     * */
    getContactProfileNameOrShortenedPubKey() {
      if (!this.isPrivate()) {
        throw new Error(
          'getContactProfileNameOrShortenedPubKey() cannot be called with a non private convo.'
        );
      }

      const profileName = this.get('profileName');
      const pubkey = this.id;
      if (pubkey === textsecure.storage.user.getNumber()) {
        return i18n('you');
      }
      return profileName || window.shortenPubkey(pubkey);
    },

    /**
     * For a private convo, returns the loki profilename if set, or a full length
     * version of the contact pubkey.
     * Throws an error if called on a group convo.
     * */
    getContactProfileNameOrFullPubKey() {
      if (!this.isPrivate()) {
        throw new Error(
          'getContactProfileNameOrFullPubKey() cannot be called with a non private convo.'
        );
      }
      const profileName = this.get('profileName');
      const pubkey = this.id;
      if (pubkey === textsecure.storage.user.getNumber()) {
        return i18n('you');
      }
      return profileName || pubkey;
    },

    getProfileName() {
      if (this.isPrivate() && !this.get('name')) {
        return this.get('profileName');
      }
      return null;
    },

    /**
     * Returns
     *   displayName: string;
     *   avatarPointer: string;
     *   profileKey: Uint8Array;
     */
    getOurProfile() {
      try {
        // Secondary devices have their profile stored
        // in their primary device's conversation
        const ourNumber = window.storage.get('primaryDevicePubKey');
        const ourConversation = window
          .getConversationController()
          .get(ourNumber);
        let profileKey = null;
        if (this.get('profileSharing')) {
          profileKey = new Uint8Array(storage.get('profileKey'));
        }
        const avatarPointer = ourConversation.get('avatarPointer');
        const { displayName } = ourConversation.getLokiProfile();
        return { displayName, avatarPointer, profileKey };
      } catch (e) {
        window.log.error(`Failed to get our profile: ${e}`);
        return null;
      }
    },

    getNumber() {
      if (!this.isPrivate()) {
        return '';
      }
      return this.id;
    },

    isPrivate() {
      return this.get('type') === 'private';
    },

    getAvatarPath() {
      const avatar = this.get('avatar') || this.get('profileAvatar');
      if (typeof avatar === 'string') {
        return avatar;
      }

      if (avatar && avatar.path && typeof avatar.path === 'string') {
        return getAbsoluteAttachmentPath(avatar.path);
      }

      return null;
    },
    getAvatar() {
      const url = this.getAvatarPath();

      return { url: url || null };
    },

    getNotificationIcon() {
      return new Promise(resolve => {
        const avatar = this.getAvatar();
        if (avatar.url) {
          resolve(avatar.url);
        } else {
          resolve(new Whisper.IdenticonSVGView(avatar).getDataUrl());
        }
      });
    },

    notify(message) {
      if (!message.isIncoming()) {
        return Promise.resolve();
      }
      const conversationId = this.id;

      return window
        .getConversationController()
        .getOrCreateAndWait(message.get('source'), 'private')
        .then(sender =>
          sender.getNotificationIcon().then(iconUrl => {
            const messageJSON = message.toJSON();
            const messageSentAt = messageJSON.sent_at;
            const messageId = message.id;
            const isExpiringMessage = Message.hasExpiration(messageJSON);

            // window.log.info('Add notification', {
            //   conversationId: this.idForLogging(),
            //   isExpiringMessage,
            //   messageSentAt,
            // });
            Whisper.Notifications.add({
              conversationId,
              iconUrl,
              isExpiringMessage,
              message: message.getNotificationText(),
              messageId,
              messageSentAt,
              title: sender.getTitle(),
            });
          })
        );
    },
    notifyTyping({ isTyping, sender }) {
      // We don't do anything with typing messages from our other devices
      if (sender === this.ourNumber) {
        return;
      }

      // For groups, block typing messages from non-members (e.g. from kicked members)
      if (this.get('type') === 'group') {
        const knownMembers = this.get('members');

        if (knownMembers) {
          const fromMember = knownMembers.includes(sender);

          if (!fromMember) {
            window.log.warn(
              'Blocking typing messages from a non-member: ',
              sender
            );
            return;
          }
        }
      }

      this.contactTypingTimers = this.contactTypingTimers || {};
      const record = this.contactTypingTimers[sender];

      if (record) {
        clearTimeout(record.timer);
      }

      // Note: We trigger two events because:
      //   'change' causes a re-render of this conversation's list item in the left pane

      if (isTyping) {
        this.contactTypingTimers[sender] = this.contactTypingTimers[sender] || {
          timestamp: Date.now(),
          sender,
        };

        this.contactTypingTimers[sender].timer = setTimeout(
          this.clearContactTypingTimer.bind(this, sender),
          15 * 1000
        );
        if (!record) {
          // User was not previously typing before. State change!
          this.commit();
        }
      } else {
        delete this.contactTypingTimers[sender];
        if (record) {
          // User was previously typing, and is no longer. State change!
          this.commit();
        }
      }
    },

    clearContactTypingTimer(sender) {
      this.contactTypingTimers = this.contactTypingTimers || {};
      const record = this.contactTypingTimers[sender];

      if (record) {
        clearTimeout(record.timer);
        delete this.contactTypingTimers[sender];

        // User was previously typing, but timed out or we received message. State change!
        this.commit();
      }
    },
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    model: Whisper.Conversation,

    comparator(m) {
      return -m.get('timestamp');
    },

    async destroyAll() {
      await Promise.all(
        this.models.map(conversation =>
          window.Signal.Data.removeConversation(conversation.id, {
            Conversation: Whisper.Conversation,
          })
        )
      );
      this.reset([]);
    },
  });
})();
