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
    // eslint-disable-next-line no-unused-vars
    writeNewAttachmentData,
    deleteAttachmentData,
  } = window.Signal.Migrations;

  // Possible session reset states
  const SessionResetEnum = Object.freeze({
    // No ongoing reset
    none: 0,
    // we initiated the session reset
    initiated: 1,
    // we received the session reset
    request_received: 2,
  });

  Whisper.Conversation = Backbone.Model.extend({
    storeName: 'conversations',
    defaults() {
      return {
        unreadCount: 0,
        verified: textsecure.storage.protocol.VerifiedStatus.DEFAULT,
        sessionResetStatus: SessionResetEnum.none,
        groupAdmins: [],
        isKickedFromGroup: false,
        isOnline: false,
        profileSharing: false,
      };
    },

    idForLogging() {
      if (this.isPrivate()) {
        return this.id;
      }

      return `group(${this.id})`;
    },

    handleMessageError(message, errors) {
      this.trigger('messageError', message, errors);
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
      this.verifiedEnum = textsecure.storage.protocol.VerifiedStatus;

      // This may be overridden by ConversationController.getOrCreate, and signify
      //   our first save to the database. Or first fetch from the database.
      this.initialPromise = Promise.resolve();

      this.contactCollection = this.getContactCollection();
      this.messageCollection = new Whisper.MessageCollection([], {
        conversation: this,
      });

      this.messageCollection.on('change:errors', this.handleMessageError, this);
      this.messageCollection.on('send-error', this.onMessageError, this);

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
      this.listenTo(this.messageCollection, 'sent', this.updateLastMessage);
      this.listenTo(
        this.messageCollection,
        'send-error',
        this.updateLastMessage
      );

      this.on('newmessage', this.onNewMessage);
      this.on('change:profileKey', this.onChangeProfileKey);

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

    isOnline() {
      return this.isMe() || this.get('isOnline');
    },
    isMe() {
      return this.isOurLocalDevice() || this.isOurPrimaryDevice();
    },
    isOurPrimaryDevice() {
      return this.id === window.storage.get('primaryDevicePubKey');
    },
    async isOurDevice() {
      if (this.isMe()) {
        return true;
      }

      return window.libsession.Protocols.MultiDeviceProtocol.isOurDevice(
        this.id
      );
    },
    isOurLocalDevice() {
      return this.id === this.ourNumber;
    },
    isPublic() {
      return !!(this.id && this.id.match(/^publicChat:/));
    },
    isClosedGroup() {
      return (
        this.get('type') === Message.GROUP && !this.isPublic() && !this.isRss()
      );
    },
    isClosable() {
      return !this.isRss() || this.get('closable');
    },
    isRss() {
      return !!(this.id && this.id.match(/^rss:/));
    },
    isBlocked() {
      if (!this.id || this.isMe()) {
        return false;
      }

      if (this.isClosedGroup()) {
        return BlockedNumberController.isGroupBlocked(this.id);
      }

      if (this.isPrivate()) {
        const primary = this.getPrimaryDevicePubKey();
        return BlockedNumberController.isBlocked(primary);
      }

      return false;
    },
    isMediumGroup() {
      return this.get('is_medium_group');
    },
    async block() {
      if (!this.id || this.isPublic() || this.isRss()) {
        return;
      }

      const promise = this.isPrivate()
        ? BlockedNumberController.block(this.id)
        : BlockedNumberController.blockGroup(this.id);
      await promise;
      this.trigger('change', this);
      this.messageCollection.forEach(m => m.trigger('change'));
      this.updateTextInputState();
      await textsecure.messaging.sendBlockedListSyncMessage();
    },
    async unblock() {
      if (!this.id || this.isPublic() || this.isRss()) {
        return;
      }
      const promise = this.isPrivate()
        ? BlockedNumberController.unblock(this.id)
        : BlockedNumberController.unblockGroup(this.id);
      await promise;
      this.trigger('change', this);
      this.messageCollection.forEach(m => m.trigger('change'));
      this.updateTextInputState();
      await textsecure.messaging.sendBlockedListSyncMessage();
    },
    async bumpTyping() {
      if (this.isPublic()) {
        window.log.debug('public conversation... No need to bumpTyping');
        return;
      }
      // We don't send typing messages if the setting is disabled or we do not have a session
      // or we blocked that user
      const devicePubkey = new libsession.Types.PubKey(this.id);
      const hasSession = await libsession.Protocols.SessionProtocol.hasSession(
        devicePubkey
      );

      if (
        !storage.get('typing-indicators-setting') ||
        !hasSession ||
        this.isBlocked()
      ) {
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
      // Loki - Temporarily disable typing messages for groups
      if (!this.isPrivate()) {
        return;
      }

      const groupId = !this.isPrivate() ? this.id : null;
      const recipientId = this.isPrivate() ? this.id : null;

      // We don't want to send typing messages to our other devices, but we will
      //   in the group case.
      const primaryDevicePubkey = window.storage.get('primaryDevicePubKey');
      if (recipientId && primaryDevicePubkey === recipientId) {
        return;
      }

      if (!recipientId && !groupId) {
        throw new Error('Need to provide either recipientId or groupId!');
      }

      const typingParams = {
        timestamp: Date.now(),
        isTyping,
        typingTimestamp: Date.now(),
        groupId, // might be null
      };
      const typingMessage = new libsession.Messages.Outgoing.TypingMessage(
        typingParams
      );

      // send the message to a single recipient if this is a session chat
      if (this.isPrivate()) {
        const device = new libsession.Types.PubKey(recipientId);
        libsession
          .getMessageQueue()
          .sendUsingMultiDevice(device, typingMessage)
          .catch(log.error);
      } else {
        // the recipients on the case of a group are found by the messageQueue using message.groupId
        libsession
          .getMessageQueue()
          .sendToGroup(typingMessage)
          .catch(log.error);
      }
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
      if (this.isRss() || this.isPublic()) {
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

    async onPublicMessageSent(pubKey, timestamp, serverId, serverTimestamp) {
      const messages = this.getMessagesWithTimestamp(pubKey, timestamp);
      if (messages && messages.length === 1) {
        await messages[0].setIsPublic(true);
        await messages[0].setServerId(serverId);
        await messages[0].setServerTimestamp(serverTimestamp);
      }
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

      this.trigger('change', this);
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
    getProps() {
      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');
      const typingKeys = Object.keys(this.contactTypingTimers || {});

      const result = {
        id: this.id,
        isArchived: this.get('isArchived'),
        activeAt: this.get('active_at'),
        avatarPath: this.getAvatarPath(),
        type: this.isPrivate() ? 'direct' : 'group',
        isMe: this.isMe(),
        isPublic: this.isPublic(),
        isRss: this.isRss(),
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
        isSecondary: !!this.get('secondaryStatus'),
        primaryDevice: this.getPrimaryDevicePubKey(),
        phoneNumber: format(this.id, {
          ourRegionCode: regionCode,
        }),
        lastMessage: {
          status: this.get('lastMessageStatus'),
          text: this.get('lastMessage'),
          isRss: this.isRss(),
        },
        isOnline: this.isOnline(),
        hasNickname: !!this.getNickname(),
        isKickedFromGroup: !!this.get('isKickedFromGroup'),
        leftGroup: !!this.get('left'),

        onClick: () => this.trigger('select', this),
        onBlockContact: () => this.block(),
        onUnblockContact: () => this.unblock(),
        onCopyPublicKey: () => this.copyPublicKey(),
        onDeleteContact: () => this.deleteContact(),
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

    onMessageError() {
      this.updateVerified();
    },
    safeGetVerified() {
      const promise = textsecure.storage.protocol.getVerified(this.id);
      return promise.catch(
        () => textsecure.storage.protocol.VerifiedStatus.DEFAULT
      );
    },
    async updateVerified() {
      if (this.isPrivate()) {
        await this.initialPromise;
        const verified = await this.safeGetVerified();

        this.set({ verified });

        // we don't await here because we don't need to wait for this to finish
        this.commit();

        return;
      }

      await this.fetchContacts();
      await Promise.all(
        this.contactCollection.map(async contact => {
          if (!contact.isMe()) {
            await contact.updateVerified();
          }
        })
      );

      this.onMemberVerifiedChange();
    },
    setVerifiedDefault(options) {
      const { DEFAULT } = this.verifiedEnum;
      return this.queueJob(() => this._setVerified(DEFAULT, options));
    },
    setVerified(options) {
      const { VERIFIED } = this.verifiedEnum;
      return this.queueJob(() => this._setVerified(VERIFIED, options));
    },
    setUnverified(options) {
      const { UNVERIFIED } = this.verifiedEnum;
      return this.queueJob(() => this._setVerified(UNVERIFIED, options));
    },
    async _setVerified(verified, providedOptions) {
      const options = providedOptions || {};
      _.defaults(options, {
        viaSyncMessage: false,
        viaContactSync: false,
        key: null,
      });

      const { VERIFIED, UNVERIFIED } = this.verifiedEnum;

      if (!this.isPrivate()) {
        throw new Error(
          'You cannot verify a group conversation. ' +
            'You must verify individual contacts.'
        );
      }

      const beginningVerified = this.get('verified');
      let keyChange;
      if (options.viaSyncMessage) {
        // handle the incoming key from the sync messages - need different
        // behavior if that key doesn't match the current key
        keyChange = await textsecure.storage.protocol.processVerifiedMessage(
          this.id,
          verified,
          options.key
        );
      } else {
        keyChange = await textsecure.storage.protocol.setVerified(
          this.id,
          verified
        );
      }

      this.set({ verified });
      await this.commit();

      // Three situations result in a verification notice in the conversation:
      //   1) The message came from an explicit verification in another client (not
      //      a contact sync)
      //   2) The verification value received by the contact sync is different
      //      from what we have on record (and it's not a transition to UNVERIFIED)
      //   3) Our local verification status is VERIFIED and it hasn't changed,
      //      but the key did change (Key1/VERIFIED to Key2/VERIFIED - but we don't
      //      want to show DEFAULT->DEFAULT or UNVERIFIED->UNVERIFIED)
      if (
        !options.viaContactSync ||
        (beginningVerified !== verified && verified !== UNVERIFIED) ||
        (keyChange && verified === VERIFIED)
      ) {
        await this.addVerifiedChange(this.id, verified === VERIFIED, {
          local: !options.viaSyncMessage,
        });
      }
      if (!options.viaSyncMessage) {
        await this.sendVerifySyncMessage(this.id, verified);
      }
    },
    async sendVerifySyncMessage(number, state) {
      const key = await textsecure.storage.protocol.loadIdentityKey(number);
      return textsecure.messaging.syncVerification(number, state, key);
    },
    isVerified() {
      if (this.isPrivate()) {
        return this.get('verified') === this.verifiedEnum.VERIFIED;
      }
      if (!this.contactCollection.length) {
        return false;
      }

      return this.contactCollection.every(contact => {
        if (contact.isMe()) {
          return true;
        }
        return contact.isVerified();
      });
    },
    async getPrimaryConversation() {
      if (!this.isSecondaryDevice()) {
        // This is already the primary conversation
        return this;
      }

      const device = window.libsession.Types.PubKey.from(this.id);
      if (device) {
        const primary = await window.libsession.Protocols.MultiDeviceProtocol.getPrimaryDevice(
          device
        );

        return window
          .getConversationController()
          .getOrCreateAndWait(primary.key, 'private');
      }

      // Something funky has happened
      return this;
    },
    async updateTextInputState() {
      if (this.isRss()) {
        // or if we're an rss conversation, disable it
        this.trigger('disable:input', true);
        return;
      }
      if (this.isSecondaryDevice()) {
        // Or if we're a secondary device, update the primary device text input
        const primaryConversation = await this.getPrimaryConversation();
        primaryConversation.updateTextInputState();
        return;
      }
      if (this.get('isKickedFromGroup')) {
        this.trigger('disable:input', true);
        return;
      }
      if (!this.isPrivate() && this.get('left')) {
        this.trigger('disable:input', true);
        this.trigger('change:placeholder', 'left-group');
        return;
      }
      if (this.isBlocked()) {
        this.trigger('disable:input', true);
        this.trigger('change:placeholder', 'blocked-user');
        return;
      }
      // otherwise, enable the input and set default placeholder
      this.trigger('disable:input', false);
      this.trigger('change:placeholder', 'chat');
    },
    isSecondaryDevice() {
      return !!this.get('secondaryStatus');
    },
    getPrimaryDevicePubKey() {
      return this.get('primaryDevicePubKey') || this.id;
    },
    async setSecondaryStatus(newStatus, primaryDevicePubKey) {
      if (this.get('secondaryStatus') !== newStatus) {
        this.set({
          secondaryStatus: newStatus,
          primaryDevicePubKey,
        });
        await this.commit();
      }
    },
    async updateGroupAdmins(groupAdmins) {
      this.set({ groupAdmins });
      await this.commit();
    },
    isUnverified() {
      if (this.isPrivate()) {
        const verified = this.get('verified');
        return (
          verified !== this.verifiedEnum.VERIFIED &&
          verified !== this.verifiedEnum.DEFAULT
        );
      }
      if (!this.contactCollection.length) {
        return true;
      }

      return this.contactCollection.any(contact => {
        if (contact.isMe()) {
          return false;
        }
        return contact.isUnverified();
      });
    },
    getUnverified() {
      if (this.isPrivate()) {
        return this.isUnverified()
          ? new Backbone.Collection([this])
          : new Backbone.Collection();
      }
      return new Backbone.Collection(
        this.contactCollection.filter(contact => {
          if (contact.isMe()) {
            return false;
          }
          return contact.isUnverified();
        })
      );
    },
    setApproved() {
      if (!this.isPrivate()) {
        throw new Error(
          'You cannot set a group conversation as trusted. ' +
            'You must set individual contacts as trusted.'
        );
      }

      return textsecure.storage.protocol.setApproval(this.id, true);
    },
    safeIsUntrusted() {
      return textsecure.storage.protocol
        .isUntrusted(this.id)
        .catch(() => false);
    },
    isUntrusted() {
      if (this.isPrivate()) {
        return this.safeIsUntrusted();
      }
      if (!this.contactCollection.length) {
        return Promise.resolve(false);
      }

      return Promise.all(
        this.contactCollection.map(contact => {
          if (contact.isMe()) {
            return false;
          }
          return contact.safeIsUntrusted();
        })
      ).then(results => _.any(results, result => result));
    },
    getUntrusted() {
      // This is a bit ugly because isUntrusted() is async. Could do the work to cache
      //   it locally, but we really only need it for this call.
      if (this.isPrivate()) {
        return this.isUntrusted().then(untrusted => {
          if (untrusted) {
            return new Backbone.Collection([this]);
          }

          return new Backbone.Collection();
        });
      }
      return Promise.all(
        this.contactCollection.map(contact => {
          if (contact.isMe()) {
            return [false, contact];
          }
          return Promise.all([contact.isUntrusted(), contact]);
        })
      ).then(results => {
        const filtered = _.filter(results, result => {
          const untrusted = result[0];
          return untrusted;
        });
        return new Backbone.Collection(
          _.map(filtered, result => {
            const contact = result[1];
            return contact;
          })
        );
      });
    },
    onMemberVerifiedChange() {
      // If the verified state of a member changes, our aggregate state changes.
      // We trigger both events to replicate the behavior of Backbone.Model.set()
      this.trigger('change:verified', this);
      this.trigger('change', this);
    },
    toggleVerified() {
      if (this.isVerified()) {
        return this.setVerifiedDefault();
      }
      return this.setVerified();
    },

    async addKeyChange(keyChangedId) {
      window.log.info(
        'adding key change advisory for',
        this.idForLogging(),
        keyChangedId,
        this.get('timestamp')
      );

      const timestamp = Date.now();
      const message = {
        conversationId: this.id,
        type: 'keychange',
        sent_at: this.get('timestamp'),
        received_at: timestamp,
        key_changed: keyChangedId,
        unread: 1,
      };

      // no commit() here as this is not a message model object
      const id = await window.Signal.Data.saveMessage(message, {
        Message: Whisper.Message,
      });

      this.trigger(
        'newmessage',
        new Whisper.Message({
          ...message,
          id,
        })
      );
    },
    // Remove the message locally from our conversation
    async _removeMessage(id) {
      await window.Signal.Data.removeMessage(id, { Message: Whisper.Message });
      const existing = this.messageCollection.get(id);
      if (existing) {
        this.messageCollection.remove(id);
        existing.trigger('destroy');
      }
    },
    async addVerifiedChange(verifiedChangeId, verified, providedOptions) {
      const options = providedOptions || {};
      _.defaults(options, { local: true });

      if (this.isMe()) {
        window.log.info(
          'refusing to add verified change advisory for our own number'
        );
        return;
      }

      const lastMessage = this.get('timestamp') || Date.now();

      window.log.info(
        'adding verified change advisory for',
        this.idForLogging(),
        verifiedChangeId,
        lastMessage
      );

      const timestamp = Date.now();
      const message = {
        conversationId: this.id,
        type: 'verified-change',
        sent_at: lastMessage,
        received_at: timestamp,
        verifiedChanged: verifiedChangeId,
        verified,
        local: options.local,
        unread: 1,
      };

      // no commit() here as this is not a message model object
      const id = await window.Signal.Data.saveMessage(message, {
        Message: Whisper.Message,
      });

      this.trigger(
        'newmessage',
        new Whisper.Message({
          ...message,
          id,
        })
      );

      if (this.isPrivate()) {
        window
          .getConversationController()
          .getAllGroupsInvolvingId(this.id)
          .then(groups => {
            _.forEach(groups, group => {
              group.addVerifiedChange(this.id, verified, options);
            });
          });
      }
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

        if (this.isMe()) {
          // we need the return await so that errors are caught in the catch {}
          return await message.sendSyncMessageOnly(chatMessage);
        }

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
              .sendUsingMultiDevice(destinationPubkey, groupInvitMessage);
          }
          // we need the return await so that errors are caught in the catch {}
          return await libsession
            .getMessageQueue()
            .sendUsingMultiDevice(destinationPubkey, chatMessage);
        }

        if (this.isMediumGroup()) {
          const mediumGroupChatMessage = new libsession.Messages.Outgoing.MediumGroupChatMessage(
            {
              chatMessage,
              groupId: destination,
            }
          );

          // we need the return await so that errors are caught in the catch {}
          return await libsession
            .getMessageQueue()
            .sendToGroup(mediumGroupChatMessage);
        }

        if (this.isClosedGroup()) {
          const members = this.get('members');
          const closedGroupChatMessage = new libsession.Messages.Outgoing.ClosedGroupChatMessage(
            {
              chatMessage,
              groupId: destination,
            }
          );

          // Special-case the self-send case - we send only a sync message
          if (members.length === 1) {
            const isOurDevice = await libsession.Protocols.MultiDeviceProtocol.isOurDevice(
              members[0]
            );
            if (isOurDevice) {
              // we need the return await so that errors are caught in the catch {}
              return await message.sendSyncMessageOnly(closedGroupChatMessage);
            }
          }
          // we need the return await so that errors are caught in the catch {}
          return await libsession
            .getMessageQueue()
            .sendToGroup(closedGroupChatMessage);
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
      groupInvitation = null,
      otherOptions = {}
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

      const { sessionRestoration = false } = otherOptions;

      const attributes = {
        ...messageWithSchema,
        groupInvitation,
        sessionRestoration,
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
        isArchived: false,
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
      if (this.isRss()) {
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

    async setArchived(isArchived) {
      this.set({ isArchived });
      await this.commit();
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
          .sendUsingMultiDevice(pubkey, expirationTimerMessage);
      } else {
        expireUpdate.groupId = this.get('id');
        const expirationTimerMessage = new libsession.Messages.Outgoing.ExpirationTimerUpdateMessage(
          expireUpdate
        );
        // special case when we are the only member of a closed group
        const ourNumber = textsecure.storage.user.getNumber();
        const primary = await libsession.Protocols.MultiDeviceProtocol.getPrimaryDevice(
          ourNumber
        );
        if (
          this.get('members').length === 1 &&
          this.get('members')[0] === primary.key
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
    async setSessionResetStatus(newStatus) {
      // Ensure that the new status is a valid SessionResetEnum value
      if (!(newStatus in Object.values(SessionResetEnum))) {
        return;
      }
      if (this.get('sessionResetStatus') !== newStatus) {
        this.set({ sessionResetStatus: newStatus });
        await this.commit();
      }
    },
    async onSessionResetInitiated() {
      await this.setSessionResetStatus(SessionResetEnum.initiated);
    },
    async onSessionResetReceived() {
      await this.createAndStoreEndSessionMessage({
        type: 'incoming',
        endSessionType: 'ongoing',
      });
      await this.setSessionResetStatus(SessionResetEnum.request_received);
    },

    isSessionResetReceived() {
      return (
        this.get('sessionResetStatus') === SessionResetEnum.request_received
      );
    },

    isSessionResetOngoing() {
      return this.get('sessionResetStatus') !== SessionResetEnum.none;
    },

    async createAndStoreEndSessionMessage(attributes) {
      const now = Date.now();
      const message = this.messageCollection.add({
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: now,
        destination: this.id,
        recipients: this.getRecipients(),
        flags: textsecure.protobuf.DataMessage.Flags.END_SESSION,
        ...attributes,
      });

      const id = await message.commit();
      message.set({ id });
      window.Whisper.events.trigger('messageAdded', {
        conversationKey: this.id,
        messageModel: message,
      });
      return message;
    },

    async onNewSessionAdopted() {
      if (this.get('sessionResetStatus') === SessionResetEnum.initiated) {
        // send empty message to confirm that we have adopted the new session
        const user = new libsession.Types.PubKey(this.id);

        const sessionEstablished = new window.libsession.Messages.Outgoing.SessionEstablishedMessage(
          { timestamp: Date.now() }
        );
        await libsession.getMessageQueue().send(user, sessionEstablished);
      }
      await this.createAndStoreEndSessionMessage({
        type: 'incoming',
        endSessionType: 'done',
      });
      await this.setSessionResetStatus(SessionResetEnum.none);
    },

    async endSession() {
      if (this.isPrivate()) {
        // Only create a new message if *we* initiated the session reset.
        // On the receiver side, the actual message containing the END_SESSION flag
        // will ensure the "session reset" message will be added to their conversation.
        if (
          this.get('sessionResetStatus') !== SessionResetEnum.request_received
        ) {
          await this.onSessionResetInitiated();
          // const message = await this.createAndStoreEndSessionMessage({
          //   type: 'outgoing',
          //   endSessionType: 'ongoing',
          // });
          // window.log.info('resetting secure session');
          // const device = new libsession.Types.PubKey(this.id);
          // const preKeyBundle = await window.libloki.storage.getPreKeyBundleForContact(
          //   device.key
          // );
          // // const endSessionMessage = new libsession.Messages.Outgoing.EndSessionMessage(
          // //   {
          // //     timestamp: message.get('sent_at'),
          // //     preKeyBundle,
          // //   }
          // // );

          // // await libsession.getMessageQueue().send(device, endSessionMessage);
          // // // TODO handle errors to reset session reset status with the new pipeline
          // // if (message.hasErrors()) {
          // //   await this.setSessionResetStatus(SessionResetEnum.none);
          // // }
        }
      }
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

    async sendGroupInfo(recipient) {
      // Only send group info if we're a closed group and we haven't left
      if (this.isClosedGroup() && !this.get('left')) {
        const updateParams = {
          timestamp: Date.now(),
          groupId: this.id,
          name: this.get('name'),
          avatar: this.get('avatar'),
          members: this.get('members'),
          admins: this.get('groupAdmins'),
        };
        const groupUpdateMessage = new libsession.Messages.Outgoing.ClosedGroupUpdateMessage(
          updateParams
        );
        const recipientPubKey = new libsession.Types.PubKey(recipient);
        if (!recipientPubKey) {
          window.log.warn('sendGroupInfo invalid pubkey:', recipient);
          return;
        }

        try {
          await libsession
            .getMessageQueue()
            .send(recipientPubKey, groupUpdateMessage);

          const expireTimer = this.get('expireTimer');

          if (!expireTimer) {
            return;
          }

          const expireUpdate = {
            timestamp: Date.now(),
            expireTimer,
            groupId: this.get('id'),
          };

          const expirationTimerMessage = new libsession.Messages.Outgoing.ExpirationTimerUpdateMessage(
            expireUpdate
          );

          await libsession
            .getMessageQueue()
            .sendUsingMultiDevice(recipientPubKey, expirationTimerMessage);
        } catch (e) {
          log.error('Failed to send groupInfo:', e);
        }
      }
    },

    async leaveGroup() {
      if (this.get('type') !== 'group') {
        log.error('Cannot leave a non-group conversation');
        return;
      }

      if (this.isMediumGroup()) {
        await window.MediumGroups.leaveMediumGroup(this.id);
      } else {
        const now = Date.now();

        this.set({ left: true });
        this.commit();

        const message = this.messageCollection.add({
          group_update: { left: 'You' },
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
        });

        const id = await message.commit();
        message.set({ id });
        window.Whisper.events.trigger('messageAdded', {
          conversationKey: this.id,
          messageModel: message,
        });

        // FIXME what about public groups?
        const quitGroup = {
          identifier: id,
          timestamp: now,
          groupId: this.id,
          // if we do set an identifier here, be sure to not sync it a second time in handleMessageSentSuccess()
        };
        const quitGroupMessage = new libsession.Messages.Outgoing.ClosedGroupLeaveMessage(
          quitGroup
        );

        const members = this.get('members');

        await window.MediumGroups.sendClosedGroupMessage(
          quitGroupMessage,
          members,
          message
        );
      }

      this.updateTextInputState();
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

      const devicePubkey = new libsession.Types.PubKey(this.id);
      const hasSession = await libsession.Protocols.SessionProtocol.hasSession(
        devicePubkey
      );
      if (!hasSession) {
        return;
      }

      if (this.isPrivate() && read.length && options.sendReadReceipts) {
        window.log.info(`Sending ${read.length} read receipts`);
        // Because syncReadMessages sends to our other devices, and sendReadReceipts goes
        //   to a contact, we need accessKeys for both.
        await textsecure.messaging.syncReadMessages(read);

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
                .sendUsingMultiDevice(device, receiptMessage);
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
    getRssSettings() {
      if (!this.isRss()) {
        return null;
      }
      return {
        RSS_FEED: this.get('rssFeed'),
        CONVO_ID: this.id,
        title: this.get('name'),
        closeable: this.get('closable'),
      };
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
    isModerator(pubKey) {
      if (!this.isPublic()) {
        return false;
      }
      const moderators = this.get('moderators');
      return Array.isArray(moderators) && moderators.includes(pubKey);
    },
    async setModerators(moderators) {
      if (!this.isPublic()) {
        return;
      }
      // TODO: compare array properly
      if (!_.isEqual(this.get('moderators'), moderators)) {
        this.set({ moderators });
        await this.commit();
      }
    },

    // SIGNAL PROFILES

    onChangeProfileKey() {
      if (this.isPrivate()) {
        this.getProfiles();
      }
    },

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
        _.forEach(contacts, contact => {
          this.listenTo(
            contact,
            'change:verified',
            this.onMemberVerifiedChange
          );
        });

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
      const message = this.messageCollection.models.find(
        msg => msg.id === messageId
      );
      if (message) {
        message.trigger('unload');
        this.messageCollection.remove(messageId);
      }
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

      this.messageCollection.reset([]);
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
    notifyTyping(options = {}) {
      const { isTyping, sender, senderDevice } = options;

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

      const identifier = `${sender}.${senderDevice}`;

      this.contactTypingTimers = this.contactTypingTimers || {};
      const record = this.contactTypingTimers[identifier];

      if (record) {
        clearTimeout(record.timer);
      }

      // Note: We trigger two events because:
      //   'typing-update' is a surgical update ConversationView does for in-convo bubble
      //   'change' causes a re-render of this conversation's list item in the left pane

      if (isTyping) {
        this.contactTypingTimers[identifier] = this.contactTypingTimers[
          identifier
        ] || {
          timestamp: Date.now(),
          sender,
          senderDevice,
        };

        this.contactTypingTimers[identifier].timer = setTimeout(
          this.clearContactTypingTimer.bind(this, identifier),
          15 * 1000
        );
        if (!record) {
          // User was not previously typing before. State change!
          this.trigger('typing-update');
          this.trigger('change', this);
        }
      } else {
        delete this.contactTypingTimers[identifier];
        if (record) {
          // User was previously typing, and is no longer. State change!
          this.trigger('typing-update');
          this.trigger('change', this);
        }
      }
    },

    clearContactTypingTimer(identifier) {
      this.contactTypingTimers = this.contactTypingTimers || {};
      const record = this.contactTypingTimers[identifier];

      if (record) {
        clearTimeout(record.timer);
        delete this.contactTypingTimers[identifier];

        // User was previously typing, but timed out or we received message. State change!
        this.trigger('typing-update');
        this.trigger('change', this);
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
