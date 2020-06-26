/* global
  _,
  i18n,
  Backbone,
  libphonenumber,
  ConversationController,
  MessageController,
  libsignal,
  storage,
  textsecure,
  Whisper
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
  const { Conversation, Contact, Message } = window.Signal.Types;
  const {
    deleteAttachmentData,
    doesAttachmentExist,
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    readStickerData,
    upgradeMessageSchema,
    writeNewAttachmentData,
  } = window.Signal.Migrations;
  const { addStickerPackReference } = window.Signal.Data;

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
    'ultramarine',
  ];

  Whisper.Conversation = Backbone.Model.extend({
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

    initialize(attributes) {
      if (window.isValidE164(attributes.id)) {
        this.set({ id: window.getGuid(), e164: attributes.id });
      }

      this.ourNumber = textsecure.storage.user.getNumber();
      this.ourUuid = textsecure.storage.user.getUuid();
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
      this.debouncedUpdateLastMessage = _.debounce(
        this.updateLastMessage.bind(this),
        200
      );
      this.listenTo(
        this.messageCollection,
        'add remove destroy content-changed',
        this.debouncedUpdateLastMessage
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
      this.on('delivered', this.updateAndMerge);
      this.on('read', this.updateAndMerge);
      this.on('expiration-change', this.updateAndMerge);
      this.on('expired', this.onExpired);

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
      const e164 = this.get('e164');
      const uuid = this.get('uuid');
      return (
        (e164 && e164 === this.ourNumber) || (uuid && uuid === this.ourUuid)
      );
    },

    hasDraft() {
      const draftAttachments = this.get('draftAttachments') || [];
      return (
        this.get('draft') ||
        this.get('quotedMessageId') ||
        draftAttachments.length > 0
      );
    },

    getDraftPreview() {
      const draft = this.get('draft');
      if (draft) {
        return draft;
      }

      const draftAttachments = this.get('draftAttachments') || [];
      if (draftAttachments.length > 0) {
        return i18n('Conversation--getDraftPreview--attachment');
      }

      const quotedMessageId = this.get('quotedMessageId');
      if (quotedMessageId) {
        return i18n('Conversation--getDraftPreview--quote');
      }

      return i18n('Conversation--getDraftPreview--draft');
    },

    bumpTyping() {
      // We don't send typing messages if the setting is disabled
      if (!storage.get('typingIndicators')) {
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
      if (!textsecure.messaging) {
        return;
      }

      const groupId = !this.isPrivate() ? this.get('groupId') : null;
      const maybeRecipientId = this.get('uuid') || this.get('e164');
      const recipientId = this.isPrivate() ? maybeRecipientId : null;
      const groupNumbers = this.getRecipients();

      const sendOptions = this.getSendOptions();

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
    },

    async updateAndMerge(message) {
      this.debouncedUpdateLastMessage();

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
      this.debouncedUpdateLastMessage();

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
        existing.cleanup();
      };

      // If a fetch is in progress, then we need to wait until that's complete to
      //   do this removal. Otherwise we could remove from messageCollection, then
      //   the async database fetch could include the removed message.

      await this.inProgressFetch;
      removeMessage();
    },

    async onNewMessage(message) {
      // Clear typing indicator for a given contact if we receive a message from them
      const identifier = message.get
        ? `${message.get('source')}.${message.get('sourceDevice')}`
        : `${message.source}.${message.sourceDevice}`;
      this.clearContactTypingTimer(identifier);

      this.debouncedUpdateLastMessage();
    },

    // For outgoing messages, we can call this directly. We're already loaded.
    addSingleMessage(message) {
      const { id } = message;
      const existing = this.messageCollection.get(id);

      const model = this.messageCollection.add(message, { merge: true });
      model.setToExpire();

      if (!existing) {
        const { messagesAdded } = window.reduxActions.conversations;
        const isNewMessage = true;
        messagesAdded(
          this.id,
          [model.getReduxData()],
          isNewMessage,
          window.isActive()
        );
      }

      return model;
    },

    // For incoming messages, they might arrive while we're in the middle of a bulk fetch
    //   from the database. We'll wait until that is done to process this newly-arrived
    //   message.
    async addIncomingMessage(message) {
      await this.inProgressFetch;

      this.addSingleMessage(message);
    },

    format() {
      return this.cachedProps;
    },
    getProps() {
      const color = this.getColor();

      const typingValues = _.values(this.contactTypingTimers || {});
      const typingMostRecent = _.first(_.sortBy(typingValues, 'timestamp'));
      const typingContact = typingMostRecent
        ? ConversationController.getOrCreate(typingMostRecent.sender, 'private')
        : null;

      const timestamp = this.get('timestamp');
      const draftTimestamp = this.get('draftTimestamp');
      const draftPreview = this.getDraftPreview();
      const draftText = this.get('draft');
      const shouldShowDraft =
        this.hasDraft() && draftTimestamp && draftTimestamp >= timestamp;
      const inboxPosition = this.get('inbox_position');

      const result = {
        id: this.id,

        isArchived: this.get('isArchived'),
        activeAt: this.get('active_at'),
        avatarPath: this.getAvatarPath(),
        color,
        type: this.isPrivate() ? 'direct' : 'group',
        isMe: this.isMe(),
        typingContact: typingContact ? typingContact.format() : null,
        lastUpdated: this.get('timestamp'),
        name: this.getName(),
        profileName: this.getProfileName(),
        timestamp,
        inboxPosition,
        title: this.getTitle(),
        unreadCount: this.get('unreadCount') || 0,

        shouldShowDraft,
        draftPreview,
        draftText,

        phoneNumber: this.getNumber(),
        lastMessage: {
          status: this.get('lastMessageStatus'),
          text: this.get('lastMessage'),
          deletedForEveryone: this.get('lastMessageDeletedForEveryone'),
        },
      };

      return result;
    },

    updateE164(e164) {
      const oldValue = this.get('e164');
      if (e164 !== oldValue) {
        this.set('e164', e164);
        window.Signal.Data.updateConversation(this.attributes);
        this.trigger('idUpdated', this, 'e164', oldValue);
      }
    },
    updateUuid(uuid) {
      const oldValue = this.get('uuid');
      if (uuid !== oldValue) {
        this.set('uuid', uuid);
        window.Signal.Data.updateConversation(this.attributes);
        this.trigger('idUpdated', this, 'uuid', oldValue);
      }
    },
    updateGroupId(groupId) {
      const oldValue = this.get('groupId');
      if (groupId !== oldValue) {
        this.set('groupId', groupId);
        window.Signal.Data.updateConversation(this.attributes);
        this.trigger('idUpdated', this, 'groupId', oldValue);
      }
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

        if (this.get('verified') !== verified) {
          this.set({ verified });
          window.Signal.Data.updateConversation(this.attributes);
        }

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
      window.Signal.Data.updateConversation(this.attributes);

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
        await this.sendVerifySyncMessage(
          this.get('e164'),
          this.get('uuid'),
          verified
        );
      }
    },
    sendVerifySyncMessage(e164, uuid, state) {
      // Because syncVerification sends a (null) message to the target of the verify and
      //   a sync message to our own devices, we need to send the accessKeys down for both
      //   contacts. So we merge their sendOptions.
      const { sendOptions } = ConversationController.prepareForSend(
        this.ourNumber || this.ourUuid,
        { syncMessage: true }
      );
      const contactSendOptions = this.getSendOptions();
      const options = Object.assign({}, sendOptions, contactSendOptions);

      const promise = textsecure.storage.protocol.loadIdentityKey(e164);
      return promise.then(key =>
        this.wrapSend(
          textsecure.messaging.syncVerification(e164, uuid, state, key, options)
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
      const model = MessageController.register(
        id,
        new Whisper.Message({
          ...message,
          id,
        })
      );

      this.trigger('newmessage', model);
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
      const model = MessageController.register(
        id,
        new Whisper.Message({
          ...message,
          id,
        })
      );

      this.trigger('newmessage', model);

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

    validate(attributes = this.attributes) {
      const required = ['type'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) {
        return `Conversation must have ${missing}`;
      }

      if (attributes.type !== 'private' && attributes.type !== 'group') {
        return `Invalid conversation type: ${attributes.type}`;
      }

      const atLeastOneOf = ['e164', 'uuid', 'groupId'];
      const hasAtLeastOneOf =
        _.filter(atLeastOneOf, attr => attributes[attr]).length > 0;

      if (!hasAtLeastOneOf) {
        return 'Missing one of e164, uuid, or groupId';
      }

      const error = this.validateNumber() || this.validateUuid();

      if (error) {
        return error;
      }

      return null;
    },

    validateNumber() {
      if (this.isPrivate() && this.get('e164')) {
        const regionCode = storage.get('regionCode');
        const number = libphonenumber.util.parseNumber(
          this.get('e164'),
          regionCode
        );
        if (number.isValidNumber) {
          this.set({ e164: number.e164 });
          return null;
        }

        return number.error || 'Invalid phone number';
      }

      return null;
    },

    validateUuid() {
      if (this.isPrivate() && this.get('uuid')) {
        if (window.isValidGuid(this.get('uuid'))) {
          return null;
        }

        return 'Invalid UUID';
      }

      return null;
    },

    queueJob(callback) {
      this.jobQueue = this.jobQueue || new window.PQueue({ concurrency: 1 });

      const taskWithTimeout = textsecure.createTaskWithTimeout(
        callback,
        `conversation ${this.idForLogging()}`
      );

      return this.jobQueue.add(taskWithTimeout);
    },

    getRecipients() {
      if (this.isPrivate()) {
        return [this.get('uuid') || this.get('e164')];
      }
      const me = ConversationController.getConversationId(
        textsecure.storage.user.getUuid() || textsecure.storage.user.getNumber()
      );
      return _.without(this.get('members'), me).map(memberId => {
        const c = ConversationController.get(memberId);
        return c.get('uuid') || c.get('e164');
      });
    },

    async getQuoteAttachment(attachments, preview, sticker) {
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

      if (sticker && sticker.data && sticker.data.path) {
        const { path, contentType } = sticker.data;

        return [
          {
            contentType,
            // Our protos library complains about this field being undefined, so we
            //   force it to null
            fileName: null,
            thumbnail: {
              ...(await loadAttachmentData(sticker.data)),
              objectUrl: getAbsoluteAttachmentPath(path),
            },
          },
        ];
      }

      return [];
    },

    async makeQuote(quotedMessage) {
      const { getName } = Contact;
      const contact = quotedMessage.getContact();
      const attachments = quotedMessage.get('attachments');
      const preview = quotedMessage.get('preview');
      const sticker = quotedMessage.get('sticker');

      const body = quotedMessage.get('body');
      const embeddedContact = quotedMessage.get('contact');
      const embeddedContactName =
        embeddedContact && embeddedContact.length > 0
          ? getName(embeddedContact[0])
          : '';

      return {
        author: contact.get('e164'),
        authorUuid: contact.get('uuid'),
        id: quotedMessage.get('sent_at'),
        text: body || embeddedContactName,
        attachments: quotedMessage.isTapToView()
          ? [{ contentType: 'image/jpeg', fileName: null }]
          : await this.getQuoteAttachment(attachments, preview, sticker),
      };
    },

    async sendStickerMessage(packId, stickerId) {
      const packData = window.Signal.Stickers.getStickerPack(packId);
      const stickerData = window.Signal.Stickers.getSticker(packId, stickerId);
      if (!stickerData || !packData) {
        window.log.warn(
          `Attempted to send nonexistent (${packId}, ${stickerId}) sticker!`
        );
        return;
      }

      const { key } = packData;
      const { path, width, height } = stickerData;
      const arrayBuffer = await readStickerData(path);

      const sticker = {
        packId,
        stickerId,
        packKey: key,
        data: {
          size: arrayBuffer.byteLength,
          data: arrayBuffer,
          contentType: 'image/webp',
          width,
          height,
        },
      };

      this.sendMessage(null, [], null, [], sticker);
      window.reduxActions.stickers.useSticker(packId, stickerId);
    },

    /**
     * Sends a reaction message
     * @param {object} reaction - The reaction to send
     * @param {string} reaction.emoji - The emoji to react with
     * @param {boolean} [reaction.remove] - Set to `true` if we are removing a
     *   reaction with the given emoji
     * @param {object} target - The target of the reaction
     * @param {string} [target.targetAuthorE164] - The E164 address of the target
     *   message's author
     * @param {string} [target.targetAuthorUuid] - The UUID address of the target
     *   message's author
     * @param {number} target.targetTimestamp - The sent_at timestamp of the
     *   target message
     */
    async sendReactionMessage(reaction, target) {
      const timestamp = Date.now();
      const outgoingReaction = { ...reaction, ...target };
      const expireTimer = this.get('expireTimer');

      const reactionModel = Whisper.Reactions.add({
        ...outgoingReaction,
        fromId:
          this.ourNumber ||
          this.ourUuid ||
          textsecure.storage.user.getNumber() ||
          textsecure.storage.user.getUuid(),
        timestamp,
        fromSync: true,
      });
      Whisper.Reactions.onReaction(reactionModel);

      const destination = this.get('e164');
      const recipients = this.getRecipients();

      let profileKey;
      if (this.get('profileSharing')) {
        profileKey = storage.get('profileKey');
      }

      return this.queueJob(async () => {
        window.log.info(
          'Sending reaction to conversation',
          this.idForLogging(),
          'with timestamp',
          timestamp
        );

        const attributes = {
          id: window.getGuid(),
          type: 'outgoing',
          conversationId: this.get('id'),
          sent_at: timestamp,
          received_at: timestamp,
          recipients,
          reaction: outgoingReaction,
        };

        if (this.isPrivate()) {
          attributes.destination = destination;
        }

        // We are only creating this model so we can use its sync message
        // sending functionality. It will not be saved to the datbase.
        const message = new Whisper.Message(attributes);

        // We're offline!
        if (!textsecure.messaging) {
          throw new Error('Cannot send reaction while offline!');
        }

        // Special-case the self-send case - we send only a sync message
        if (this.isMe()) {
          const dataMessage = await textsecure.messaging.getMessageProto(
            destination,
            null,
            null,
            null,
            null,
            null,
            outgoingReaction,
            timestamp,
            expireTimer,
            profileKey
          );
          return message.sendSyncMessageOnly(dataMessage);
        }

        const options = this.getSendOptions();

        const promise = (() => {
          if (this.isPrivate()) {
            return textsecure.messaging.sendMessageToIdentifier(
              destination,
              null,
              null,
              null,
              null,
              null,
              outgoingReaction,
              timestamp,
              expireTimer,
              profileKey,
              options
            );
          }

          return textsecure.messaging.sendMessageToGroup(
            this.get('groupId'),
            this.getRecipients(),
            null,
            null,
            null,
            null,
            null,
            outgoingReaction,
            timestamp,
            expireTimer,
            profileKey,
            options
          );
        })();

        return message.send(this.wrapSend(promise));
      }).catch(error => {
        window.log.error('Error sending reaction', reaction, target, error);

        const reverseReaction = reactionModel.clone();
        reverseReaction.set('remove', !reverseReaction.get('remove'));
        Whisper.Reactions.onReaction(reverseReaction);

        throw error;
      });
    },

    sendMessage(body, attachments, quote, preview, sticker) {
      this.clearTypingTimers();

      const { clearUnreadMetrics } = window.reduxActions.conversations;
      clearUnreadMetrics(this.id);

      const destination = this.get('uuid') || this.get('e164');
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

        // Here we move attachments to disk
        const messageWithSchema = await upgradeMessageSchema({
          type: 'outgoing',
          body,
          conversationId: this.id,
          quote,
          preview,
          attachments,
          sent_at: now,
          received_at: now,
          expireTimer,
          recipients,
          sticker,
        });

        if (this.isPrivate()) {
          messageWithSchema.destination = destination;
        }
        const attributes = {
          ...messageWithSchema,
          id: window.getGuid(),
        };

        const model = this.addSingleMessage(attributes);
        if (sticker) {
          await addStickerPackReference(model.id, sticker.packId);
        }
        const message = MessageController.register(model.id, model);
        await window.Signal.Data.saveMessage(message.attributes, {
          forceSave: true,
          Message: Whisper.Message,
        });

        this.set({
          lastMessage: model.getNotificationText(),
          lastMessageStatus: 'sending',
          active_at: now,
          timestamp: now,
          isArchived: false,
          draft: null,
          draftTimestamp: null,
        });
        window.Signal.Data.updateConversation(this.attributes);

        // We're offline!
        if (!textsecure.messaging) {
          const errors = (this.contactCollection.length
            ? this.contactCollection
            : [this]
          ).map(contact => {
            const error = new Error('Network is not available');
            error.name = 'SendMessageNetworkError';
            error.identifier = contact.get('uuid') || contact.get('e164');
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
            sticker,
            null,
            now,
            expireTimer,
            profileKey
          );
          return message.sendSyncMessageOnly(dataMessage);
        }

        const conversationType = this.get('type');
        const options = this.getSendOptions();

        const promise = (() => {
          switch (conversationType) {
            case Message.PRIVATE:
              return textsecure.messaging.sendMessageToIdentifier(
                destination,
                messageBody,
                finalAttachments,
                quote,
                preview,
                sticker,
                null,
                now,
                expireTimer,
                profileKey,
                options
              );
            case Message.GROUP:
              return textsecure.messaging.sendMessageToGroup(
                this.get('groupId'),
                this.getRecipients(),
                messageBody,
                finalAttachments,
                quote,
                preview,
                sticker,
                null,
                now,
                expireTimer,
                profileKey,
                options
              );
            default:
              throw new TypeError(
                `Invalid conversation type: '${conversationType}'`
              );
          }
        })();

        return message.send(this.wrapSend(promise));
      });
    },

    wrapSend(promise) {
      return promise.then(
        async result => {
          // success
          if (result) {
            await this.handleMessageSendResult(
              result.failoverIdentifiers,
              result.unidentifiedDeliveries
            );
          }
          return result;
        },
        async result => {
          // failure
          if (result) {
            await this.handleMessageSendResult(
              result.failoverIdentifiers,
              result.unidentifiedDeliveries
            );
          }
          throw result;
        }
      );
    },

    async handleMessageSendResult(failoverIdentifiers, unidentifiedDeliveries) {
      await Promise.all(
        (failoverIdentifiers || []).map(async number => {
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
            window.Signal.Data.updateConversation(conversation.attributes);
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
            window.Signal.Data.updateConversation(conversation.attributes);
          }
        })
      );
    },

    getSendOptions(options = {}) {
      const senderCertificate = storage.get('senderCertificate');
      const sendMetadata = this.getSendMetadata(options);

      return {
        senderCertificate,
        sendMetadata,
      };
    },

    getUuidCapable() {
      return Boolean(_.property('uuid')(this.get('capabilities')));
    },

    getSendMetadata(options = {}) {
      const { syncMessage, disableMeCheck } = options;

      if (!this.ourNumber && !this.ourUuid) {
        return null;
      }

      // START: this code has an Expiration date of ~2018/11/21
      // We don't want to enable unidentified delivery for send unless it is
      //   also enabled for our own account.
      const me = ConversationController.getOrCreate(
        this.ourNumber || this.ourUuid,
        'private'
      );
      if (
        !disableMeCheck &&
        me.get('sealedSender') === SEALED_SENDER.DISABLED
      ) {
        return null;
      }
      // END

      if (!this.isPrivate()) {
        const infoArray = this.contactCollection.map(conversation =>
          conversation.getSendMetadata(options)
        );
        return Object.assign({}, ...infoArray);
      }

      const accessKey = this.get('accessKey');
      const sealedSender = this.get('sealedSender');
      const uuidCapable = this.getUuidCapable();

      // We never send sync messages as sealed sender
      if (syncMessage && this.isMe()) {
        return null;
      }

      const e164 = this.get('e164');
      const uuid = this.get('uuid');

      // If we've never fetched user's profile, we default to what we have
      if (sealedSender === SEALED_SENDER.UNKNOWN) {
        const info = {
          accessKey:
            accessKey ||
            window.Signal.Crypto.arrayBufferToBase64(
              window.Signal.Crypto.getRandomBytes(16)
            ),
          // Indicates that a client is capable of receiving uuid-only messages.
          // Not used yet.
          uuidCapable,
        };
        return {
          ...(e164 ? { [e164]: info } : {}),
          ...(uuid ? { [uuid]: info } : {}),
        };
      }

      if (sealedSender === SEALED_SENDER.DISABLED) {
        return null;
      }

      const info = {
        accessKey:
          accessKey && sealedSender === SEALED_SENDER.ENABLED
            ? accessKey
            : window.Signal.Crypto.arrayBufferToBase64(
                window.Signal.Crypto.getRandomBytes(16)
              ),
        // Indicates that a client is capable of receiving uuid-only messages.
        // Not used yet.
        uuidCapable,
      };

      return {
        ...(e164 ? { [e164]: info } : {}),
        ...(uuid ? { [uuid]: info } : {}),
      };
    },

    async updateLastMessage() {
      if (!this.id) {
        return;
      }

      const messages = await window.Signal.Data.getOlderMessagesByConversation(
        this.id,
        { limit: 1, MessageCollection: Whisper.MessageCollection }
      );

      const lastMessageModel = messages.at(0);
      if (
        this.hasDraft() &&
        this.get('draftTimestamp') &&
        (!lastMessageModel ||
          lastMessageModel.get('sent_at') < this.get('draftTimestamp'))
      ) {
        return;
      }

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
        window.Signal.Data.updateConversation(this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },

    async setArchived(isArchived) {
      this.set({ isArchived });
      window.Signal.Data.updateConversation(this.attributes);
    },

    async updateExpirationTimer(
      providedExpireTimer,
      providedSource,
      receivedAt,
      options = {}
    ) {
      let expireTimer = providedExpireTimer;
      let source = providedSource;
      if (this.get('left')) {
        return false;
      }

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

      source =
        source ||
        textsecure.storage.user.getNumber() ||
        textsecure.storage.user.getUuid();

      // When we add a disappearing messages notification to the conversation, we want it
      //   to be above the message that initiated that change, hence the subtraction.
      const timestamp = (receivedAt || Date.now()) - 1;

      this.set({ expireTimer });
      window.Signal.Data.updateConversation(this.attributes);

      const model = new Whisper.Message({
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
        model.set({ destination: this.get('uuid') || this.get('e164') });
      }
      if (model.isOutgoing()) {
        model.set({ recipients: this.getRecipients() });
      }
      const id = await window.Signal.Data.saveMessage(model.attributes, {
        Message: Whisper.Message,
      });

      model.set({ id });

      const message = MessageController.register(id, model);
      this.addSingleMessage(message);

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
          this.get('uuid') || this.get('e164'),
          null,
          [],
          null,
          [],
          null,
          null,
          message.get('sent_at'),
          expireTimer,
          profileKey,
          flags
        );
        return message.sendSyncMessageOnly(dataMessage);
      }

      if (this.get('type') === 'private') {
        promise = textsecure.messaging.sendExpirationTimerUpdateToIdentifier(
          this.get('uuid') || this.get('e164'),
          expireTimer,
          message.get('sent_at'),
          profileKey,
          sendOptions
        );
      } else {
        promise = textsecure.messaging.sendExpirationTimerUpdateToGroup(
          this.get('groupId'),
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

    async addMessageHistoryDisclaimer() {
      const lastMessage = this.messageCollection.last();
      if (
        lastMessage &&
        lastMessage.get('type') === 'message-history-unsynced'
      ) {
        // We do not need another message history disclaimer
        return lastMessage;
      }

      const timestamp = Date.now();

      const model = new Whisper.Message({
        type: 'message-history-unsynced',
        // Even though this isn't reflected to the user, we want to place the last seen
        //   indicator above it. We set it to 'unread' to trigger that placement.
        unread: 1,
        conversationId: this.id,
        // No type; 'incoming' messages are specially treated by conversation.markRead()
        sent_at: timestamp,
        received_at: timestamp,
      });

      if (this.isPrivate()) {
        model.set({ destination: this.id });
      }
      if (model.isOutgoing()) {
        model.set({ recipients: this.getRecipients() });
      }
      const id = await window.Signal.Data.saveMessage(model.attributes, {
        Message: Whisper.Message,
      });

      model.set({ id });

      const message = MessageController.register(id, model);
      this.addSingleMessage(message);

      return message;
    },

    isSearchable() {
      return !this.get('left');
    },

    async endSession() {
      if (this.isPrivate()) {
        const now = Date.now();
        const model = new Whisper.Message({
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
          destination: this.get('e164'),
          destinationUuid: this.get('uuid'),
          recipients: this.getRecipients(),
          flags: textsecure.protobuf.DataMessage.Flags.END_SESSION,
        });

        const id = await window.Signal.Data.saveMessage(model.attributes, {
          Message: Whisper.Message,
        });
        model.set({ id });

        const message = MessageController.register(model.id, model);
        this.addSingleMessage(message);

        const options = this.getSendOptions();
        message.send(
          this.wrapSend(
            textsecure.messaging.resetSession(
              this.get('uuid'),
              this.get('e164'),
              now,
              options
            )
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
      const model = new Whisper.Message({
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: now,
        group_update: groupUpdate,
      });

      const id = await window.Signal.Data.saveMessage(model.attributes, {
        Message: Whisper.Message,
      });

      model.set({ id });

      const message = MessageController.register(model.id, model);
      this.addSingleMessage(message);

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
        const groupNumbers = this.getRecipients();
        this.set({ left: true });
        window.Signal.Data.updateConversation(this.attributes);

        const model = new Whisper.Message({
          group_update: { left: 'You' },
          conversationId: this.id,
          type: 'outgoing',
          sent_at: now,
          received_at: now,
        });

        const id = await window.Signal.Data.saveMessage(model.attributes, {
          Message: Whisper.Message,
        });
        model.set({ id });

        const message = MessageController.register(model.id, model);
        this.addSingleMessage(message);

        const options = this.getSendOptions();
        message.send(
          this.wrapSend(
            textsecure.messaging.leaveGroup(this.id, groupNumbers, options)
          )
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
          const m = MessageController.register(providedM.id, providedM);

          // Note that this will update the message in the database
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
      window.Signal.Data.updateConversation(this.attributes);

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
          this.ourUuid || this.ourNumber,
          { syncMessage: true }
        );
        await this.wrapSend(
          textsecure.messaging.syncReadMessages(read, sendOptions)
        );

        if (storage.get('read-receipt-setting')) {
          const convoSendOptions = this.getSendOptions();

          await Promise.all(
            _.map(_.groupBy(read, 'sender'), async (receipts, identifier) => {
              const timestamps = _.map(receipts, 'timestamp');
              const c = ConversationController.get(identifier);
              await this.wrapSend(
                textsecure.messaging.sendReadReceipts(
                  c.get('e164'),
                  c.get('uuid'),
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
        ids = [this.get('uuid') || this.get('e164')];
      } else {
        ids = this.get('members')
          .map(id => {
            const c = ConversationController.get(id);
            return c ? c.get('uuid') || c.get('e164') : null;
          })
          .filter(Boolean);
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
      const {
        generateProfileKeyCredentialRequest,
        getClientZkProfileOperations,
        handleProfileKeyCredential,
      } = Util.zkgroup;

      const clientZkProfileCipher = getClientZkProfileOperations(
        window.getServerPublicParams()
      );
      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so our hasChanged() check is useful.
      c.changed = {};

      let profile;

      try {
        await Promise.all([
          c.deriveAccessKeyIfNeeded(),
          c.deriveProfileKeyVersionIfNeeded(),
        ]);

        const profileKey = c.get('profileKey');
        const uuid = c.get('uuid');
        const profileKeyVersionHex = c.get('profileKeyVersion');
        const existingProfileKeyCredential = c.get('profileKeyCredential');

        const weHaveVersion = Boolean(
          profileKey && uuid && profileKeyVersionHex
        );
        let profileKeyCredentialRequestHex;
        let profileCredentialRequestContext;

        if (weHaveVersion && !existingProfileKeyCredential) {
          window.log.info('Generating request...');
          ({
            requestHex: profileKeyCredentialRequestHex,
            context: profileCredentialRequestContext,
          } = generateProfileKeyCredentialRequest(
            clientZkProfileCipher,
            uuid,
            profileKey
          ));
        }

        const sendMetadata = c.getSendMetadata({ disableMeCheck: true }) || {};
        const getInfo =
          sendMetadata[c.get('e164')] || sendMetadata[c.get('uuid')] || {};

        if (getInfo.accessKey) {
          try {
            profile = await textsecure.messaging.getProfile(id, {
              accessKey: getInfo.accessKey,
              profileKeyVersion: profileKeyVersionHex,
              profileKeyCredentialRequest: profileKeyCredentialRequestHex,
            });
          } catch (error) {
            if (error.code === 401 || error.code === 403) {
              window.log.info(
                `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
              );
              c.set({ sealedSender: SEALED_SENDER.DISABLED });
              profile = await textsecure.messaging.getProfile(id, {
                profileKeyVersion: profileKeyVersionHex,
                profileKeyCredentialRequest: profileKeyCredentialRequestHex,
              });
            } else {
              throw error;
            }
          }
        } else {
          profile = await textsecure.messaging.getProfile(id, {
            profileKeyVersion: profileKeyVersionHex,
            profileKeyCredentialRequest: profileKeyCredentialRequestHex,
          });
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

        if (profile.capabilities) {
          c.set({ capabilities: profile.capabilities });
        }
        if (profileCredentialRequestContext && profile.credential) {
          const profileKeyCredential = handleProfileKeyCredential(
            clientZkProfileCipher,
            profileCredentialRequestContext,
            profile.credential
          );
          c.set({ profileKeyCredential });
        }
      } catch (error) {
        if (error.code !== 403 && error.code !== 404) {
          window.log.warn(
            'getProfile failure:',
            id,
            error && error.stack ? error.stack : error
          );
        } else {
          await c.dropProfileKey();
        }
        return;
      }

      try {
        await c.setProfileName(profile.name);
      } catch (error) {
        window.log.warn(
          'getProfile decryption failure:',
          id,
          error && error.stack ? error.stack : error
        );
        await c.dropProfileKey();
      }

      try {
        await c.setProfileAvatar(profile.avatar);
      } catch (error) {
        if (error.code === 403 || error.code === 404) {
          window.log.info(
            `Clearing profile avatar for conversation ${c.idForLogging()}`
          );
          c.set({
            profileAvatar: null,
          });
        }
      }

      if (c.hasChanged()) {
        window.Signal.Data.updateConversation(c.attributes);
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
      const { given, family } = await textsecure.crypto.decryptProfileName(
        data,
        keyBuffer
      );

      // encode
      const profileName = window.Signal.Crypto.stringFromBytes(given);
      const profileFamilyName = family
        ? window.Signal.Crypto.stringFromBytes(family)
        : null;

      // set
      this.set({ profileName, profileFamilyName });
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
            doesAttachmentExist,
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
          profileKeyVersion: null,
          profileKeyCredential: null,
          accessKey: null,
          profileName: null,
          profileFamilyName: null,
          profileAvatar: null,
          sealedSender: SEALED_SENDER.UNKNOWN,
        });

        await Promise.all([
          this.deriveAccessKeyIfNeeded(),
          this.deriveProfileKeyVersionIfNeeded(),
        ]);

        window.Signal.Data.updateConversation(this.attributes, {
          Conversation: Whisper.Conversation,
        });
      }
    },
    async dropProfileKey() {
      if (this.get('profileKey')) {
        window.log.info(
          `Dropping profileKey, setting sealedSender to UNKNOWN for conversation ${this.idForLogging()}`
        );
        const profileAvatar = this.get('profileAvatar');
        if (profileAvatar && profileAvatar.path) {
          await deleteAttachmentData(profileAvatar.path);
        }

        this.set({
          profileKey: null,
          profileKeyVersion: null,
          profileKeyCredential: null,
          accessKey: null,
          profileName: null,
          profileFamilyName: null,
          profileAvatar: null,
          sealedSender: SEALED_SENDER.UNKNOWN,
        });

        window.Signal.Data.updateConversation(this.attributes);
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
    async deriveProfileKeyVersionIfNeeded() {
      const profileKey = this.get('profileKey');
      if (!profileKey) {
        return;
      }

      const uuid = this.get('uuid');
      if (!uuid || this.get('profileKeyVersion')) {
        return;
      }

      const profileKeyVersion = Util.zkgroup.deriveProfileKeyVersion(
        profileKey,
        uuid
      );

      this.set({ profileKeyVersion });
    },

    hasMember(identifier) {
      const cid = ConversationController.getConversationId(identifier);
      return cid && _.contains(this.get('members'), cid);
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
      this.messageCollection.reset([]);

      this.set({
        lastMessage: null,
        timestamp: null,
        active_at: null,
      });
      window.Signal.Data.updateConversation(this.attributes);

      await window.Signal.Data.removeAllMessagesInConversation(this.id, {
        MessageCollection: Whisper.MessageCollection,
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
        return this.get('name') || this.getNumber();
      }
      return this.get('name') || 'Unknown group';
    },

    getProfileName() {
      if (this.isPrivate()) {
        return Util.combineNames(
          this.get('profileName'),
          this.get('profileFamilyName')
        );
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
      const number = this.get('e164');
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
      const avatar = this.isMe()
        ? this.get('profileAvatar') || this.get('avatar')
        : this.get('avatar') || this.get('profileAvatar');

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
        return {
          color,
          content: this.getInitials(title) || '#',
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

    async notify(message, reaction) {
      if (!message.isIncoming() && !reaction) {
        return;
      }

      const conversationId = this.id;

      const sender = await ConversationController.getOrCreateAndWait(
        reaction ? reaction.get('fromId') : message.get('source'),
        'private'
      );

      const iconUrl = await sender.getNotificationIcon();

      const messageJSON = message.toJSON();
      const messageSentAt = messageJSON.sent_at;
      const messageId = message.id;
      const isExpiringMessage = Message.hasExpiration(messageJSON);

      Whisper.Notifications.add({
        conversationId,
        iconUrl,
        isExpiringMessage,
        message: message.getNotificationText(),
        messageId,
        messageSentAt,
        title: sender.getTitle(),
        reaction: reaction ? reaction.toJSON() : null,
      });
    },

    notifyTyping(options = {}) {
      const { isTyping, sender, senderUuid, senderDevice } = options;

      // We don't do anything with typing messages from our other devices
      if (sender === this.ourNumber || senderUuid === this.ourUuid) {
        return;
      }

      const identifier = `${sender}.${senderDevice}`;

      this.contactTypingTimers = this.contactTypingTimers || {};
      const record = this.contactTypingTimers[identifier];

      if (record) {
        clearTimeout(record.timer);
      }

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
          this.trigger('change', this);
        }
      } else {
        delete this.contactTypingTimers[identifier];
        if (record) {
          // User was previously typing, and is no longer. State change!
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
        this.trigger('change', this);
      }
    },
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    model: Whisper.Conversation,

    /**
     * Backbone defines a `_byId` field. Here we set up additional `_byE164`,
     * `_byUuid`, and `_byGroupId` fields so we can track conversations by more
     * than just their id.
     */
    initialize() {
      this._byE164 = {};
      this._byUuid = {};
      this._byGroupId = {};
      this.on('idUpdated', (model, idProp, oldValue) => {
        if (oldValue) {
          if (idProp === 'e164') {
            delete this._byE164[oldValue];
          }
          if (idProp === 'uuid') {
            delete this._byUuid[oldValue];
          }
          if (idProp === 'groupId') {
            delete this._byGroupid[oldValue];
          }
        }
        if (model.get('e164')) {
          this._byE164[model.get('e164')] = model;
        }
        if (model.get('uuid')) {
          this._byUuid[model.get('uuid')] = model;
        }
        if (model.get('groupId')) {
          this._byGroupid[model.get('groupId')] = model;
        }
      });
    },

    reset(...args) {
      Backbone.Collection.prototype.reset.apply(this, args);
      this._byE164 = {};
      this._byUuid = {};
      this._byGroupId = {};
    },

    add(...models) {
      const res = Backbone.Collection.prototype.add.apply(this, models);
      [].concat(res).forEach(model => {
        const e164 = model.get('e164');
        if (e164) {
          this._byE164[e164] = model;
        }

        const uuid = model.get('uuid');
        if (uuid) {
          this._byUuid[uuid] = model;
        }

        const groupId = model.get('groupId');
        if (groupId) {
          this._byGroupId[groupId] = model;
        }
      });
      return res;
    },

    /**
     * Backbone collections have a `_byId` field that `get` defers to. Here, we
     * override `get` to first access our custom `_byE164`, `_byUuid`, and
     * `_byGroupId` functions, followed by falling back to the original
     * Backbone implementation.
     */
    get(id) {
      return (
        this._byE164[id] ||
        this._byE164[`+${id}`] ||
        this._byUuid[id] ||
        this._byGroupId[id] ||
        Backbone.Collection.prototype.get.call(this, id)
      );
    },

    comparator(m) {
      return -m.get('timestamp');
    },
  });

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');
})();
