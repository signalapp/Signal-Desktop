/* global _: false */
/* global Backbone: false */
/* global dcodeIO: false */
/* global libphonenumber: false */

/* global ConversationController: false */
/* global libsignal: false */
/* global Signal: false */
/* global storage: false */
/* global textsecure: false */
/* global Whisper: false */
/* global wrapDeferred: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { Message } = window.Signal.Types;
  const { upgradeMessageSchema, loadAttachmentData } = window.Signal.Migrations;

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

      this.on('change:avatar', this.updateAvatarUrl);
      this.on('change:profileAvatar', this.updateAvatarUrl);
      this.on('change:profileKey', this.onChangeProfileKey);
      this.on('destroy', this.revokeAvatarUrl);
    },

    isMe() {
      return this.id === this.ourNumber;
    },

    addSingleMessage(message) {
      const model = this.messageCollection.add(message, { merge: true });
      this.processQuotes(this.messageCollection);
      return model;
    },

    onMessageError() {
      this.updateVerified();
    },
    safeGetVerified() {
      const promise = textsecure.storage.protocol.getVerified(this.id);
      return promise.catch(() => textsecure.storage.protocol.VerifiedStatus.DEFAULT);
    },
    updateVerified() {
      if (this.isPrivate()) {
        return Promise.all([
          this.safeGetVerified(),
          this.initialPromise,
        ]).then((results) => {
          const trust = results[0];
          // we don't return here because we don't need to wait for this to finish
          this.save({ verified: trust });
        });
      }
      const promise = this.fetchContacts();

      return promise.then(() => Promise.all(this.contactCollection.map((contact) => {
        if (!contact.isMe()) {
          return contact.updateVerified();
        }
        return Promise.resolve();
      }))).then(this.onMemberVerifiedChange.bind(this));
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
      _.defaults(options, { viaSyncMessage: false, viaContactSync: false, key: null });

      const {
        VERIFIED,
        UNVERIFIED,
      } = this.verifiedEnum;

      if (!this.isPrivate()) {
        throw new Error('You cannot verify a group conversation. ' +
                            'You must verify individual contacts.');
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
      return promise.then((updatedKey) => {
        keychange = updatedKey;
        return new Promise((resolve => this.save({ verified }).always(resolve)));
      }).then(() => {
        // Three situations result in a verification notice in the conversation:
        //   1) The message came from an explicit verification in another client (not
        //      a contact sync)
        //   2) The verification value received by the contact sync is different
        //      from what we have on record (and it's not a transition to UNVERIFIED)
        //   3) Our local verification status is VERIFIED and it hasn't changed,
        //      but the key did change (Key1/VERIFIED to Key2/VERIFIED - but we don't
        //      want to show DEFAULT->DEFAULT or UNVERIFIED->UNVERIFIED)
        if (!options.viaContactSync ||
                (beginningVerified !== verified && verified !== UNVERIFIED) ||
                (keychange && verified === VERIFIED)) {
          return this.addVerifiedChange(
            this.id,
            verified === VERIFIED,
            { local: !options.viaSyncMessage }
          );
        }
        if (!options.viaSyncMessage) {
          return this.sendVerifySyncMessage(this.id, verified);
        }
        return Promise.resolve();
      });
    },
    sendVerifySyncMessage(number, state) {
      const promise = textsecure.storage.protocol.loadIdentityKey(number);
      return promise.then(key => textsecure.messaging.syncVerification(
        number,
        state,
        key
      ));
    },
    getIdentityKeys() {
      const lookup = {};

      if (this.isPrivate()) {
        return textsecure.storage.protocol.loadIdentityKey(this.id).then((key) => {
          lookup[this.id] = key;
          return lookup;
        }).catch((error) => {
          console.log(
            'getIdentityKeys error for conversation',
            this.idForLogging(),
            error && error.stack ? error.stack : error
          );
          return lookup;
        });
      }
      const promises = this.contactCollection.map(contact =>
        textsecure.storage.protocol.loadIdentityKey(contact.id).then(
          (key) => {
            lookup[contact.id] = key;
          },
          (error) => {
            console.log(
              'getIdentityKeys error for group member',
              contact.idForLogging(),
              error && error.stack ? error.stack : error
            );
          }
        ));

      return Promise.all(promises).then(() => lookup);
    },
    replay(error, message) {
      const replayable = new textsecure.ReplayableError(error);
      return replayable.replay(message.attributes).catch((e) => {
        console.log(
          'replay error:',
          e && e.stack ? e.stack : e
        );
      });
    },
    decryptOldIncomingKeyErrors() {
      // We want to run just once per conversation
      if (this.get('decryptedOldIncomingKeyErrors')) {
        return Promise.resolve();
      }
      console.log('decryptOldIncomingKeyErrors start for', this.idForLogging());

      const messages = this.messageCollection.filter((message) => {
        const errors = message.get('errors');
        if (!errors || !errors[0]) {
          return false;
        }
        const error = _.find(errors, e => e.name === 'IncomingIdentityKeyError');

        return Boolean(error);
      });

      const markComplete = () => {
        console.log('decryptOldIncomingKeyErrors complete for', this.idForLogging());
        return new Promise((resolve) => {
          this.save({ decryptedOldIncomingKeyErrors: true }).always(resolve);
        });
      };

      if (!messages.length) {
        return markComplete();
      }

      console.log(
        'decryptOldIncomingKeyErrors found',
        messages.length,
        'messages to process'
      );
      const safeDelete = message => new Promise((resolve) => {
        message.destroy().always(resolve);
      });

      const promise = this.getIdentityKeys();
      return promise.then(lookup => Promise.all(_.map(messages, (message) => {
        const source = message.get('source');
        const error = _.find(
          message.get('errors'),
          e => e.name === 'IncomingIdentityKeyError'
        );

        const key = lookup[source];
        if (!key) {
          return Promise.resolve();
        }

        if (constantTimeEqualArrayBuffers(key, error.identityKey)) {
          return this.replay(error, message).then(() => safeDelete(message));
        }

        return Promise.resolve();
      }))).catch((error) => {
        console.log(
          'decryptOldIncomingKeyErrors error:',
          error && error.stack ? error.stack : error
        );
      }).then(markComplete);
    },
    isVerified() {
      if (this.isPrivate()) {
        return this.get('verified') === this.verifiedEnum.VERIFIED;
      }
      if (!this.contactCollection.length) {
        return false;
      }

      return this.contactCollection.every((contact) => {
        if (contact.isMe()) {
          return true;
        }
        return contact.isVerified();
      });
    },
    isUnverified() {
      if (this.isPrivate()) {
        const verified = this.get('verified');
        return verified !== this.verifiedEnum.VERIFIED &&
          verified !== this.verifiedEnum.DEFAULT;
      }
      if (!this.contactCollection.length) {
        return true;
      }

      return this.contactCollection.any((contact) => {
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
      return new Backbone.Collection(this.contactCollection.filter((contact) => {
        if (contact.isMe()) {
          return false;
        }
        return contact.isUnverified();
      }));
    },
    setApproved() {
      if (!this.isPrivate()) {
        throw new Error('You cannot set a group conversation as trusted. ' +
                            'You must set individual contacts as trusted.');
      }

      return textsecure.storage.protocol.setApproval(this.id, true);
    },
    safeIsUntrusted() {
      return textsecure.storage.protocol.isUntrusted(this.id).catch(() => false);
    },
    isUntrusted() {
      if (this.isPrivate()) {
        return this.safeIsUntrusted();
      }
      if (!this.contactCollection.length) {
        return Promise.resolve(false);
      }

      return Promise.all(this.contactCollection.map((contact) => {
        if (contact.isMe()) {
          return false;
        }
        return contact.safeIsUntrusted();
      })).then(results => _.any(results, result => result));
    },
    getUntrusted() {
      // This is a bit ugly because isUntrusted() is async. Could do the work to cache
      //   it locally, but we really only need it for this call.
      if (this.isPrivate()) {
        return this.isUntrusted().then((untrusted) => {
          if (untrusted) {
            return new Backbone.Collection([this]);
          }

          return new Backbone.Collection();
        });
      }
      return Promise.all(this.contactCollection.map((contact) => {
        if (contact.isMe()) {
          return [false, contact];
        }
        return Promise.all([contact.isUntrusted(), contact]);
      })).then((results) => {
        const filtered = _.filter(results, (result) => {
          const untrusted = result[0];
          return untrusted;
        });
        return new Backbone.Collection(_.map(filtered, (result) => {
          const contact = result[1];
          return contact;
        }));
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

    addKeyChange(id) {
      console.log(
        'adding key change advisory for',
        this.idForLogging(),
        id,
        this.get('timestamp')
      );

      const timestamp = Date.now();
      const message = new Whisper.Message({
        conversationId: this.id,
        type: 'keychange',
        sent_at: this.get('timestamp'),
        received_at: timestamp,
        key_changed: id,
        unread: 1,
      });
      message.save().then(this.trigger.bind(this, 'newmessage', message));
    },
    addVerifiedChange(id, verified, providedOptions) {
      const options = providedOptions || {};
      _.defaults(options, { local: true });

      if (this.isMe()) {
        console.log('refusing to add verified change advisory for our own number');
        return;
      }

      const lastMessage = this.get('timestamp') || Date.now();

      console.log(
        'adding verified change advisory for',
        this.idForLogging(),
        id,
        lastMessage
      );

      const timestamp = Date.now();
      const message = new Whisper.Message({
        conversationId: this.id,
        type: 'verified-change',
        sent_at: lastMessage,
        received_at: timestamp,
        verifiedChanged: id,
        verified,
        local: options.local,
        unread: 1,
      });
      message.save().then(this.trigger.bind(this, 'newmessage', message));

      if (this.isPrivate()) {
        ConversationController.getAllGroupsInvolvingId(id).then((groups) => {
          _.forEach(groups, (group) => {
            group.addVerifiedChange(id, verified, options);
          });
        });
      }
    },

    onReadMessage(message) {
      if (this.messageCollection.get(message.id)) {
        this.messageCollection.get(message.id).fetch();
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
      return this.queueJob(() => this.markRead(
        message.get('received_at'),
        { sendReadReceipts: false }
      ));
    },

    getUnread() {
      const conversationId = this.id;
      const unreadMessages = new Whisper.MessageCollection();
      return new Promise((resolve => unreadMessages.fetch({
        index: {
          // 'unread' index
          name: 'unread',
          lower: [conversationId],
          upper: [conversationId, Number.MAX_VALUE],
        },
      }).always(() => {
        resolve(unreadMessages);
      })));
    },

    validate(attributes) {
      const required = ['id', 'type'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) { return `Conversation must have ${missing}`; }

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
        const regionCode = storage.get('regionCode');
        const number = libphonenumber.util.parseNumber(this.id, regionCode);
        if (number.isValidNumber) {
          this.set({ id: number.e164 });
          return null;
        }

        return number.error || 'Invalid phone number';
      }

      return null;
    },

    updateTokens() {
      let tokens = [];
      const name = this.get('name');
      if (typeof name === 'string') {
        tokens.push(name.toLowerCase());
        tokens = tokens.concat(name.trim().toLowerCase().split(/[\s\-_()+]+/));
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

    blobToArrayBuffer(blob) {
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = e => resolve(e.target.result);
        fileReader.onerror = reject;
        fileReader.onabort = reject;

        fileReader.readAsArrayBuffer(blob);
      });
    },

    async makeThumbnailAttachment(attachment) {
      const attachmentWithData = await loadAttachmentData(attachment);
      const { data, contentType } = attachmentWithData;
      const objectUrl = this.makeObjectUrl(data, contentType);

      const thumbnail = Signal.Util.GoogleChrome.isImageTypeSupported(contentType)
        ? await Whisper.FileInputView.makeImageThumbnail(128, objectUrl)
        : await Whisper.FileInputView.makeVideoThumbnail(128, objectUrl);

      URL.revokeObjectURL(objectUrl);

      const arrayBuffer = await this.blobToArrayBuffer(thumbnail);
      const finalContentType = 'image/png';
      const finalObjectUrl = this.makeObjectUrl(arrayBuffer, finalContentType);

      return {
        data: arrayBuffer,
        objectUrl: finalObjectUrl,
        contentType: finalContentType,
      };
    },

    async makeQuote(quotedMessage) {
      const contact = quotedMessage.getContact();
      const attachments = quotedMessage.get('attachments');

      return {
        author: contact.id,
        id: quotedMessage.get('sent_at'),
        text: quotedMessage.get('body'),
        attachments: await Promise.all((attachments || []).map(async (attachment) => {
          const { contentType } = attachment;
          const willMakeThumbnail =
            Signal.Util.GoogleChrome.isImageTypeSupported(contentType) ||
            Signal.Util.GoogleChrome.isVideoTypeSupported(contentType);

          return {
            contentType,
            fileName: attachment.fileName,
            thumbnail: willMakeThumbnail
              ? await this.makeThumbnailAttachment(attachment)
              : null,
          };
        })),
      };
    },

    sendMessage(body, attachments, quote) {
      this.queueJob(async () => {
        const now = Date.now();

        console.log(
          'Sending message to conversation',
          this.idForLogging(),
          'with timestamp',
          now
        );

        const messageWithSchema = await upgradeMessageSchema({
          type: 'outgoing',
          body,
          conversationId: this.id,
          quote,
          attachments,
          sent_at: now,
          received_at: now,
          expireTimer: this.get('expireTimer'),
          recipients: this.getRecipients(),
        });
        const message = this.addSingleMessage(messageWithSchema);

        if (this.isPrivate()) {
          message.set({ destination: this.id });
        }
        message.save();

        this.save({
          active_at: now,
          timestamp: now,
          lastMessage: message.getNotificationText(),
        });

        const conversationType = this.get('type');
        const sendFunction = (() => {
          switch (conversationType) {
            case Message.PRIVATE:
              return textsecure.messaging.sendMessageToNumber;
            case Message.GROUP:
              return textsecure.messaging.sendMessageToGroup;
            default:
              throw new TypeError(`Invalid conversation type: '${conversationType}'`);
          }
        })();

        let profileKey;
        if (this.get('profileSharing')) {
          profileKey = storage.get('profileKey');
        }

        const attachmentsWithData =
            await Promise.all(messageWithSchema.attachments.map(loadAttachmentData));
        message.send(sendFunction(
          this.get('id'),
          body,
          attachmentsWithData,
          quote,
          now,
          this.get('expireTimer'),
          profileKey
        ));
      });
    },

    async updateLastMessage() {
      const collection = new Whisper.MessageCollection();
      await collection.fetchConversation(this.id, 1);
      const lastMessage = collection.at(0);

      const lastMessageUpdate = window.Signal.Types.Conversation.createLastMessageUpdate({
        currentLastMessageText: this.get('lastMessage') || null,
        currentTimestamp: this.get('timestamp') || null,
        lastMessage: lastMessage ? lastMessage.toJSON() : null,
        lastMessageNotificationText: lastMessage
          ? lastMessage.getNotificationText() : null,
      });

      this.set(lastMessageUpdate);

      if (this.hasChanged('lastMessage') || this.hasChanged('timestamp')) {
        this.save();
      }
    },

    updateExpirationTimer(
      providedExpireTimer,
      providedSource,
      receivedAt,
      providedOptions
    ) {
      const options = providedOptions || {};
      let expireTimer = providedExpireTimer;
      let source = providedSource;

      _.defaults(options, { fromSync: false });

      if (!expireTimer) {
        expireTimer = null;
      }
      if (this.get('expireTimer') === expireTimer ||
            (!expireTimer && !this.get('expireTimer'))) {
        return Promise.resolve();
      }

      console.log(
        'Updating expireTimer for conversation',
        this.idForLogging(),
        'to',
        expireTimer,
        'via',
        source
      );
      source = source || textsecure.storage.user.getNumber();
      const timestamp = receivedAt || Date.now();

      const message = this.messageCollection.add({
        conversationId: this.id,
        type: receivedAt ? 'incoming' : 'outgoing',
        sent_at: timestamp,
        received_at: timestamp,
        flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
        expirationTimerUpdate: {
          expireTimer,
          source,
          fromSync: options.fromSync,
        },
      });
      if (this.isPrivate()) {
        message.set({ destination: this.id });
      }
      if (message.isOutgoing()) {
        message.set({ recipients: this.getRecipients() });
      }

      return Promise.all([
        wrapDeferred(message.save()),
        wrapDeferred(this.save({ expireTimer })),
      ]).then(() => {
        if (message.isIncoming()) {
          return message;
        }

        // change was made locally, send it to the number/group
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

        return message.send(promise).then(() => message);
      });
    },

    isSearchable() {
      return !this.get('left') || !!this.get('lastMessage');
    },

    endSession() {
      if (this.isPrivate()) {
        const now = Date.now();
        const message = this.messageCollection.create({
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
          destination: this.id,
          recipients: this.getRecipients(),
          flags: textsecure.protobuf.DataMessage.Flags.END_SESSION,
        });
        message.send(textsecure.messaging.resetSession(this.id, now));
      }
    },

    updateGroup(providedGroupUpdate) {
      let groupUpdate = providedGroupUpdate;

      if (this.isPrivate()) {
        throw new Error('Called update group on private conversation');
      }
      if (groupUpdate === undefined) {
        groupUpdate = this.pick(['name', 'avatar', 'members']);
      }
      const now = Date.now();
      const message = this.messageCollection.create({
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: now,
        group_update: groupUpdate,
      });
      message.send(textsecure.messaging.updateGroup(
        this.id,
        this.get('name'),
        this.get('avatar'),
        this.get('members')
      ));
    },

    leaveGroup() {
      const now = Date.now();
      if (this.get('type') === 'group') {
        this.save({ left: true });
        const message = this.messageCollection.create({
          group_update: { left: 'You' },
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
        });
        message.send(textsecure.messaging.leaveGroup(this.id));
      }
    },

    markRead(newestUnreadDate, providedOptions) {
      const options = providedOptions || {};
      _.defaults(options, { sendReadReceipts: true });

      const conversationId = this.id;
      Whisper.Notifications.remove(Whisper.Notifications.where({
        conversationId,
      }));

      return this.getUnread().then((providedUnreadMessages) => {
        let unreadMessages = providedUnreadMessages;

        const promises = [];
        const oldUnread = unreadMessages.filter(message =>
          message.get('received_at') <= newestUnreadDate);

        let read = _.map(oldUnread, (providedM) => {
          let m = providedM;

          if (this.messageCollection.get(m.id)) {
            m = this.messageCollection.get(m.id);
          } else {
            console.log('Marked a message as read in the database, but ' +
                                'it was not in messageCollection.');
          }
          promises.push(m.markRead());
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
          console.log('Sending', read.length, 'read receipts');
          promises.push(textsecure.messaging.syncReadMessages(read));

          if (storage.get('read-receipt-setting')) {
            _.each(_.groupBy(read, 'sender'), (receipts, sender) => {
              const timestamps = _.map(receipts, 'timestamp');
              promises.push(textsecure.messaging.sendReadReceipts(sender, timestamps));
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
        const message = 'Conversation.getProfile: textsecure.messaging not available';
        return Promise.reject(new Error(message));
      }

      return textsecure.messaging.getProfile(id).then((profile) => {
        const identityKey = dcodeIO.ByteBuffer.wrap(
          profile.identityKey,
          'base64'
        ).toArrayBuffer();

        return textsecure.storage.protocol.saveIdentity(
          `${id}.1`,
          identityKey,
          false
        ).then((changed) => {
          if (changed) {
            // save identity will close all sessions except for .1, so we
            // must close that one manually.
            const address = new libsignal.SignalProtocolAddress(id, 1);
            console.log('closing session for', address.toString());
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
              address
            );
            return sessionCipher.closeOpenSessionForDevice();
          }
          return Promise.resolve();
        }).then(() => {
          const c = ConversationController.get(id);
          return Promise.all([
            c.setProfileName(profile.name),
            c.setProfileAvatar(profile.avatar),
          ]).then(
            // success
            () => new Promise((resolve, reject) => {
              c.save().then(resolve, reject);
            }),
            // fail
            (e) => {
              if (e.name === 'ProfileDecryptError') {
              // probably the profile key has changed.
                console.log(
                  'decryptProfile error:',
                  id,
                  profile,
                  e && e.stack ? e.stack : e
                );
              }
            }
          );
        });
      }).catch((error) => {
        console.log(
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
        const data = dcodeIO.ByteBuffer.wrap(encryptedName, 'base64').toArrayBuffer();

        // decrypt
        return textsecure.crypto.decryptProfileName(data, key).then((decrypted) => {
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

      return textsecure.messaging.getAvatar(avatarPath).then((avatar) => {
        const key = this.get('profileKey');
        if (!key) {
          return Promise.resolve();
        }
        // decrypt
        return textsecure.crypto.decryptProfile(avatar, key).then((decrypted) => {
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

    makeKey(author, id) {
      return `${author}-${id}`;
    },
    doesMessageMatch(id, author, message) {
      const messageAuthor = message.getContact().id;

      if (author !== messageAuthor) {
        return false;
      }
      if (id !== message.get('sent_at')) {
        return false;
      }
      return true;
    },
    needData(attachments) {
      if (!attachments || attachments.length === 0) {
        return false;
      }

      const first = attachments[0];
      const { thumbnail, contentType } = first;

      return thumbnail ||
        Signal.Util.GoogleChrome.isImageTypeSupported(contentType) ||
        Signal.Util.GoogleChrome.isVideoTypeSupported(contentType);
    },
    forceRender(message) {
      message.trigger('change', message);
    },
    makeObjectUrl(data, contentType) {
      const blob = new Blob([data], {
        type: contentType,
      });
      return URL.createObjectURL(blob);
    },
    makeMessagesLookup(messages) {
      return messages.reduce((acc, message) => {
        const { source, sent_at: sentAt } = message.attributes;

        // Checking for notification messages (safety number change, timer change)
        if (!source && message.isIncoming()) {
          return acc;
        }

        const contact = message.getContact();
        if (!contact) {
          return acc;
        }

        const author = contact.id;
        const key = this.makeKey(author, sentAt);

        acc[key] = message;

        return acc;
      }, {});
    },
    async loadQuotedMessageFromDatabase(message) {
      const { quote } = message.attributes;
      const { attachments, id, author } = quote;
      const first = attachments[0];

      if (!first || first.thumbnail) {
        return true;
      }

      if (!Signal.Util.GoogleChrome.isImageTypeSupported(first.contentType) &&
        !Signal.Util.GoogleChrome.isVideoTypeSupported(first.contentType)) {
        return false;
      }

      const collection = new Whisper.MessageCollection();
      await collection.fetchSentAt(id);
      const queryMessage = collection.find(m => this.doesMessageMatch(id, author, m));

      if (!queryMessage) {
        return false;
      }

      const queryAttachments = queryMessage.attachments || [];
      if (queryAttachments.length === 0) {
        return false;
      }

      const queryFirst = queryAttachments[0];
      try {
        // eslint-disable-next-line no-param-reassign
        message.quoteThumbnail = await this.makeThumbnailAttachment(queryFirst);
        return true;
      } catch (error) {
        console.log(
          'Problem loading attachment data for quoted message from database',
          error && error.stack ? error.stack : error
        );
        return false;
      }
    },
    async loadQuotedMessage(message, quotedMessage) {
      // eslint-disable-next-line no-param-reassign
      message.quotedMessage = quotedMessage;

      const { quote } = message.attributes;
      const { attachments } = quote;
      const first = attachments[0];

      if (!first || first.thumbnail) {
        return;
      }

      if (!Signal.Util.GoogleChrome.isImageTypeSupported(first.contentType) &&
        !Signal.Util.GoogleChrome.isVideoTypeSupported(first.contentType)) {
        return;
      }

      const quotedAttachments = quotedMessage.get('attachments') || [];
      if (quotedAttachments.length === 0) {
        return;
      }

      try {
        const queryFirst = quotedAttachments[0];

        // eslint-disable-next-line no-param-reassign
        message.quoteThumbnail = await this.makeThumbnailAttachment(queryFirst);
      } catch (error) {
        console.log(
          'Problem loading attachment data for quoted message',
          error && error.stack ? error.stack : error
        );
      }
    },
    async loadQuoteThumbnail(message) {
      const { quote } = message.attributes;
      const { attachments } = quote;
      const first = attachments[0];
      if (!first) {
        return false;
      }

      const { thumbnail } = first;

      if (!thumbnail) {
        return false;
      }
      try {
        const thumbnailWithData = await loadAttachmentData(thumbnail);
        thumbnailWithData.objectUrl = this.makeObjectUrl(
          thumbnailWithData.data,
          thumbnailWithData.contentType
        );

        // If we update this data in place, there's the risk that this data could be
        //   saved back to the database
        // eslint-disable-next-line no-param-reassign
        message.quoteThumbnail = thumbnailWithData;

        return true;
      } catch (error) {
        console.log(
          'loadQuoteThumbnail: had trouble loading thumbnail data from disk',
          error && error.stack ? error.stack : error
        );
        return false;
      }
    },
    async processQuotes(messages) {
      const lookup = this.makeMessagesLookup(messages);

      const promises = messages.map(async (message) => {
        const { quote } = message.attributes;
        if (!quote) {
          return;
        }

        // If we already have a quoted message, then we exit early. If we don't have it,
        //   then we'll continue to look again for an in-memory message to use. Why? This
        //   will enable us to scroll to it when the user clicks.
        if (message.quotedMessage) {
          return;
        }

        // 1. Load provided thumbnail
        const gotThumbnail = await this.loadQuoteThumbnail(message, quote);

        // 2. Check to see if we've already loaded the target message into memory
        const { author, id } = quote;
        const key = this.makeKey(author, id);
        const quotedMessage = lookup[key];

        if (quotedMessage) {
          await this.loadQuotedMessage(message, quotedMessage);
          this.forceRender(message);
          return;
        }

        // We only go further if we need more data for this message. It's always important
        //   to grab the quoted message to allow for navigating to it by clicking.
        const { attachments } = quote;
        if (!this.needData(attachments)) {
          return;
        }

        // We've don't want to go to the database or load thumbnails a second time.
        if (message.quoteIsProcessed || gotThumbnail) {
          return;
        }
        // eslint-disable-next-line no-param-reassign
        message.quoteIsProcessed = true;

        // 3. As a last resort, go to the database to generate a thumbnail on-demand
        const loaded = await this.loadQuotedMessageFromDatabase(message, id);
        if (loaded) {
          this.forceRender(message);
        }
      });

      return Promise.all(promises);
    },

    async fetchMessages() {
      if (!this.id) {
        throw new Error('This conversation has no id!');
      }

      await this.messageCollection.fetchConversation(
        this.id,
        null,
        this.get('unreadCount')
      );

      // We kick this process off, but don't wait for it. If async updates happen on a
      //   given Message, 'change' will be triggered
      this.processQuotes(this.messageCollection);
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
        ConversationController.getOrCreateAndWait(number, 'private'));

      return Promise.all(promises).then((contacts) => {
        _.forEach(contacts, (contact) => {
          this.listenTo(contact, 'change:verified', this.onMemberVerifiedChange);
        });

        this.contactCollection.reset(contacts);
      });
    },

    destroyMessages() {
      this.messageCollection.fetch({
        index: {
          // 'conversation' index on [conversationId, received_at]
          name: 'conversation',
          lower: [this.id],
          upper: [this.id, Number.MAX_VALUE],
        },
      }).then(() => {
        const { models } = this.messageCollection;
        this.messageCollection.reset([]);
        _.each(models, (message) => {
          message.destroy();
        });
        this.save({
          lastMessage: null,
          timestamp: null,
          active_at: null,
        });
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
        this.avatarUrl = URL.createObjectURL(new Blob(
          [avatar.data],
          { type: avatar.contentType }
        ));
      } else {
        this.avatarUrl = null;
      }
      if (!silent) {
        this.trigger('change');
      }
    },
    getColor() {
      const title = this.get('name');
      let color = this.get('color');
      if (!color) {
        if (this.isPrivate()) {
          if (title) {
            color = COLORS[Math.abs(this.hashCode()) % 15];
          } else {
            color = 'grey';
          }
        } else {
          color = 'default';
        }
      }
      return color;
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
      return new Promise((resolve) => {
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

      return ConversationController.getOrCreateAndWait(message.get('source'), 'private')
        .then(sender => sender.getNotificationIcon().then((iconUrl) => {
          console.log('adding notification');
          Whisper.Notifications.add({
            title: sender.getTitle(),
            message: message.getNotificationText(),
            iconUrl,
            imageUrl: message.getImageUrl(),
            conversationId,
            messageId: message.id,
          });
        }));
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
          hash = ((hash << 5) - hash) + string.charCodeAt(i);
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
      return Promise.all(this.models.map(m => new Promise((resolve, reject) => {
        m.destroy().then(resolve).fail(reject);
      })));
    },

    search(providedQuery) {
      let query = providedQuery.trim().toLowerCase();
      if (query.length > 0) {
        query = query.replace(/[-.()]*/g, '').replace(/^\+(\d*)$/, '$1');
        const lastCharCode = query.charCodeAt(query.length - 1);
        const nextChar = String.fromCharCode(lastCharCode + 1);
        const upper = query.slice(0, -1) + nextChar;
        return new Promise((resolve) => {
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
      return new Promise((resolve) => {
        this.fetch({
          index: {
            name: 'search', // 'search' index on tokens array
          },
          limit: 100,
        }).always(resolve);
      });
    },

    fetchGroups(number) {
      return new Promise((resolve) => {
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
      return new Promise((resolve) => {
        this.fetch({
          index: {
            name: 'group',
            only: number,
          },
        }).always(resolve);
      });
    },
  });
}());
