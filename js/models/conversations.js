/* global _: false */
/* global Backbone: false */
/* global dcodeIO: false */
/* global libphonenumber: false */

/* global ConversationController: false */
/* global libsignal: false */
/* global storage: false */
/* global textsecure: false */
/* global Whisper: false */
/* global wrapDeferred: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

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
  } = window.Signal.Migrations;

  // TODO: Factor out private and group subclasses of Conversation

  const COLORS = [
    'red',
    'pink',
    'purple',
    'deep_purple',
    'indigo',
    'blue',
    'light_blue',
    'cyan',
    'teal',
    'green',
    'light_green',
    'orange',
    'deep_orange',
    'amber',
    'blue_grey',
  ];

  function constantTimeEqualArrayBuffers(ab1, ab2) {
    if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
      return false;
    }
    if (ab1.byteLength !== ab2.byteLength) {
      return false;
    }
    let result = 0;
    const ta1 = new Uint8Array(ab1);
    const ta2 = new Uint8Array(ab2);
    for (let i = 0; i < ab1.byteLength; i += 1) {
      // eslint-disable-next-line no-bitwise
      result |= ta1[i] ^ ta2[i];
    }
    return result === 0;
  }

  Whisper.Conversation = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    defaults() {
      return {
        unreadCount: 0,
        verified: textsecure.storage.protocol.VerifiedStatus.DEFAULT,
        keyExchangeStatus: 'none'
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
      this.on('change:avatar', this.updateAvatarUrl);
      this.on('change:profileAvatar', this.updateAvatarUrl);
      this.on('change:profileKey', this.onChangeProfileKey);
      this.on('destroy', this.revokeAvatarUrl);

      // Listening for out-of-band data updates
      this.on('delivered', this.updateAndMerge);
      this.on('read', this.updateAndMerge);
      this.on('expiration-change', this.updateAndMerge);
      this.on('expired', this.onExpired);
    },

    isMe() {
      return this.id === this.ourNumber;
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

    addSingleMessage(message) {
      const model = this.messageCollection.add(message, { merge: true });
      model.setToExpire();
      return model;
    },

    format() {
      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');

      const avatar = this.getAvatar();
      const color = this.getColor();

      return {
        phoneNumber: format(this.id, {
          ourRegionCode: regionCode,
        }),
        color,
        avatarPath: avatar ? avatar.url : null,
        name: this.getName(),
        profileName: this.getProfileName(),
        title: this.getTitle(),
      };
    },
    getPropsForListItem() {
      const result = {
        ...this.format(),

        lastUpdated: this.get('timestamp'),
        unreadCount: this.get('unreadCount') || 0,
        isSelected: this.isSelected,

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
    updateVerified() {
      if (this.isPrivate()) {
        return Promise.all([this.safeGetVerified(), this.initialPromise]).then(
          results => {
            const trust = results[0];
            // we don't return here because we don't need to wait for this to finish
            this.save({ verified: trust });
          }
        );
      }
      const promise = this.fetchContacts();

      return promise
        .then(() =>
          Promise.all(
            this.contactCollection.map(contact => {
              if (!contact.isMe()) {
                return contact.updateVerified();
              }
              return Promise.resolve();
            })
          )
        )
        .then(this.onMemberVerifiedChange.bind(this));
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
    _setVerified(verified, providedOptions) {
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
      let promise;
      if (options.viaSyncMessage) {
        // handle the incoming key from the sync messages - need different
        // behavior if that key doesn't match the current key
        promise = textsecure.storage.protocol.processVerifiedMessage(
          this.id,
          verified,
          options.key
        );
      } else {
        promise = textsecure.storage.protocol.setVerified(this.id, verified);
      }

      let keychange;
      return promise
        .then(updatedKey => {
          keychange = updatedKey;
          return new Promise(resolve =>
            this.save({ verified }).always(resolve)
          );
        })
        .then(() => {
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
            (keychange && verified === VERIFIED)
          ) {
            this.addVerifiedChange(this.id, verified === VERIFIED, {
              local: !options.viaSyncMessage,
            });
          }
          if (!options.viaSyncMessage) {
            return this.sendVerifySyncMessage(this.id, verified);
          }
          return Promise.resolve();
        });
    },
    sendVerifySyncMessage(number, state) {
      const promise = textsecure.storage.protocol.loadIdentityKey(number);
      return promise.then(key =>
        textsecure.messaging.syncVerification(number, state, key)
      );
    },
    getIdentityKeys() {
      const lookup = {};

      if (this.isPrivate()) {
        return textsecure.storage.protocol
          .loadIdentityKey(this.id)
          .then(key => {
            lookup[this.id] = key;
            return lookup;
          })
          .catch(error => {
            window.log.error(
              'getIdentityKeys error for conversation',
              this.idForLogging(),
              error && error.stack ? error.stack : error
            );
            return lookup;
          });
      }
      const promises = this.contactCollection.map(contact =>
        textsecure.storage.protocol.loadIdentityKey(contact.id).then(
          key => {
            lookup[contact.id] = key;
          },
          error => {
            window.log.error(
              'getIdentityKeys error for group member',
              contact.idForLogging(),
              error && error.stack ? error.stack : error
            );
          }
        )
      );

      return Promise.all(promises).then(() => lookup);
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
    getKeyExchangeStatus() {
      return this.get('keyExchangeStatus') || 'none';
    },
    isKeyExchangeCompleted() {
      if (!this.isPrivate()) {
        throw new Error(
          'isKeyExchangeCompleted not implemented for groups'
        );
      }

      if (this.isMe()) {
        return true;
      }

      return this.getKeyExchangeStatus() == 'completed';
    },
    setKeyExchangeStatus(status) {
      if (typeof status !== 'string') {
        throw new Error(
          'setKeyExchangeStatus expects a string'
        );
      }
      status = status.toLowerCase();
      
      if (['none', 'ongoing', 'completed'].indexOf(status) < 0) {
        throw new Error(
          'unknown string value given to setKeyExchangeStatus'
        );
      }
      this.set({ keyExchangeStatus: status });
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
        ConversationController.getAllGroupsInvolvingId(id).then(groups => {
          _.forEach(groups, group => {
            group.addVerifiedChange(id, verified, options);
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

      this.updateTokens();

      return null;
    },

    validateNumber() {
      if (this.isPrivate()) {
        if (this.id.length == (33 * 2)) // 33 bytes in hex
        {
          this.set({ id: this.id });
          return null;
        }

        return 'Invalid ID';
      }

      return null;
    },

    updateTokens() {
      let tokens = [];
      const name = this.get('name');
      if (typeof name === 'string') {
        tokens.push(name.toLowerCase());
        tokens = tokens.concat(
          name
            .trim()
            .toLowerCase()
            .split(/[\s\-_()+]+/)
        );
      }
      if (this.isPrivate()) {
        const regionCode = storage.get('regionCode');
        const number = libphonenumber.util.parseNumber(this.id, regionCode);
        tokens.push(
          number.nationalNumber,
          number.countryCode + number.nationalNumber
        );
      }
      this.set({ tokens });
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

    sendMessage(body, attachments, quote) {
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

        const messageWithSchema = await upgradeMessageSchema({
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

        const message = this.addSingleMessage(messageWithSchema);
        this.lastMessage = message.getNotificationText();
        this.lastMessageStatus = 'sending';

        this.save({
          active_at: now,
          timestamp: now,
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
          return;
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
        message.send(
          sendFunction(
            destination,
            body,
            attachmentsWithData,
            quote,
            now,
            expireTimer,
            profileKey
          )
        );
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
      lastMessageUpdate.lastMessage = null;
      lastMessageUpdate.lastMessageStatus = null;

      hasChanged = hasChanged || lastMessage !== this.lastMessage;
      this.lastMessage = lastMessage;

      hasChanged = hasChanged || lastMessageStatus !== this.lastMessageStatus;
      this.lastMessageStatus = lastMessageStatus;

      this.set(lastMessageUpdate);

      if (this.hasChanged()) {
        this.save();
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
        return Promise.resolve();
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

      await wrapDeferred(this.save({ expireTimer }));

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
      const promise = sendFunc(
        this.get('id'),
        this.get('expireTimer'),
        message.get('sent_at'),
        profileKey
      );

      await message.send(promise);

      return message;
    },

    isSearchable() {
      return !this.get('left') || !!this.get('lastMessage');
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

        message.send(textsecure.messaging.resetSession(this.id, now));
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

      message.send(
        textsecure.messaging.updateGroup(
          this.id,
          this.get('name'),
          this.get('avatar'),
          this.get('members')
        )
      );
    },

    async leaveGroup() {
      const now = Date.now();
      if (this.get('type') === 'group') {
        this.save({ left: true });
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

        message.send(textsecure.messaging.leaveGroup(this.id));
      }
    },

    markRead(newestUnreadDate, providedOptions) {
      const options = providedOptions || {};
      _.defaults(options, { sendReadReceipts: true });

      const conversationId = this.id;
      Whisper.Notifications.remove(
        Whisper.Notifications.where({
          conversationId,
        })
      );

      return this.getUnread().then(providedUnreadMessages => {
        let unreadMessages = providedUnreadMessages;

        const promises = [];
        const oldUnread = unreadMessages.filter(
          message => message.get('received_at') <= newestUnreadDate
        );

        let read = _.map(oldUnread, providedM => {
          let m = providedM;

          if (this.messageCollection.get(m.id)) {
            m = this.messageCollection.get(m.id);
          } else {
            window.log.warn(
              'Marked a message as read in the database, but ' +
                'it was not in messageCollection.'
            );
          }
          promises.push(m.markRead(options.readAt));
          const errors = m.get('errors');
          return {
            sender: m.get('source'),
            timestamp: m.get('sent_at'),
            hasErrors: Boolean(errors && errors.length),
          };
        });

        // Some messages we're marking read are local notifications with no sender
        read = _.filter(read, m => Boolean(m.sender));
        unreadMessages = unreadMessages.filter(m => Boolean(m.isIncoming()));

        const unreadCount = unreadMessages.length - read.length;
        const promise = new Promise((resolve, reject) => {
          this.save({ unreadCount }).then(resolve, reject);
        });
        promises.push(promise);

        // If a message has errors, we don't want to send anything out about it.
        //   read syncs - let's wait for a client that really understands the message
        //      to mark it read. we'll mark our local error read locally, though.
        //   read receipts - here we can run into infinite loops, where each time the
        //      conversation is viewed, another error message shows up for the contact
        read = read.filter(item => !item.hasErrors);

        if (read.length && options.sendReadReceipts) {
          window.log.info('Sending', read.length, 'read receipts');
          promises.push(textsecure.messaging.syncReadMessages(read));

          if (storage.get('read-receipt-setting')) {
            _.each(_.groupBy(read, 'sender'), (receipts, sender) => {
              const timestamps = _.map(receipts, 'timestamp');
              promises.push(
                textsecure.messaging.sendReadReceipts(sender, timestamps)
              );
            });
          }
        }

        return Promise.all(promises);
      });
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

    getProfile(id) {
      if (!textsecure.messaging) {
        const message =
          'Conversation.getProfile: textsecure.messaging not available';
        return Promise.reject(new Error(message));
      }

      return textsecure.messaging
        .getProfile(id)
        .then(profile => {
          const identityKey = dcodeIO.ByteBuffer.wrap(
            profile.identityKey,
            'base64'
          ).toArrayBuffer();

          return textsecure.storage.protocol
            .saveIdentity(`${id}.1`, identityKey, false)
            .then(changed => {
              if (changed) {
                // save identity will close all sessions except for .1, so we
                // must close that one manually.
                const address = new libsignal.SignalProtocolAddress(id, 1);
                window.log.info('closing session for', address.toString());
                const sessionCipher = new libsignal.SessionCipher(
                  textsecure.storage.protocol,
                  address
                );
                return sessionCipher.closeOpenSessionForDevice();
              }
              return Promise.resolve();
            })
            .then(() => {
              const c = ConversationController.get(id);
              return Promise.all([
                c.setProfileName(profile.name),
                c.setProfileAvatar(profile.avatar),
              ]).then(
                // success
                () =>
                  new Promise((resolve, reject) => {
                    c.save().then(resolve, reject);
                  }),
                // fail
                e => {
                  if (e.name === 'ProfileDecryptError') {
                    // probably the profile key has changed.
                    window.log.error(
                      'decryptProfile error:',
                      id,
                      profile,
                      e && e.stack ? e.stack : e
                    );
                  }
                }
              );
            });
        })
        .catch(error => {
          window.log.error(
            'getProfile error:',
            error && error.stack ? error.stack : error
          );
        });
    },
    setProfileName(encryptedName) {
      const key = this.get('profileKey');
      if (!key) {
        return Promise.resolve();
      }

      try {
        // decode
        const data = dcodeIO.ByteBuffer.wrap(
          encryptedName,
          'base64'
        ).toArrayBuffer();

        // decrypt
        return textsecure.crypto
          .decryptProfileName(data, key)
          .then(decrypted => {
            // encode
            const name = dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8');

            // set
            this.set({ profileName: name });
          });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    setProfileAvatar(avatarPath) {
      if (!avatarPath) {
        return Promise.resolve();
      }

      return textsecure.messaging.getAvatar(avatarPath).then(avatar => {
        const key = this.get('profileKey');
        if (!key) {
          return Promise.resolve();
        }
        // decrypt
        return textsecure.crypto.decryptProfile(avatar, key).then(decrypted => {
          // set
          this.set({
            profileAvatar: {
              data: decrypted,
              contentType: 'image/jpeg',
              size: decrypted.byteLength,
            },
          });
        });
      });
    },
    setProfileKey(key) {
      return new Promise((resolve, reject) => {
        if (!constantTimeEqualArrayBuffers(this.get('profileKey'), key)) {
          this.save({ profileKey: key }).then(resolve, reject);
        } else {
          resolve();
        }
      });
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

      this.save({
        lastMessage: null,
        timestamp: null,
        active_at: null,
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
      const number = this.id;
      try {
        const parsedNumber = libphonenumber.parse(number);
        const regionCode = libphonenumber.getRegionCodeForNumber(parsedNumber);
        if (regionCode === storage.get('regionCode')) {
          return libphonenumber.format(
            parsedNumber,
            libphonenumber.PhoneNumberFormat.NATIONAL
          );
        }
        return libphonenumber.format(
          parsedNumber,
          libphonenumber.PhoneNumberFormat.INTERNATIONAL
        );
      } catch (e) {
        return number;
      }
    },

    isPrivate() {
      return this.get('type') === 'private';
    },

    revokeAvatarUrl() {
      if (this.avatarUrl) {
        URL.revokeObjectURL(this.avatarUrl);
        this.avatarUrl = null;
      }
    },

    updateAvatarUrl(silent) {
      this.revokeAvatarUrl();
      const avatar = this.get('avatar') || this.get('profileAvatar');
      if (avatar) {
        this.avatarUrl = URL.createObjectURL(
          new Blob([avatar.data], { type: avatar.contentType })
        );
      } else {
        this.avatarUrl = null;
      }
      if (!silent) {
        this.trigger('change');
      }
    },
    getColor() {
      const { migrateColor } = Util;
      return migrateColor(this.get('color'));
    },
    getAvatar() {
      if (this.avatarUrl === undefined) {
        this.updateAvatarUrl(true);
      }

      const title = this.get('name');
      const color = this.getColor();

      if (this.avatarUrl) {
        return { url: this.avatarUrl, color };
      } else if (this.isPrivate()) {
        return {
          color,
          content: title ? title.trim()[0] : '#',
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
    hashCode() {
      if (this.hash === undefined) {
        const string = this.getTitle() || '';
        if (string.length === 0) {
          return 0;
        }
        let hash = 0;
        for (let i = 0; i < string.length; i += 1) {
          // eslint-disable-next-line no-bitwise
          hash = (hash << 5) - hash + string.charCodeAt(i);
          // eslint-disable-next-line no-bitwise
          hash &= hash; // Convert to 32bit integer
        }

        this.hash = hash;
      }
      return this.hash;
    },
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    model: Whisper.Conversation,

    comparator(m) {
      return -m.get('timestamp');
    },

    destroyAll() {
      return Promise.all(
        this.models.map(conversation => wrapDeferred(conversation.destroy()))
      );
    },

    search(providedQuery) {
      let query = providedQuery.trim().toLowerCase();
      if (query.length > 0) {
        query = query.replace(/[-.()]*/g, '').replace(/^\+(\d*)$/, '$1');
        const lastCharCode = query.charCodeAt(query.length - 1);
        const nextChar = String.fromCharCode(lastCharCode + 1);
        const upper = query.slice(0, -1) + nextChar;
        return new Promise(resolve => {
          this.fetch({
            index: {
              name: 'search', // 'search' index on tokens array
              lower: query,
              upper,
              excludeUpper: true,
            },
          }).always(resolve);
        });
      }
      return Promise.resolve();
    },

    fetchAlphabetical() {
      return new Promise(resolve => {
        this.fetch({
          index: {
            name: 'search', // 'search' index on tokens array
          },
          limit: 100,
        }).always(resolve);
      });
    },

    fetchGroups(number) {
      return new Promise(resolve => {
        this.fetch({
          index: {
            name: 'group',
            only: number,
          },
        }).always(resolve);
      });
    },
  });

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');

  // Special collection for fetching all the groups a certain number appears in
  Whisper.GroupCollection = Backbone.Collection.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    model: Whisper.Conversation,
    fetchGroups(number) {
      return new Promise(resolve => {
        this.fetch({
          index: {
            name: 'group',
            only: number,
          },
        }).always(resolve);
      });
    },
  });
})();
