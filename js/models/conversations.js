/* global
  $,
  _,
  log,
  i18n,
  Backbone,
  ConversationController,
  MessageController,
  storage,
  textsecure,
  Whisper,
  profileImages,
  clipboard,
  BlockedNumberController,
  lokiPublicChatAPI,
  JobQueue
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

  const { Util } = window.Signal;
  const {
    Conversation,
    Contact,
    Errors,
    Message,
    PhoneNumber,
  } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    loadAttachmentData,
    getAbsoluteAttachmentPath,
    // eslint-disable-next-line no-unused-vars
    writeNewAttachmentData,
    deleteAttachmentData,
  } = window.Signal.Migrations;

  // Possible conversation friend states
  const FriendRequestStatusEnum = window.friends.friendRequestStatusEnum;

  // Possible session reset states
  const SessionResetEnum = Object.freeze({
    // No ongoing reset
    none: 0,
    // we initiated the session reset
    initiated: 1,
    // we received the session reset
    request_received: 2,
  });

  const COLORS = [
    'red',
    'deep_orange',
    'brown',
    'pink',
    'purple',
    'indigo',
    'blue',
    'teal',
    'green',
    'light_green',
    'blue_grey',
  ];

  Whisper.Conversation = Backbone.Model.extend({
    storeName: 'conversations',
    defaults() {
      return {
        unreadCount: 0,
        verified: textsecure.storage.protocol.VerifiedStatus.DEFAULT,
        friendRequestStatus: FriendRequestStatusEnum.none,
        unlockTimestamp: null, // Timestamp used for expiring friend requests.
        sessionResetStatus: SessionResetEnum.none,
        swarmNodes: [],
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

      if (this.id === this.ourNumber) {
        this.set({ friendRequestStatus: FriendRequestStatusEnum.friends });
      }

      this.messageSendQueue = new JobQueue();

      this.selectedMessages = new Set();

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

      const ourDevices = await window.libloki.storage.getPairedDevicesFor(
        this.ourNumber
      );
      return ourDevices.includes(this.id);
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
      return BlockedNumberController.isBlocked(this.id);
    },
    block() {
      BlockedNumberController.block(this.id);
      this.trigger('change');
      this.messageCollection.forEach(m => m.trigger('change'));
    },
    unblock() {
      BlockedNumberController.unblock(this.id);
      this.trigger('change');
      this.messageCollection.forEach(m => m.trigger('change'));
    },
    async acceptFriendRequest() {
      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        {
          limit: 1,
          MessageCollection: Whisper.MessageCollection,
          type: 'friend-request',
        }
      );
      const lastMessageModel = messages.at(0);
      if (lastMessageModel) {
        lastMessageModel.acceptFriendRequest();
        await this.markRead();
        window.Whisper.events.trigger(
          'showConversation',
          this.id,
          lastMessageModel.id
        );
      }
    },
    async declineFriendRequest() {
      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        {
          limit: 1,
          MessageCollection: Whisper.MessageCollection,
          type: 'friend-request',
        }
      );

      const lastMessageModel = messages.at(0);
      if (lastMessageModel) {
        lastMessageModel.declineFriendRequest();
      }
    },
    setMessageSelectionBackdrop() {
      const messageSelected = this.selectedMessages.size > 0;

      if (messageSelected) {
        // Hide ellipses icon
        $('.title-wrapper .session-icon.ellipses').css({ opacity: 0 });

        $('.messages li, .messages > div').addClass('shadowed');
        $('.message-selection-overlay').addClass('overlay');
        $('.module-conversation-header').addClass('overlayed');

        let messageId;
        // eslint-disable-next-line no-restricted-syntax
        for (const item of this.selectedMessages) {
          messageId = item.propsForMessage.id;
          $(`#${messageId}`).removeClass('shadowed');
        }
      } else {
        // Hide ellipses icon
        $('.title-wrapper .session-icon.ellipses').css({ opacity: 1 });

        $('.messages li, .messages > div').removeClass('shadowed');
        $('.message-selection-overlay').removeClass('overlay');
        $('.module-conversation-header').removeClass('overlayed');
      }
    },

    addMessageSelection(id) {
      // If the selection is empty, then we chage the mode to
      // multiple selection by making it non-empty
      const modeChanged = this.selectedMessages.size === 0;
      this.selectedMessages.add(id);

      if (modeChanged) {
        this.messageCollection.forEach(m => m.trigger('change'));
      }

      this.trigger('message-selection-changed');
      this.setMessageSelectionBackdrop();
    },

    removeMessageSelection(id) {
      this.selectedMessages.delete(id);
      // If the selection is empty after the deletion then we
      // must have unselected the last one (we assume the id is valid)
      const modeChanged = this.selectedMessages.size === 0;

      if (modeChanged) {
        this.messageCollection.forEach(m => m.trigger('change'));
      }

      this.trigger('message-selection-changed');
      this.setMessageSelectionBackdrop();
    },

    resetMessageSelection() {
      this.selectedMessages.clear();
      this.messageCollection.forEach(m => {
        // on change for ALL messages without real changes is a really costly operation
        // -> cause refresh of the whole conversation view even if not a single message was selected
        if (m.selected) {
          // eslint-disable-next-line no-param-reassign
          m.selected = false;
          m.trigger('change');
        }
      });

      this.trigger('message-selection-changed');
      this.setMessageSelectionBackdrop();
    },

    async bumpTyping() {
      // We don't send typing messages if the setting is disabled or we aren't friends
      const hasFriendDevice = await this.isFriendWithAnyDevice();
      if (!storage.get('typing-indicators-setting') || !hasFriendDevice) {
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
        3 * 1000
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
      const groupNumbers = this.getRecipients();

      const sendOptions = this.getSendOptions();
      sendOptions.messageType = 'typing';
      this.wrapSend(
        textsecure.messaging.sendTypingMessage(
          {
            isTyping,
            recipientId,
            groupId,
            groupNumbers,
          },
          sendOptions
        )
      );
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
    _getMessagesWithTimestamp(pubKey, timestamp) {
      if (this.id !== pubKey) {
        return [];
      }

      // Go through our messages and find the one that we need to update
      return this.messageCollection.models.filter(
        m => m.get('sent_at') === timestamp
      );
    },

    async onCalculatingPoW(pubKey, timestamp) {
      const messages = this._getMessagesWithTimestamp(pubKey, timestamp);
      await Promise.all(messages.map(m => m.setCalculatingPoW()));
    },

    async onPublicMessageSent(pubKey, timestamp, serverId) {
      const messages = this._getMessagesWithTimestamp(pubKey, timestamp);
      await Promise.all(
        messages.map(message => [
          message.setIsPublic(true),
          message.setServerId(serverId),
        ])
      );
    },

    async onNewMessage(message) {
      await this.updateLastMessage();

      // Clear typing indicator for a given contact if we receive a message from them
      const identifier = message.get
        ? `${message.get('source')}.${message.get('sourceDevice')}`
        : `${message.source}.${message.sourceDevice}`;
      this.clearContactTypingTimer(identifier);
    },

    // This goes through all our message history and finds a friend request
    async getFriendRequests(direction = null, status = ['pending']) {
      // Theoretically all our messages could be friend requests,
      // thus we have to unfortunately go through each one :(
      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        {
          type: 'friend-request',
          MessageCollection: Whisper.MessageCollection,
        }
      );
      if (typeof status === 'string') {
        // eslint-disable-next-line no-param-reassign
        status = [status];
      }
      // Get the pending friend requests that match the direction
      // If no direction is supplied then return all pending friend requests
      return messages.models.filter(m => {
        if (!status.includes(m.get('friendStatus'))) {
          return false;
        }
        return direction === null || m.get('direction') === direction;
      });
    },
    async getPendingFriendRequests(direction = null) {
      return this.getFriendRequests(direction, ['pending']);
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
      const color = this.getColor();
      const typingKeys = Object.keys(this.contactTypingTimers || {});

      const result = {
        id: this.id,

        isArchived: this.get('isArchived'),
        activeAt: this.get('active_at'),
        avatarPath: this.getAvatarPath(),
        color,
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
        isPendingFriendRequest: this.isPendingFriendRequest(),
        hasReceivedFriendRequest: this.hasReceivedFriendRequest(),
        hasSentFriendRequest: this.hasSentFriendRequest(),
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
        isFriend: !!this.isFriendWithAnyCache,

        selectedMessages: this.selectedMessages,

        onClick: () => this.trigger('select', this),
        onBlockContact: () => this.block(),
        onUnblockContact: () => this.unblock(),
        onChangeNickname: () => this.changeNickname(),
        onClearNickname: () => this.setNickname(null),
        onCopyPublicKey: () => this.copyPublicKey(),
        onDeleteContact: () => this.deleteContact(),
        onDeleteMessages: () => this.deleteMessages(),
        onCloseOverlay: () => this.resetMessageSelection(),
        acceptFriendRequest: () => this.acceptFriendRequest(),
        declineFriendRequest: () => this.declineFriendRequest(),
      };

      this.updateAsyncPropsCache();

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
        window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });

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
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });

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
    sendVerifySyncMessage(number, state) {
      // Because syncVerification sends a (null) message to the target of the verify and
      //   a sync message to our own devices, we need to send the accessKeys down for both
      //   contacts. So we merge their sendOptions.
      const { sendOptions } = ConversationController.prepareForSend(
        this.ourNumber,
        { syncMessage: true }
      );
      const contactSendOptions = this.getSendOptions();
      const options = Object.assign({}, sendOptions, contactSendOptions);

      const promise = textsecure.storage.protocol.loadIdentityKey(number);
      return promise.then(key =>
        this.wrapSend(
          textsecure.messaging.syncVerification(number, state, key, options)
        )
      );
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
    isFriendRequestStatusNone() {
      return this.get('friendRequestStatus') === FriendRequestStatusEnum.none;
    },
    isFriendRequestStatusNoneOrExpired() {
      const status = this.get('friendRequestStatus');
      return (
        status === FriendRequestStatusEnum.none ||
        status === FriendRequestStatusEnum.requestExpired
      );
    },
    isPendingFriendRequest() {
      const status = this.get('friendRequestStatus');
      return (
        status === FriendRequestStatusEnum.requestSent ||
        status === FriendRequestStatusEnum.requestReceived ||
        status === FriendRequestStatusEnum.pendingSend
      );
    },
    hasSentFriendRequest() {
      const status = this.get('friendRequestStatus');
      return (
        status === FriendRequestStatusEnum.pendingSend ||
        status === FriendRequestStatusEnum.requestSent ||
        status === FriendRequestStatusEnum.requestExpired
      );
    },
    hasReceivedFriendRequest() {
      return (
        this.get('friendRequestStatus') ===
        FriendRequestStatusEnum.requestReceived
      );
    },
    isFriend() {
      return (
        this.get('friendRequestStatus') === FriendRequestStatusEnum.friends
      );
    },
    async getAnyDeviceFriendRequestStatus() {
      const secondaryDevices = await window.libloki.storage.getSecondaryDevicesFor(
        this.id
      );
      const allDeviceStatus = secondaryDevices
        // Get all the secondary device friend status'
        .map(pubKey => {
          const conversation = ConversationController.get(pubKey);
          if (!conversation) {
            return FriendRequestStatusEnum.none;
          }
          return conversation.getFriendRequestStatus();
        })
        // Also include this conversation's friend status
        .concat(this.get('friendRequestStatus'))
        .reduce((acc, cur) => {
          if (
            acc === FriendRequestStatusEnum.friends ||
            cur === FriendRequestStatusEnum.friends
          ) {
            return FriendRequestStatusEnum.friends;
          }
          if (acc !== FriendRequestStatusEnum.none) {
            return acc;
          }
          return cur;
        }, FriendRequestStatusEnum.none);
      return allDeviceStatus;
    },
    async updateAsyncPropsCache() {
      const isFriendWithAnyDevice = await this.isFriendWithAnyDevice();
      if (this.isFriendWithAnyCache !== isFriendWithAnyDevice) {
        this.isFriendWithAnyCache = isFriendWithAnyDevice;
        this.trigger('change');
      }
    },
    async isFriendWithAnyDevice() {
      const allDeviceStatus = await this.getAnyDeviceFriendRequestStatus();
      return allDeviceStatus === FriendRequestStatusEnum.friends;
    },
    getFriendRequestStatus() {
      return this.get('friendRequestStatus');
    },
    async getPrimaryConversation() {
      if (!this.isSecondaryDevice()) {
        // This is already the primary conversation
        return this;
      }
      const authorisation = await window.libloki.storage.getAuthorisationForSecondaryPubKey(
        this.id
      );
      if (authorisation) {
        return ConversationController.getOrCreateAndWait(
          authorisation.primaryDevicePubKey,
          'private'
        );
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
      const allDeviceStatus = await this.getAnyDeviceFriendRequestStatus();

      if (this.get('isKickedFromGroup')) {
        this.trigger('disable:input', true);
        return;
      }
      if (!this.isPrivate() && this.get('left')) {
        this.trigger('disable:input', true);
        this.trigger('change:placeholder', 'left-group');
        return;
      }
      switch (allDeviceStatus) {
        case FriendRequestStatusEnum.none:
        case FriendRequestStatusEnum.requestExpired:
          this.trigger('disable:input', false);
          this.trigger('change:placeholder', 'friend-request');
          return;
        case FriendRequestStatusEnum.pendingSend:
        case FriendRequestStatusEnum.requestReceived:
        case FriendRequestStatusEnum.requestSent:
          this.trigger('disable:input', true);
          this.trigger('change:placeholder', 'disabled');
          return;
        case FriendRequestStatusEnum.friends:
          this.trigger('disable:input', false);
          this.trigger('change:placeholder', 'chat');
          return;
        default:
          throw new Error('Invalid friend request state');
      }
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
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },
    async setFriendRequestStatus(newStatus, options = {}) {
      const { blockSync } = options;
      // Ensure that the new status is a valid FriendStatusEnum value
      if (!(newStatus in Object.values(FriendRequestStatusEnum))) {
        return;
      }
      if (
        this.ourNumber === this.id &&
        newStatus !== FriendRequestStatusEnum.friends
      ) {
        return;
      }
      if (this.get('friendRequestStatus') !== newStatus) {
        this.set({ friendRequestStatus: newStatus });
        if (newStatus === FriendRequestStatusEnum.friends) {
          if (!blockSync) {
            // Sync contact
            this.wrapSend(textsecure.messaging.sendContactSyncMessage([this]));
          }
          // Only enable sending profileKey after becoming friends
          this.set({ profileSharing: true });
        }
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
        await this.updateTextInputState();
      }
    },
    async updateGroupAdmins(groupAdmins) {
      this.set({ groupAdmins });
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
    },
    async respondToAllFriendRequests(options) {
      const { response, status, direction = null } = options;
      // Ignore if no response supplied
      if (!response) {
        return;
      }
      const primaryConversation = ConversationController.get(
        this.getPrimaryDevicePubKey()
      );
      // Should never happen
      if (!primaryConversation) {
        return;
      }
      const pending = await primaryConversation.getFriendRequests(
        direction,
        status
      );
      await Promise.all(
        pending.map(async request => {
          if (request.hasErrors()) {
            return;
          }

          request.set({ friendStatus: response });
          await window.Signal.Data.saveMessage(request.attributes, {
            Message: Whisper.Message,
          });
          primaryConversation.trigger('updateMessage', request);
        })
      );
    },
    async respondToAllPendingFriendRequests(options) {
      return this.respondToAllFriendRequests({
        ...options,
        status: 'pending',
      });
    },
    async resetPendingSend() {
      if (
        this.get('friendRequestStatus') === FriendRequestStatusEnum.pendingSend
      ) {
        await this.setFriendRequestStatus(FriendRequestStatusEnum.none);
      }
    },
    // We have declined an incoming friend request
    async onDeclineFriendRequest() {
      this.setFriendRequestStatus(FriendRequestStatusEnum.none);
      await this.respondToAllPendingFriendRequests({
        response: 'declined',
        direction: 'incoming',
      });
      await window.libloki.storage.removeContactPreKeyBundle(this.id);
      await this.destroyMessages();
      window.pushToast({
        title: i18n('friendRequestDeclined'),
        type: 'success',
        id: 'declineFriendRequest',
      });
    },
    // We have accepted an incoming friend request
    async onAcceptFriendRequest(options = {}) {
      if (this.unlockTimer) {
        clearTimeout(this.unlockTimer);
      }
      if (this.hasReceivedFriendRequest()) {
        this.setFriendRequestStatus(FriendRequestStatusEnum.friends, options);

        await this.respondToAllFriendRequests({
          response: 'accepted',
          direction: 'incoming',
          status: ['pending', 'expired'],
        });
        window.libloki.api.sendBackgroundMessage(
          this.id,
          window.textsecure.OutgoingMessage.DebugMessageType
            .INCOMING_FR_ACCEPTED
        );
      }
    },
    // Our outgoing friend request has been accepted
    async onFriendRequestAccepted() {
      if (this.isFriend()) {
        return false;
      }
      if (this.unlockTimer) {
        clearTimeout(this.unlockTimer);
      }
      if (this.hasSentFriendRequest()) {
        this.setFriendRequestStatus(FriendRequestStatusEnum.friends);
        await this.respondToAllFriendRequests({
          response: 'accepted',
          status: ['pending', 'expired'],
        });
        window.libloki.api.sendBackgroundMessage(
          this.id,
          window.textsecure.OutgoingMessage.DebugMessageType
            .OUTGOING_FR_ACCEPTED
        );
        return true;
      }
      return false;
    },
    async onFriendRequestTimeout() {
      // Unset the timer
      if (this.unlockTimer) {
        clearTimeout(this.unlockTimer);
      }
      this.unlockTimer = null;
      if (this.isFriend()) {
        return;
      }

      // Set the unlock timestamp to null
      if (this.get('unlockTimestamp')) {
        this.set({ unlockTimestamp: null });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }

      // Change any pending outgoing friend requests to expired
      await this.respondToAllPendingFriendRequests({
        response: 'expired',
        direction: 'outgoing',
      });
      await this.setFriendRequestStatus(FriendRequestStatusEnum.requestExpired);
    },
    async onFriendRequestReceived() {
      if (this.isFriendRequestStatusNone()) {
        this.setFriendRequestStatus(FriendRequestStatusEnum.requestReceived);
      } else if (this.hasSentFriendRequest()) {
        await Promise.all([
          this.setFriendRequestStatus(FriendRequestStatusEnum.friends),
          // Accept all outgoing FR
          this.respondToAllPendingFriendRequests({
            direction: 'outgoing',
            response: 'accepted',
          }),
        ]);
      }
      // Delete stale incoming friend requests
      const incoming = await this.getPendingFriendRequests('incoming');
      await Promise.all(
        incoming.map(request => this._removeMessage(request.id))
      );
      this.trigger('change');
    },
    async onFriendRequestSent() {
      // Check if we need to set the friend request expiry
      const unlockTimestamp = this.get('unlockTimestamp');
      if (!this.isFriend() && !unlockTimestamp) {
        // Expire the messages after 72 hours
        const hourLockDuration = 72;
        const ms = 60 * 60 * 1000 * hourLockDuration;

        this.set({ unlockTimestamp: Date.now() + ms });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
        this.setFriendRequestExpiryTimeout();
      }
      await this.setFriendRequestStatus(FriendRequestStatusEnum.requestSent);
    },
    friendRequestTimerIsExpired() {
      const unlockTimestamp = this.get('unlockTimestamp');
      if (unlockTimestamp && unlockTimestamp > Date.now()) {
        return false;
      }
      return true;
    },
    setFriendRequestExpiryTimeout() {
      if (this.isFriend()) {
        return;
      }
      const unlockTimestamp = this.get('unlockTimestamp');
      if (unlockTimestamp && !this.unlockTimer) {
        const delta = Math.max(unlockTimestamp - Date.now(), 0);
        this.unlockTimer = setTimeout(() => {
          this.onFriendRequestTimeout();
        }, delta);
      }
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
        ConversationController.getAllGroupsInvolvingId(this.id).then(groups => {
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

    getUnread() {
      return window.Signal.Data.getUnreadByConversation(this.id, {
        MessageCollection: Whisper.MessageCollection,
      });
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

    queueMessageSend(callback) {
      const taskWithTimeout = textsecure.createTaskWithTimeout(
        callback,
        `conversation ${this.idForLogging()}`
      );

      return this.messageSendQueue.add(taskWithTimeout);
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

      let profileKey;
      if (this.get('profileSharing')) {
        profileKey = storage.get('profileKey');
      }

      this.queueJob(async () => {
        const now = Date.now();

        window.log.info(
          'Sending message to conversation',
          this.idForLogging(),
          'with timestamp',
          now
        );

        const conversationType = this.get('type');

        let messageWithSchema = null;

        // If we are a friend with any of the devices, send the message normally
        const canSendNormalMessage = await this.isFriendWithAnyDevice();
        const isGroup = conversationType === Message.GROUP;
        if (canSendNormalMessage || isGroup) {
          messageWithSchema = await upgradeMessageSchema({
            type: 'outgoing',
            body,
            conversationId: destination,
            quote,
            preview,
            attachments,
            sent_at: now,
            received_at: now,
            expireTimer,
            recipients,
          });
        } else {
          // Check if we have sent a friend request
          const outgoingRequests = await this.getPendingFriendRequests(
            'outgoing'
          );
          if (outgoingRequests.length > 0) {
            // Check if the requests have errored, if so then remove them
            // and send the new request if possible
            let friendRequestSent = false;
            const promises = [];
            outgoingRequests.forEach(outgoing => {
              if (outgoing.hasErrors()) {
                promises.push(this._removeMessage(outgoing.id));
              } else {
                // No errors = we have sent over the friend request
                friendRequestSent = true;
              }
            });
            await Promise.all(promises);

            // If the requests didn't error then don't add a new friend request
            // because one of them was sent successfully
            if (friendRequestSent) {
              return null;
            }
          }
          await this.setFriendRequestStatus(
            FriendRequestStatusEnum.pendingSend
          );

          // Always share our profileKey in the friend request
          // This will get added automatically after the FR
          // is accepted, via the profileSharing flag
          profileKey = storage.get('profileKey');

          // Send the friend request!
          messageWithSchema = await upgradeMessageSchema({
            type: 'friend-request',
            body,
            conversationId: destination,
            sent_at: now,
            received_at: now,
            expireTimer,
            recipients,
            direction: 'outgoing',
            friendStatus: 'pending',
          });
        }

        if (this.isPrivate()) {
          messageWithSchema.destination = destination;
        } else if (this.isPublic()) {
          // Public chats require this data to detect duplicates
          messageWithSchema.source = textsecure.storage.user.getNumber();
          messageWithSchema.sourceDevice = 1;
        }

        const { sessionRestoration = false } = otherOptions;

        const attributes = {
          ...messageWithSchema,
          groupInvitation,
          sessionRestoration,
          id: window.getGuid(),
        };

        const model = this.addSingleMessage(attributes);
        const message = MessageController.register(model.id, model);
        await window.Signal.Data.saveMessage(message.attributes, {
          forceSave: true,
          Message: Whisper.Message,
        });

        if (this.isPrivate()) {
          message.set({ destination });
        }

        const id = await window.Signal.Data.saveMessage(message.attributes, {
          Message: Whisper.Message,
        });
        message.set({ id });

        this.set({
          lastMessage: model.getNotificationText(),
          lastMessageStatus: 'sending',
          active_at: now,
          timestamp: now,
          isArchived: false,
        });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });

        // We're offline!
        if (!textsecure.messaging) {
          const errors = this.contactCollection.map(contact => {
            const error = new Error('Network is not available');
            error.name = 'SendMessageNetworkError';
            error.number = contact.id;
            return error;
          });
          await message.saveErrors(errors);
          return null;
        }

        const attachmentsWithData = await Promise.all(
          messageWithSchema.attachments.map(loadAttachmentData)
        );

        const {
          body: messageBody,
          attachments: finalAttachments,
        } = Whisper.Message.getLongMessageAttachment({
          body,
          attachments: attachmentsWithData,
          now,
        });

        // Special-case the self-send case - we send only a sync message
        if (this.isMe()) {
          const dataMessage = await textsecure.messaging.getMessageProto(
            destination,
            messageBody,
            finalAttachments,
            quote,
            preview,
            now,
            expireTimer,
            profileKey
          );
          return message.sendSyncMessageOnly(dataMessage);
        }

        const options = this.getSendOptions();
        options.messageType = message.get('type');
        options.isPublic = this.isPublic();
        if (options.isPublic) {
          options.publicSendData = await this.getPublicSendData();
        }

        options.groupInvitation = groupInvitation;
        options.sessionRestoration = sessionRestoration;

        const groupNumbers = this.getRecipients();

        const promise = (() => {
          switch (conversationType) {
            case Message.PRIVATE:
              return textsecure.messaging.sendMessageToNumber(
                destination,
                messageBody,
                finalAttachments,
                quote,
                preview,
                now,
                expireTimer,
                profileKey,
                options
              );
            case Message.GROUP: {
              let dest = destination;
              let numbers = groupNumbers;

              if (this.get('is_medium_group')) {
                dest = this.id;
                numbers = [destination];
                options.isMediumGroup = true;
              }

              return textsecure.messaging.sendMessageToGroup(
                dest,
                numbers,
                messageBody,
                finalAttachments,
                quote,
                preview,
                now,
                expireTimer,
                profileKey,
                options
              );
            }
            default:
              throw new TypeError(
                `Invalid conversation type: '${conversationType}'`
              );
          }
        })();

        // Add the message sending on another queue so that our UI doesn't get blocked
        this.queueMessageSend(async () => {
          message.send(this.wrapSend(promise));
        });

        return true;
      });
    },
    wrapSend(promise) {
      return promise.then(
        async result => {
          // success
          if (result) {
            await this.handleMessageSendResult({
              ...result,
              success: true,
            });
          }
          return result;
        },
        async result => {
          // failure
          if (result) {
            await this.handleMessageSendResult({
              ...result,
              success: false,
            });
          }
          throw result;
        }
      );
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

    async handleMessageSendResult({
      failoverNumbers,
      unidentifiedDeliveries,
      messageType,
      success,
    }) {
      if (success && messageType === 'friend-request') {
        await this.onFriendRequestSent();
      }
      await Promise.all(
        (failoverNumbers || []).map(async number => {
          const conversation = ConversationController.get(number);

          if (
            conversation &&
            conversation.get('sealedSender') !== SEALED_SENDER.DISABLED
          ) {
            window.log.info(
              `Setting sealedSender to DISABLED for conversation ${conversation.idForLogging()}`
            );
            conversation.set({
              sealedSender: SEALED_SENDER.DISABLED,
            });
            await window.Signal.Data.updateConversation(
              conversation.id,
              conversation.attributes,
              { Conversation: Whisper.Conversation }
            );
          }
        })
      );

      await Promise.all(
        (unidentifiedDeliveries || []).map(async number => {
          const conversation = ConversationController.get(number);

          if (
            conversation &&
            conversation.get('sealedSender') === SEALED_SENDER.UNKNOWN
          ) {
            if (conversation.get('accessKey')) {
              window.log.info(
                `Setting sealedSender to ENABLED for conversation ${conversation.idForLogging()}`
              );
              conversation.set({
                sealedSender: SEALED_SENDER.ENABLED,
              });
            } else {
              window.log.info(
                `Setting sealedSender to UNRESTRICTED for conversation ${conversation.idForLogging()}`
              );
              conversation.set({
                sealedSender: SEALED_SENDER.UNRESTRICTED,
              });
            }
            await window.Signal.Data.updateConversation(
              conversation.id,
              conversation.attributes,
              { Conversation: Whisper.Conversation }
            );
          }
        })
      );
    },

    getSendOptions(options = {}) {
      const senderCertificate = storage.get('senderCertificate');
      const numberInfo = this.getNumberInfo(options);

      return {
        senderCertificate,
        numberInfo,
      };
    },

    getNumberInfo(options = {}) {
      const { syncMessage, disableMeCheck } = options;

      if (!this.ourNumber) {
        return null;
      }

      // START: this code has an Expiration date of ~2018/11/21
      // We don't want to enable unidentified delivery for send unless it is
      //   also enabled for our own account.
      const me = ConversationController.getOrCreate(this.ourNumber, 'private');
      if (
        !disableMeCheck &&
        me.get('sealedSender') === SEALED_SENDER.DISABLED
      ) {
        return null;
      }
      // END

      if (!this.isPrivate()) {
        const infoArray = this.contactCollection.map(conversation =>
          conversation.getNumberInfo(options)
        );
        return Object.assign({}, ...infoArray);
      }

      const accessKey = this.get('accessKey');
      const sealedSender = this.get('sealedSender');

      // We never send sync messages as sealed sender
      if (syncMessage && this.id === this.ourNumber) {
        return null;
      }

      // If we've never fetched user's profile, we default to what we have
      if (sealedSender === SEALED_SENDER.UNKNOWN) {
        return {
          [this.id]: {
            accessKey:
              accessKey ||
              window.Signal.Crypto.arrayBufferToBase64(
                window.Signal.Crypto.getRandomBytes(16)
              ),
          },
        };
      }

      if (sealedSender === SEALED_SENDER.DISABLED) {
        return null;
      }

      return {
        [this.id]: {
          accessKey:
            accessKey && sealedSender === SEALED_SENDER.ENABLED
              ? accessKey
              : window.Signal.Crypto.arrayBufferToBase64(
                  window.Signal.Crypto.getRandomBytes(16)
                ),
        },
      };
    },
    async updateSwarmNodes(swarmNodes) {
      this.set({ swarmNodes });
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
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
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },

    async setArchived(isArchived) {
      this.set({ isArchived });
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
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
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });

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
      if (this.isPrivate()) {
        message.set({ destination: this.id });
      }
      if (message.isOutgoing()) {
        message.set({ recipients: this.getRecipients() });
      }

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });

      // if change was made remotely, don't send it to the number/group
      if (receivedAt) {
        return message;
      }

      let profileKey;
      if (this.get('profileSharing')) {
        profileKey = storage.get('profileKey');
      }
      const sendOptions = this.getSendOptions();
      let promise;

      if (this.isMe()) {
        const flags =
          textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
        const dataMessage = await textsecure.messaging.getMessageProto(
          this.get('id'),
          null,
          [],
          null,
          [],
          message.get('sent_at'),
          expireTimer,
          profileKey,
          flags
        );
        return message.sendSyncMessageOnly(dataMessage);
      }

      if (this.get('type') === 'private') {
        promise = textsecure.messaging.sendExpirationTimerUpdateToNumber(
          this.get('id'),
          expireTimer,
          message.get('sent_at'),
          profileKey,
          sendOptions
        );
      } else {
        promise = textsecure.messaging.sendExpirationTimerUpdateToGroup(
          this.get('id'),
          this.getRecipients(),
          expireTimer,
          message.get('sent_at'),
          profileKey,
          sendOptions
        );
      }

      await message.send(this.wrapSend(promise));

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
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },
    async onSessionResetInitiated() {
      await this.setSessionResetStatus(SessionResetEnum.initiated);
    },
    async onSessionResetReceived() {
      await this.setSessionResetStatus(SessionResetEnum.request_received);
      // send empty message, this will trigger the new session to propagate
      // to the reset initiator.
      window.libloki.api.sendBackgroundMessage(
        this.id,
        window.textsecure.OutgoingMessage.DebugMessageType.SESSION_RESET_RECV
      );
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

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });
      return message;
    },

    async onNewSessionAdopted() {
      if (this.get('sessionResetStatus') === SessionResetEnum.initiated) {
        // send empty message to confirm that we have adopted the new session
        window.libloki.api.sendBackgroundMessage(
          this.id,
          window.textsecure.OutgoingMessage.DebugMessageType.SESSION_RESET
        );
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
          const message = await this.createAndStoreEndSessionMessage({
            type: 'outgoing',
            endSessionType: 'ongoing',
          });
          const options = this.getSendOptions();
          await message.send(
            this.wrapSend(
              textsecure.messaging.resetSession(
                this.id,
                message.get('sent_at'),
                options
              )
            )
          );
          if (message.hasErrors()) {
            await this.setSessionResetStatus(SessionResetEnum.none);
          }
        }
      }
    },

    async updateGroup(providedGroupUpdate) {
      let groupUpdate = providedGroupUpdate;

      if (this.isPrivate()) {
        throw new Error('Called update group on private conversation');
      }
      if (groupUpdate === undefined) {
        groupUpdate = this.pick(['name', 'avatar', 'members']);
      }
      const now = Date.now();
      const message = this.messageCollection.add({
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: now,
        group_update: groupUpdate,
      });

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });

      const options = this.getSendOptions();
      message.send(
        this.wrapSend(
          textsecure.messaging.updateGroup(
            this.id,
            this.get('name'),
            this.get('avatar'),
            this.get('members'),
            this.get('groupAdmins'),
            groupUpdate.recipients,
            options
          )
        )
      );
    },

    sendGroupInfo(recipients) {
      if (this.isClosedGroup()) {
        const options = this.getSendOptions();
        textsecure.messaging.updateGroup(
          this.id,
          this.get('name'),
          this.get('avatar'),
          this.get('members'),
          this.get('groupAdmins'),
          recipients,
          options
        );
      }
    },

    async leaveGroup() {
      const now = Date.now();
      if (this.get('type') === 'group') {
        const groupNumbers = this.getRecipients();
        this.set({ left: true });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });

        const message = this.messageCollection.add({
          group_update: { left: 'You' },
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
        });

        const id = await window.Signal.Data.saveMessage(message.attributes, {
          Message: Whisper.Message,
        });
        message.set({ id });

        const options = this.getSendOptions();
        message.send(
          this.wrapSend(
            textsecure.messaging.leaveGroup(this.id, groupNumbers, options)
          )
        );

        this.updateTextInputState();
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
          const m = MessageController.register(providedM.id, providedM);

          if (!this.messageCollection.get(m.id)) {
            window.log.warn(
              'Marked a message as read in the database, but ' +
                'it was not in messageCollection.'
            );
          }

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
      unreadMessages = unreadMessages.filter(m => Boolean(m.isIncoming()));

      const unreadCount = unreadMessages.length - read.length;
      this.set({ unreadCount });

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

      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });

      // If a message has errors, we don't want to send anything out about it.
      //   read syncs - let's wait for a client that really understands the message
      //      to mark it read. we'll mark our local error read locally, though.
      //   read receipts - here we can run into infinite loops, where each time the
      //      conversation is viewed, another error message shows up for the contact
      read = read.filter(item => !item.hasErrors);

      // Do not send read receipt if not friends yet
      if (!this.isFriendWithAnyDevice()) {
        return;
      }

      if (this.isPrivate() && read.length && options.sendReadReceipts) {
        window.log.info(`Sending ${read.length} read receipts`);
        // Because syncReadMessages sends to our other devices, and sendReadReceipts goes
        //   to a contact, we need accessKeys for both.
        const { sendOptions } = ConversationController.prepareForSend(
          this.ourNumber,
          { syncMessage: true }
        );
        await this.wrapSend(
          textsecure.messaging.syncReadMessages(read, sendOptions)
        );

        if (storage.get('read-receipt-setting')) {
          const convoSendOptions = this.getSendOptions();

          await Promise.all(
            _.map(_.groupBy(read, 'sender'), async (receipts, sender) => {
              const timestamps = _.map(receipts, 'timestamp');
              await this.wrapSend(
                textsecure.messaging.sendReadReceipts(
                  sender,
                  timestamps,
                  convoSendOptions
                )
              );
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
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });

      await this.updateProfileName();
    },
    async setLokiProfile(newProfile) {
      if (!_.isEqual(this.get('profile'), newProfile)) {
        this.set({ profile: newProfile });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }

      // if set to null, it will show a jazzIcon
      await this.setProfileAvatar({ path: newProfile.avatar });

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
        // mark active so it's not in the friends list but the conversation list
        this.set({
          server: newServer,
          channelId: newChannelId,
          active_at: Date.now(),
        });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
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
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
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
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
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
      const c = await ConversationController.getOrCreateAndWait(id, 'private');

      // We only need to update the profile as they are all stored inside the conversation
      await c.updateProfileName();
    },
    async setProfileName(name) {
      const profileName = this.get('profileName');
      if (profileName !== name) {
        this.set({ profileName: name });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },
    async setGroupName(name) {
      const profileName = this.get('name');
      if (profileName !== name) {
        this.set({ name });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
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
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },
    async setProfileAvatar(avatar) {
      const profileAvatar = this.get('profileAvatar');
      if (profileAvatar !== avatar) {
        this.set({ profileAvatar: avatar });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
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

        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
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
          await window.Signal.Data.saveMessage(upgradedMessage, {
            Message: Whisper.Message,
          });
        }
      }
    },

    async fetchMessages() {
      if (!this.id) {
        throw new Error('This conversation has no id!');
      }
      if (this.inProgressFetch) {
        window.log.warn('Attempting to start a parallel fetchMessages() call');
        return;
      }

      this.inProgressFetch = this.messageCollection.fetchConversation(
        this.id,
        undefined,
        this.get('unreadCount')
      );

      await this.inProgressFetch;

      try {
        // We are now doing the work to upgrade messages before considering the load from
        //   the database complete. Note that we do save messages back, so it is a
        //   one-time hit. We do this so we have guarantees about message structure.
        await this.upgradeMessages(this.messageCollection);
      } catch (error) {
        window.log.error(
          'fetchMessages: failed to upgrade messages',
          Errors.toLogFormat(error)
        );
      }

      this.inProgressFetch = null;
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
        ConversationController.getOrCreateAndWait(number, 'private')
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

    copyPublicKey() {
      clipboard.writeText(this.id);

      const isGroup = this.getProps().type === 'group';
      const copiedMessage = isGroup
        ? i18n('copiedChatId')
        : i18n('copiedPublicKey');

      window.pushToast({
        title: copiedMessage,
        type: 'success',
        id: 'copiedPublicKey',
      });
    },

    changeNickname() {
      window.Whisper.events.trigger('showNicknameDialog', {
        pubKey: this.id,
        nickname: this.getNickname(),
        onOk: newName => this.setNickname(newName),
      });
    },

    deleteContact() {
      let title = i18n('deleteContact');
      let message = i18n('deleteContactConfirmation');

      if (this.isPublic()) {
        title = i18n('deletePublicChannel');
        message = i18n('deletePublicChannelConfirmation');
      } else if (this.isClosedGroup()) {
        title = i18n('leaveClosedGroup');
        message = i18n('leaveClosedGroupConfirmation');
      }

      window.confirmationDialog({
        title,
        message,
        resolve: () => {
          ConversationController.deleteContact(this.id);
        },
      });
    },

    async deletePublicMessages(messages) {
      const channelAPI = await this.getPublicSendData();
      if (!channelAPI) {
        return false;
      }

      const invalidMessages = messages.filter(m => !m.getServerId());
      const pendingMessages = messages.filter(m => m.getServerId());

      let deletedServerIds = [];
      let ignoredServerIds = [];

      if (pendingMessages.length > 0) {
        const result = await channelAPI.deleteMessages(
          pendingMessages.map(m => m.getServerId())
        );
        deletedServerIds = result.deletedIds;
        ignoredServerIds = result.ignoredIds;
      }

      const toDeleteLocallyServerIds = _.union(
        deletedServerIds,
        ignoredServerIds
      );
      let toDeleteLocally = messages.filter(m =>
        toDeleteLocallyServerIds.includes(m.getServerId())
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
    },

    deleteMessages() {
      this.resetMessageSelection();

      let params;
      if (this.isPublic()) {
        params = {
          title: i18n('deleteMessages'),
          message: i18n('deletePublicConversationConfirmation'),
          resolve: () => ConversationController.deleteContact(this.id),
        };
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

      // let's try to keep the RSS conversation open just empty...
      if (this.isRss()) {
        this.set({
          lastMessage: null,
        });
      } else {
        // this will remove the conversation from conversation lists...
        this.set({
          lastMessage: null,
          timestamp: null,
          active_at: null,
        });
      }

      // Reset our friend status if we're not friends
      if (!this.isFriend()) {
        this.set({ friendRequestStatus: FriendRequestStatusEnum.none });
      }

      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
    },

    getName() {
      if (this.isPrivate()) {
        return this.get('name');
      }
      return this.get('name') || i18n('unknownGroup');
    },

    getTitle() {
      if (this.isPrivate()) {
        const profileName = this.getProfileName();
        const number = this.getNumber();
        const name = profileName ? `${profileName} (${number})` : number;
        return this.get('name') || name;
      }
      return this.get('name') || 'Unknown group';
    },

    getProfileName() {
      if (this.isPrivate() && !this.get('name')) {
        return this.get('profileName');
      }
      return null;
    },

    getDisplayName() {
      if (!this.isPrivate()) {
        return this.getTitle();
      }

      const name = this.get('name');
      if (name) {
        return name;
      }

      const profileName = this.get('profileName');
      if (profileName) {
        return `${this.getNumber()} ~${profileName}`;
      }

      return this.getNumber();
    },

    getNumber() {
      if (!this.isPrivate()) {
        return '';
      }
      return this.id;
    },

    getInitials(name) {
      if (!name) {
        return null;
      }

      const cleaned = name.replace(/[^A-Za-z\s]+/g, '').replace(/\s+/g, ' ');
      const parts = cleaned.split(' ');
      const initials = parts.map(part => part.trim()[0]);
      if (!initials.length) {
        return null;
      }

      return initials.slice(0, 2).join('');
    },

    isPrivate() {
      return this.get('type') === 'private';
    },

    getColor() {
      if (!this.isPrivate()) {
        return 'signal-blue';
      }

      const { migrateColor } = Util;
      return migrateColor(this.get('color'));
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
      const title = this.get('name');
      const color = this.getColor();
      const url = this.getAvatarPath();

      if (url) {
        return { url, color };
      } else if (this.isPrivate()) {
        const symbol = this.isValid() ? '#' : '!';
        return {
          color,
          content: this.getInitials(title) || symbol,
        };
      }
      return { url: 'images/group_default.png', color };
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
      if (message.isFriendRequest()) {
        if (this.hasSentFriendRequest()) {
          return this.notifyFriendRequest(message.get('source'), 'accepted');
        }
        return this.notifyFriendRequest(message.get('source'), 'requested');
      }
      if (!message.isIncoming()) {
        return Promise.resolve();
      }
      const conversationId = this.id;

      return ConversationController.getOrCreateAndWait(
        message.get('source'),
        'private'
      ).then(sender =>
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
    // Notification for friend request received
    async notifyFriendRequest(source, type) {
      // Data validation
      if (!source) {
        throw new Error('Invalid source');
      }
      if (!['accepted', 'requested'].includes(type)) {
        throw new Error('Type must be accepted or requested.');
      }

      // Call the notification on the right conversation
      let conversation = this;
      if (conversation.id !== source) {
        try {
          conversation = await ConversationController.getOrCreateAndWait(
            source,
            'private'
          );
          window.log.info(`Notify called on a different conversation.
                           Expected: ${this.id}. Actual: ${conversation.id}`);
        } catch (e) {
          throw new Error('Failed to fetch conversation.');
        }
      }

      const isTypeAccepted = type === 'accepted';
      const title = isTypeAccepted
        ? 'friendRequestAcceptedNotificationTitle'
        : 'friendRequestNotificationTitle';
      const message = isTypeAccepted
        ? 'friendRequestAcceptedNotificationMessage'
        : 'friendRequestNotificationMessage';

      const iconUrl = await conversation.getNotificationIcon();
      // window.log.info('Add notification for friend request updated', {
      //   conversationId: conversation.idForLogging(),
      // });
      Whisper.Notifications.add({
        conversationId: conversation.id,
        iconUrl,
        isExpiringMessage: false,
        message: i18n(message, conversation.getTitle()),
        messageSentAt: Date.now(),
        title: i18n(title),
        isFriendRequest: true,
        friendRequestType: type,
      });
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

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');
})();
