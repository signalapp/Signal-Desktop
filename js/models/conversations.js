/* global _: false */
/* global Backbone: false */
/* global ConversationController: false */
/* global i18n: false */
/* global libsignal: false */
/* global storage: false */
/* global textsecure: false */
/* global Whisper: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
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
    writeNewAttachmentData,
    deleteAttachmentData,
  } = window.Signal.Migrations;

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

  /**
   * A few key things that need to be known in this is the difference
   *  between isFriend() and isKeyExhangeCompleted().
   *
   * `isFriend` returns whether we have accepted the other user as a friend.
   *    - This is implicitly checked by whether we have a session
   *       or we have the preKeyBundle of the user.
   *
   * `isKeyExchangeCompleted` return whether we know for certain
   *   that both of our preKeyBundles have been exhanged.
   *    - This will be set when we receive a valid CIPHER message from the other user.
   *        * Valid meaning we can decypher the message using the preKeys provided
   *           or the keys we have stored.
   *
   * `isFriend` will determine whether we should send a FRIEND_REQUEST message.
   *
   * `isKeyExhangeCompleted` will determine whether we keep
   *   sending preKeyBundle to the other user.
   */

  Whisper.Conversation = Backbone.Model.extend({
    storeName: 'conversations',
    defaults() {
      return {
        unreadCount: 0,
        verified: textsecure.storage.protocol.VerifiedStatus.DEFAULT,
        keyExchangeCompleted: false,
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

    initialize() {
      this.ourNumber = textsecure.storage.user.getNumber();
      this.verifiedEnum = textsecure.storage.protocol.VerifiedStatus;

      // This may be overridden by ConversationController.getOrCreate, and signify
      //   our first save to the database. Or first fetch from the database.
      this.initialPromise = Promise.resolve();

      this.contactCollection = new Backbone.Collection();
      const collator = new Intl.Collator();
      this.contactCollection.comparator = (left, right) => {
        const leftLower = left.getTitle().toLowerCase();
        const rightLower = right.getTitle().toLowerCase();
        return collator.compare(leftLower, rightLower);
      };
      this.messageCollection = new Whisper.MessageCollection([], {
        conversation: this,
      });

      this.pendingFriendRequest = false;

      this.messageCollection.on('change:errors', this.handleMessageError, this);
      this.messageCollection.on('send-error', this.onMessageError, this);

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

      this.on('newmessage', this.updateLastMessage);
      this.on('change:profileKey', this.onChangeProfileKey);

      // Listening for out-of-band data updates
      this.on('updateMessage', this.updateAndMerge);
      this.on('delivered', this.updateAndMerge);
      this.on('read', this.updateAndMerge);
      this.on('expiration-change', this.updateAndMerge);
      this.on('expired', this.onExpired);

      setTimeout(() => {
        this.setFriendRequestTimer();
      }, 0);

      const sealedSender = this.get('sealedSender');
      if (sealedSender === undefined) {
        this.set({ sealedSender: SEALED_SENDER.UNKNOWN });
      }
      this.unset('unidentifiedDelivery');
      this.unset('unidentifiedDeliveryUnrestricted');
      this.unset('hasFetchedProfile');
      this.unset('tokens');
      this.unset('lastMessage');
      this.unset('lastMessageStatus');

      this.updateTextInputState();
    },

    isMe() {
      return this.id === this.ourNumber;
    },

    async cleanup() {
      await window.Signal.Types.Conversation.deleteExternalFiles(
        this.attributes,
        {
          deleteAttachmentData,
        }
      );
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
    async onCalculatingPoW(pubKey, timestamp) {
      if (this.id !== pubKey) return;

      // Go through our messages and find the one that we need to update
      const messages = this.messageCollection.models.filter(m => m.get('sent_at') === timestamp);
      await Promise.all(messages.map(m => m.setCalculatingPoW()));
    },

    addSingleMessage(message, setToExpire = true) {
      const model = this.messageCollection.add(message, { merge: true });
      if (setToExpire) model.setToExpire();
      return model;
    },

    format() {
      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');
      const color = this.getColor();

      return {
        phoneNumber: format(this.id, {
          ourRegionCode: regionCode,
        }),
        color,
        avatarPath: this.getAvatarPath(),
        name: this.getName(),
        profileName: this.getProfileName(),
        title: this.getTitle(),
      };
    },
    // This function sets `pendingFriendRequest` variable in memory
    async updatePendingFriendRequests() {
      const pendingFriendRequest = await this.hasPendingFriendRequests();
      // Only update if we have different values
      if (this.pendingFriendRequest !== pendingFriendRequest) {
        this.pendingFriendRequest = pendingFriendRequest;
        // trigger an update
        this.trigger('change');
      }
    },
    // This goes through all our message history and finds a friend request
    // But this is not a concurrent operation and thus updatePendingFriendRequests is used
    async hasPendingFriendRequests() {
      // Go through the messages and check for any pending friend requests
      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        {
          type: 'friend-request',
          MessageCollection: Whisper.MessageCollection,
        }
      );
      const pendingFriendRequest =
        messages.models.find(message =>
          message.isFriendRequest() &&
          message.attributes.friendStatus === 'pending'
        );
      return pendingFriendRequest !== undefined;
    },
    async getPendingFriendRequests(direction) {
      // Theoretically all our messages could be friend requests,
      // thus we have to unfortunately go through each one :(
      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        {
          type: 'friend-request',
          MessageCollection: Whisper.MessageCollection,
        }
      );

      // Get the messages that are matching the direction and the friendStatus
      return messages.models.filter(m =>
        m.attributes.direction === direction &&
        m.attributes.friendStatus === 'pending'
      );
    },
    getPropsForListItem() {
      const result = {
        ...this.format(),
        conversationType: this.isPrivate() ? 'direct' : 'group',

        lastUpdated: this.get('timestamp'),
        unreadCount: this.get('unreadCount') || 0,
        isSelected: this.isSelected,
        showFriendRequestIndicator: this.pendingFriendRequest,
        lastMessage: {
          status: this.lastMessageStatus,
          text: this.lastMessage,
        },

        onClick: () => this.trigger('select', this),
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

        // we don't await here because we don't need to wait for this to finish
        window.Signal.Data.updateConversation(
          this.id,
          { verified },
          { Conversation: Whisper.Conversation }
        );

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
    isKeyExchangeCompleted() {
      if (!this.isPrivate()) {
        return false;
        // throw new Error('isKeyExchangeCompleted not implemented for groups');
      }

      if (this.isMe()) {
        return true;
      }

      return this.get('keyExchangeCompleted') || false;
    },
    async setKeyExchangeCompleted(value) {
      this.set({ keyExchangeCompleted: value });
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
    },
    async isFriend() {
      // We are a friend IF:
      // - We have the preKey bundle of the user OR
      // - We have a session with the user
      const preKeys = await window.Signal.Data.getContactPreKeyByIdentityKey(this.id);
      const session = await window.Signal.Data.getSessionsByNumber(this.id);

      return !!(preKeys || session);
    },
    // Update any pending friend requests for the current user
    async updateFriendRequestUI() {
      // Enable the text inputs early
      this.updateTextInputState();

      // We only update our friend requests if we have the user as a friend
      const isFriend = await this.isFriend();
      if (!isFriend) return;

      // Update any pending outgoing messages
      const pending = await this.getPendingFriendRequests('outgoing');
      await Promise.all(
        pending.map(async request => {
          if (request.hasErrors()) return;

          request.set({ friendStatus: 'accepted' });
          await window.Signal.Data.saveMessage(request.attributes, {
            Message: Whisper.Message,
          });
          this.trigger('updateMessage', request);
        })
      );

      // Update our local state
      await this.updatePendingFriendRequests();

      // Send the notification
      this.notifyFriendRequest(this.id, 'accepted')
    },
    async onFriendRequestSent() {
      return this.updateFriendRequestUI();
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
      this.trigger('change:verified');
      this.trigger('change');
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
    // This will add a message which will allow the user to reply to a friend request
    async addFriendRequest(body, options = {}) {
      const _options = {
        friendStatus: 'pending',
        direction: 'incoming',
        preKeyBundle: null,
        timestamp: null,
        source: null,
        sourceDevice: null,
        received_at: null,
        ...options,
      };

      if (this.isMe()) {
        window.log.info(
          'refusing to send friend request to ourselves'
        );
        return;
      }

      const timestamp = _options.timestamp || this.get('timestamp') || Date.now();

      window.log.info(
        'adding friend request for',
        this.ourNumber,
        this.idForLogging(),
        timestamp
      );

      this.lastMessageStatus = 'sending';

      this.set({
        active_at: Date.now(),
        timestamp: Date.now(),
        unreadCount: this.get('unreadCount') + 1,
      });

      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });

      // If we need to add new incoming friend requests
      // Then we need to make sure we remove any pending requests that we may have
      // This is to ensure that one user cannot spam us with multiple friend requests
      if (_options.direction === 'incoming') {
        const requests = await this.getPendingFriendRequests('incoming');

        // Delete the old message if it's pending
        await Promise.all(requests.map(request => this._removeMessage(request.id)));
        // Trigger an update if we removed messages
        if (requests.length > 0)
          this.trigger('change');
      }

      // Add the new message
      // eslint-disable-next-line camelcase
      const received_at = _options.received_at || Date.now();
      const message = {
        conversationId: this.id,
        type: 'friend-request',
        sent_at: timestamp,
        received_at,
        unread: 1,
        from: this.id,
        to: this.ourNumber,
        friendStatus: _options.friendStatus,
        direction: _options.direction,
        body,
        preKeyBundle: _options.preKeyBundle,
        source: _options.source,
        sourceDevice: _options.sourceDevice,
      };

      const id = await window.Signal.Data.saveMessage(message, {
        Message: Whisper.Message,
      });

      const whisperMessage = new Whisper.Message({
        ...message,
        id,
      });

      this.trigger('newmessage', whisperMessage);
      this.notify(whisperMessage);
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
      const existing = this.messageCollection.get(message.id);
      if (existing) {
        const fetched = await window.Signal.Data.getMessageById(existing.id, {
          Message: Whisper.Message,
        });
        existing.merge(fetched);
      }

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
      if (!this.id) return 'Invalid ID';

      if (this.isPrivate()) {
        // Check if it's hex
        const isHex = this.id.replace(/[\s]*/g, '').match(/^[0-9a-fA-F]+$/);
        if (!isHex) return 'Invalid Hex ID';

        // Check if it has a valid length
        if (this.id.length !== 33 * 2) {
          // 33 bytes in hex
          this.set({ id: this.id });
          return 'Invalid ID Length';
        }
      }

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
      const previous = this.pendingSend || Promise.resolve();

      const taskWithTimeout = textsecure.createTaskWithTimeout(
        callback,
        `conversation ${this.idForLogging()}`
      );

      this.pendingSend = previous.then(taskWithTimeout, taskWithTimeout);
      const current = this.pendingSend;

      current.then(() => {
        if (this.pendingSend === current) {
          delete this.pendingSend;
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

    async makeQuote(quotedMessage) {
      const { getName } = Contact;
      const contact = quotedMessage.getContact();
      const attachments = quotedMessage.get('attachments');

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
        attachments: await Promise.all(
          (attachments || []).map(async attachment => {
            const { contentType, fileName, thumbnail } = attachment;

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
        ),
      };
    },

    async sendMessage(body, attachments, quote) {
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

        let messageWithSchema = null;

        // If we are a friend then let the user send the message normally
        const isFriend = await this.isFriend();
        if (isFriend) {
          messageWithSchema = await upgradeMessageSchema({
            type: 'outgoing',
            body,
            conversationId: destination,
            quote,
            attachments,
            sent_at: now,
            received_at: now,
            expireTimer,
            recipients,
          });
        } else {
          // We also need to make sure we don't send a new friend request
          // if we already have an existing one
          const incomingRequests = await this.getPendingFriendRequests('incoming');
          if (incomingRequests.length > 0) return null;

          // Otherwise check if we have sent a friend request
          const outgoingRequests = await this.getPendingFriendRequests('outgoing');
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
            if (friendRequestSent) return null;
          }

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

        const message = this.addSingleMessage(messageWithSchema);
        this.lastMessage = message.getNotificationText();
        this.lastMessageStatus = 'sending';

        this.set({
          active_at: now,
          timestamp: now,
        });
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });

        if (this.isPrivate()) {
          message.set({ destination });
        }

        const id = await window.Signal.Data.saveMessage(message.attributes, {
          Message: Whisper.Message,
        });
        message.set({ id });

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

        const conversationType = this.get('type');
        const sendFunction = (() => {
          switch (conversationType) {
            case Message.PRIVATE:
              return textsecure.messaging.sendMessageToNumber;
            case Message.GROUP:
              return textsecure.messaging.sendMessageToGroup;
            default:
              throw new TypeError(
                `Invalid conversation type: '${conversationType}'`
              );
          }
        })();

        const attachmentsWithData = await Promise.all(
          messageWithSchema.attachments.map(loadAttachmentData)
        );

        const options = this.getSendOptions();

        // Add the message sending on another queue so that our UI doesn't get blocked
        this.queueMessageSend(async () =>
          message.send(
            this.wrapSend(
              sendFunction(
                destination,
                body,
                attachmentsWithData,
                quote,
                now,
                expireTimer,
                profileKey,
                options
              )
            )
          )
        );

        return true;
      });
    },
    async updateTextInputState() {
      // Check if we need to disable the text field
      const isFriend = await this.isFriend();
      if (isFriend) {
        // Check if we have an incoming friend request
        // Or any successful outgoing ones
        const incoming = await this.getPendingFriendRequests('incoming');
        const outgoing = await this.getPendingFriendRequests('outgoing');
        const successfulOutgoing = outgoing.filter(o => !o.hasErrors());

        // Disable the input
        if (incoming.length > 0 || successfulOutgoing.length > 0) {
          this.trigger('disable:input', true);
          this.trigger('change:placeholder', 'disabled');
          return;
        }
        // Tell the user to introduce themselves
        this.trigger('disable:input', false);
        this.trigger('change:placeholder', 'friend-request');
        return;
      }
      this.trigger('disable:input', false);
      this.trigger('change:placeholder', 'chat');
    },
    wrapSend(promise) {
      return promise.then(
        async result => {
          // success
          if (result) {
            await this.handleMessageSendResult(
              result.failoverNumbers,
              result.unidentifiedDeliveries
            );
          }
          return result;
        },
        async result => {
          // failure
          if (result) {
            await this.handleMessageSendResult(
              result.failoverNumbers,
              result.unidentifiedDeliveries
            );
          }
          throw result;
        }
      );
    },

    async handleMessageSendResult(failoverNumbers, unidentifiedDeliveries) {
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
    async updateLastMessage() {
      if (!this.id) {
        return;
      }

      // Update our friend indicator
      this.updatePendingFriendRequests();

      // Update our text input state
      await this.updateTextInputState();

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
        currentLastMessageText: this.get('lastMessage') || null,
        currentTimestamp: this.get('timestamp') || null,
        lastMessage: lastMessageJSON,
        lastMessageStatus: lastMessageStatusModel,
        lastMessageNotificationText: lastMessageModel
          ? lastMessageModel.getNotificationText()
          : null,
      });

      let hasChanged = false;
      const { lastMessage, lastMessageStatus } = lastMessageUpdate;
      delete lastMessageUpdate.lastMessage;
      delete lastMessageUpdate.lastMessageStatus;

      hasChanged = hasChanged || lastMessage !== this.lastMessage;
      this.lastMessage = lastMessage;

      hasChanged = hasChanged || lastMessageStatus !== this.lastMessageStatus;
      this.lastMessageStatus = lastMessageStatus;

      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so our hasChanged() check below is useful.
      this.changed = {};
      this.set(lastMessageUpdate);

      if (this.hasChanged()) {
        await window.Signal.Data.updateConversation(this.id, this.attributes, {
          Conversation: Whisper.Conversation,
        });
      } else if (hasChanged) {
        this.trigger('change');
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

      let sendFunc;
      if (this.get('type') === 'private') {
        sendFunc = textsecure.messaging.sendExpirationTimerUpdateToNumber;
      } else {
        sendFunc = textsecure.messaging.sendExpirationTimerUpdateToGroup;
      }
      let profileKey;
      if (this.get('profileSharing')) {
        profileKey = storage.get('profileKey');
      }

      const sendOptions = this.getSendOptions();
      const promise = sendFunc(
        this.get('id'),
        this.get('expireTimer'),
        message.get('sent_at'),
        profileKey,
        sendOptions
      );

      await message.send(this.wrapSend(promise));

      return message;
    },

    isSearchable() {
      return !this.get('left');
    },

    async endSession() {
      if (this.isPrivate()) {
        const now = Date.now();
        const message = this.messageCollection.add({
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
          destination: this.id,
          recipients: this.getRecipients(),
          flags: textsecure.protobuf.DataMessage.Flags.END_SESSION,
        });

        const id = await window.Signal.Data.saveMessage(message.attributes, {
          Message: Whisper.Message,
        });
        message.set({ id });

        const options = this.getSendOptions();
        message.send(
          this.wrapSend(
            textsecure.messaging.resetSession(this.id, now, options)
          )
        );
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
            options
          )
        )
      );
    },

    async leaveGroup() {
      const now = Date.now();
      if (this.get('type') === 'group') {
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
          this.wrapSend(textsecure.messaging.leaveGroup(this.id, options))
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
          let m = providedM;

          if (this.messageCollection.get(m.id)) {
            m = this.messageCollection.get(m.id);
          } else {
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
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });

      // If a message has errors, we don't want to send anything out about it.
      //   read syncs - let's wait for a client that really understands the message
      //      to mark it read. we'll mark our local error read locally, though.
      //   read receipts - here we can run into infinite loops, where each time the
      //      conversation is viewed, another error message shows up for the contact
      read = read.filter(item => !item.hasErrors);

      if (read.length && options.sendReadReceipts) {
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

    async getProfile(id) {
      if (!textsecure.messaging) {
        throw new Error(
          'Conversation.getProfile: textsecure.messaging not available'
        );
      }

      const c = await ConversationController.getOrCreateAndWait(id, 'private');

      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so our hasChanged() check is useful.
      c.changed = {};

      try {
        await c.deriveAccessKeyIfNeeded();
        const numberInfo = c.getNumberInfo({ disableMeCheck: true }) || {};
        const getInfo = numberInfo[c.id] || {};

        let profile;
        if (getInfo.accessKey) {
          try {
            profile = await textsecure.messaging.getProfile(id, {
              accessKey: getInfo.accessKey,
            });
          } catch (error) {
            if (error.code === 401 || error.code === 403) {
              window.log.info(
                `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
              );
              c.set({ sealedSender: SEALED_SENDER.DISABLED });
              profile = await textsecure.messaging.getProfile(id);
            } else {
              throw error;
            }
          }
        } else {
          profile = await textsecure.messaging.getProfile(id);
        }

        const identityKey = window.Signal.Crypto.base64ToArrayBuffer(
          profile.identityKey
        );
        const changed = await textsecure.storage.protocol.saveIdentity(
          `${id}.1`,
          identityKey,
          false
        );
        if (changed) {
          // save identity will close all sessions except for .1, so we
          // must close that one manually.
          const address = new libsignal.SignalProtocolAddress(id, 1);
          window.log.info('closing session for', address.toString());
          const sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            address
          );
          await sessionCipher.closeOpenSessionForDevice();
        }

        const accessKey = c.get('accessKey');
        if (
          profile.unrestrictedUnidentifiedAccess &&
          profile.unidentifiedAccess
        ) {
          window.log.info(
            `Setting sealedSender to UNRESTRICTED for conversation ${c.idForLogging()}`
          );
          c.set({
            sealedSender: SEALED_SENDER.UNRESTRICTED,
          });
        } else if (accessKey && profile.unidentifiedAccess) {
          const haveCorrectKey = await window.Signal.Crypto.verifyAccessKey(
            window.Signal.Crypto.base64ToArrayBuffer(accessKey),
            window.Signal.Crypto.base64ToArrayBuffer(profile.unidentifiedAccess)
          );

          if (haveCorrectKey) {
            window.log.info(
              `Setting sealedSender to ENABLED for conversation ${c.idForLogging()}`
            );
            c.set({
              sealedSender: SEALED_SENDER.ENABLED,
            });
          } else {
            window.log.info(
              `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
            );
            c.set({
              sealedSender: SEALED_SENDER.DISABLED,
            });
          }
        } else {
          window.log.info(
            `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
          );
          c.set({
            sealedSender: SEALED_SENDER.DISABLED,
          });
        }

        await c.setProfileName(profile.name);

        // This might throw if we can't pull the avatar down, so we do it last
        await c.setProfileAvatar(profile.avatar);
      } catch (error) {
        window.log.error(
          'getProfile error:',
          id,
          error && error.stack ? error.stack : error
        );
      } finally {
        if (c.hasChanged()) {
          await window.Signal.Data.updateConversation(id, c.attributes, {
            Conversation: Whisper.Conversation,
          });
        }
      }
    },
    async setProfileName(encryptedName) {
      if (!encryptedName) {
        return;
      }
      const key = this.get('profileKey');
      if (!key) {
        return;
      }

      // decode
      const keyBuffer = window.Signal.Crypto.base64ToArrayBuffer(key);
      const data = window.Signal.Crypto.base64ToArrayBuffer(encryptedName);

      // decrypt
      const decrypted = await textsecure.crypto.decryptProfileName(
        data,
        keyBuffer
      );

      // encode
      const profileName = window.Signal.Crypto.stringFromBytes(decrypted);

      // set
      this.set({ profileName });
    },
    async setProfileAvatar(avatarPath) {
      if (!avatarPath) {
        return;
      }

      const avatar = await textsecure.messaging.getAvatar(avatarPath);
      const key = this.get('profileKey');
      if (!key) {
        return;
      }
      const keyBuffer = window.Signal.Crypto.base64ToArrayBuffer(key);

      // decrypt
      const decrypted = await textsecure.crypto.decryptProfile(
        avatar,
        keyBuffer
      );

      // update the conversation avatar only if hash differs
      if (decrypted) {
        const newAttributes = await window.Signal.Types.Conversation.maybeUpdateProfileAvatar(
          this.attributes,
          decrypted,
          {
            writeNewAttachmentData,
            deleteAttachmentData,
          }
        );
        this.set(newAttributes);
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

        if (schemaVersion < Message.CURRENT_SCHEMA_VERSION) {
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

    async destroyMessages() {
      await window.Signal.Data.removeAllMessagesInConversation(this.id, {
        MessageCollection: Whisper.MessageCollection,
      });

      this.messageCollection.reset([]);

      this.set({
        lastMessage: null,
        timestamp: null,
        active_at: null,
      });
      await window.Signal.Data.updateConversation(this.id, this.attributes, {
        Conversation: Whisper.Conversation,
      });
    },

    getName() {
      if (this.isPrivate()) {
        return this.get('name');
      }
      return this.get('name') || 'Unknown group';
    },

    getTitle() {
      if (this.isPrivate()) {
        return this.get('name') || this.getNumber();
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

      if (avatar && avatar.path) {
        return getAbsoluteAttachmentPath(avatar.path);
      }

      return null;
    },
    getAvatar() {
      const title = this.get('name');
      const color = this.getColor();
      const avatar = this.get('avatar') || this.get('profileAvatar');

      if (avatar && avatar.path) {
        return { url: getAbsoluteAttachmentPath(avatar.path), color };
      } else if (this.isPrivate()) {
        const symbol = this.isValid() ? '#' : '!';
        return {
          color,
          content: title ? title.trim()[0] : symbol,
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
      if (!message.isIncoming()) {
        if (message.isFriendRequest())
          return this.notifyFriendRequest(message.get('source'), 'requested');
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

          window.log.info('Add notification', {
            conversationId: this.idForLogging(),
            isExpiringMessage,
            messageSentAt,
          });
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
      if (!source)
        throw new Error('Invalid source');
      if (!['accepted', 'requested'].includes(type))
        throw new Error('Type must be accepted or requested.');

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
      window.log.info('Add notification for friend request updated', {
        conversationId: conversation.idForLogging(),
      });
      Whisper.Notifications.add({
        conversationId: conversation.id,
        iconUrl,
        isExpiringMessage: false,
        message: i18n(message, conversation.getTitle()),
        messageSentAt: Date.now(),
        title: i18n(title),
      });
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

    async search(providedQuery) {
      let query = providedQuery.trim().toLowerCase();
      query = query.replace(/[+-.()]*/g, '');

      if (query.length === 0) {
        return;
      }

      const collection = await window.Signal.Data.searchConversations(query, {
        ConversationCollection: Whisper.ConversationCollection,
      });

      this.reset(collection.models);
    },
  });

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');
})();
