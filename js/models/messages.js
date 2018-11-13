/* global _: false */
/* global Backbone: false */
/* global storage: false */
/* global filesize: false */
/* global ConversationController: false */
/* global getAccountManager: false */
/* global i18n: false */
/* global Signal: false */
/* global textsecure: false */
/* global Whisper: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { Message: TypedMessage, Contact, PhoneNumber } = Signal.Types;
  const {
    deleteAttachmentData,
    deleteExternalMessageFiles,
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    loadQuoteData,
    writeNewAttachmentData,
  } = window.Signal.Migrations;

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
    getDescription() {
      if (this.isGroupUpdate()) {
        const groupUpdate = this.get('group_update');
        if (groupUpdate.left === 'You') {
          return i18n('youLeftTheGroup');
        } else if (groupUpdate.left) {
          return i18n('leftTheGroup', this.getNameForNumber(groupUpdate.left));
        }

        const messages = [];
        if (!groupUpdate.name && !groupUpdate.joined) {
          messages.push(i18n('updatedTheGroup'));
        }
        if (groupUpdate.name) {
          messages.push(i18n('titleIsNow', groupUpdate.name));
        }
        if (groupUpdate.joined && groupUpdate.joined.length) {
          const names = _.map(
            groupUpdate.joined,
            this.getNameForNumber.bind(this)
          );
          if (names.length > 1) {
            messages.push(i18n('multipleJoinedTheGroup', names.join(', ')));
          } else {
            messages.push(i18n('joinedTheGroup', names[0]));
          }
        }

        return messages.join(', ');
      }
      if (this.isEndSession()) {
        return i18n('sessionEnded');
      }
      if (this.isIncoming() && this.hasErrors()) {
        return i18n('incomingError');
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
    getNotificationText() {
      const description = this.getDescription();
      if (description) {
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
      const { expireTimer, fromSync, source } = this.get(
        'expirationTimerUpdate'
      );
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
      // It doesn't need anything right now!
      return {};
    },
    getPropsForFriendRequest() {
      const source = this.get('from');
      const target = this.get('to');
      const status = this.get('status') || 'pending';
      const type = this.get('requestType') || 'incoming';
      const conversation = this.getConversation();

      // I.e do we send a network request from the model? or call a function in the conversation to send the new status
      const onAccept = async () => {
        this.set({ status: 'accepted' });
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });

        window.Whisper.events.trigger('friendRequestUpdated', {
          pubKey: conversation.id,
          ...this.attributes,
        });
      };

      const onDecline = async () => {
        this.set({ status: 'declined' });
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });

        window.Whisper.events.trigger('friendRequestUpdated', {
          pubKey: conversation.id,
          ...this.attributes,
        });
      };

      const onDelete = async () => {
        window.Whisper.events.trigger('deleteConversation', conversation);
      };

      return {
        text: this.createNonBreakingLastSeparator(this.get('body')),
        source: this.findAndFormatContact(source),
        target: this.findAndFormatContact(target),
        status,
        type,
        onAccept,
        onDecline,
        onDelete,
      }
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
      if (!this.isOutgoing()) {
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

      return 'sending';
    },
    getPropsForMessage() {
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

      const conversation = this.getConversation();
      const isGroup = conversation && !conversation.isPrivate();

      const attachments = this.get('attachments');
      const firstAttachment = attachments && attachments[0];

      return {
        text: this.createNonBreakingLastSeparator(this.get('body')),
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
        attachment: this.getPropsForAttachment(firstAttachment),
        quote: this.getPropsForQuote(),
        authorAvatarPath,
        isExpired: this.hasExpired,
        expirationLength,
        expirationTimestamp,
        onReply: () => this.trigger('reply', this),
        onRetrySend: () => this.retrySend(),
        onShowDetail: () => this.trigger('show-message-detail', this),
        onDelete: () => this.trigger('delete', this),
        onClickAttachment: () =>
          this.trigger('show-lightbox', {
            attachment: firstAttachment,
            message: this,
          }),

        onDownload: isDangerous =>
          this.trigger('download', {
            attachment: firstAttachment,
            message: this,
            isDangerous,
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
        const newSpaces = _.reduce(
          spaces,
          accumulator => accumulator + nbsp,
          ''
        );
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
          this.trigger('change');
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
    getPropsForQuote() {
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
      const onClick = () => {
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

      const { path, flags, size, screenshot, thumbnail } = attachment;

      return {
        ...attachment,
        fileSize: size ? filesize(size) : null,
        isVoiceMessage:
          flags &&
          // eslint-disable-next-line no-bitwise
          flags & textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
        url: getAbsoluteAttachmentPath(path),
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

      // Older messages don't have the recipients included on the message, so we fall
      //   back to the conversation's current recipients
      const phoneNumbers = this.isIncoming()
        ? [this.get('source')]
        : this.get('recipients') || this.conversation.getRecipients();

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
      const finalContacts = (phoneNumbers || []).map(id => {
        const errorsForContact = errorsGroupedById[id];
        const isOutgoingKeyError = Boolean(
          _.find(errorsForContact, error => error.name === OUTGOING_KEY_ERROR)
        );
        const isUnidentifiedDelivery =
          storage.get('unidentifiedDeliveryIndicators') &&
          this.isUnidentifiedDelivery(id, unidentifiedLookup);

        return {
          ...this.findAndFormatContact(id),
          status: this.getStatus(id),
          errors: errorsForContact,
          isOutgoingKeyError,
          isUnidentifiedDelivery,
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
        contact => `${contact.errors ? '0' : '1'}${contact.title}`
      );

      return {
        sentAt: this.get('sent_at'),
        receivedAt: this.get('received_at'),
        message: {
          ...this.getPropsForMessage(),
          disableMenu: true,
          // To ensure that group avatar doesn't show up
          conversationType: 'direct',
        },
        errors,
        contacts: sortedContacts,
      };
    },

    // One caller today: event handler for the 'Retry Send' entry in triple-dot menu
    async retrySend() {
      if (!textsecure.messaging) {
        window.log.error('retrySend: Cannot retry since we are offline!');
        return null;
      }

      const [retries, errors] = _.partition(
        this.get('errors'),
        this.isReplayableError.bind(this)
      );

      // Remove the errors that aren't replayable
      this.set({ errors });

      const profileKey = null;
      const numbers = retries.map(retry => retry.number);

      if (!numbers.length) {
        window.log.error(
          'retrySend: Attempted to retry, but no numbers to send to!'
        );
        return null;
      }

      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const quoteWithData = await loadQuoteData(this.get('quote'));

      const conversation = this.getConversation();
      const options = conversation.getSendOptions();

      let promise;

      if (conversation.isPrivate()) {
        const [number] = numbers;
        promise = textsecure.messaging.sendMessageToNumber(
          number,
          this.get('body'),
          attachmentsWithData,
          quoteWithData,
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
            recipients: numbers,
            body: this.get('body'),
            timestamp: this.get('sent_at'),
            attachments: attachmentsWithData,
            quote: quoteWithData,
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
        e.name === 'OutgoingIdentityKeyError'
      );
    },

    // Called when the user ran into an error with a specific user, wants to send to them
    //   One caller today: ConversationView.forceSend()
    async resend(number) {
      const error = this.removeOutgoingErrors(number);
      if (error) {
        const profileKey = null;
        const attachmentsWithData = await Promise.all(
          (this.get('attachments') || []).map(loadAttachmentData)
        );
        const quoteWithData = await loadQuoteData(this.get('quote'));

        const { wrap, sendOptions } = ConversationController.prepareForSend(
          number
        );
        const promise = textsecure.messaging.sendMessageToNumber(
          number,
          this.get('body'),
          attachmentsWithData,
          quoteWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          sendOptions
        );

        this.send(wrap(promise));
      }
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
      return ConversationController.getOrCreate(this.getSource(), 'private');
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

    send(promise) {
      this.trigger('pending');
      return promise
        .then(async result => {
          this.trigger('done');

          // This is used by sendSyncMessage, then set to null
          if (result.dataMessage) {
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
          this.sendSyncMessage();
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

    sendSyncMessage() {
      const ourNumber = textsecure.storage.user.getNumber();
      const { wrap, sendOptions } = ConversationController.prepareForSend(
        ourNumber,
        { syncMessage: true }
      );

      this.syncPromise = this.syncPromise || Promise.resolve();
      this.syncPromise = this.syncPromise.then(() => {
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
        ).then(() => {
          this.set({
            synced: true,
            dataMessage: null,
          });
          return window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });
        });
      });
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
    handleDataMessage(dataMessage, confirm) {
      // This function is called from the background script in a few scenarios:
      //   1. on an incoming message
      //   2. on a sent message sync'd from another device
      //   3. in rare cases, an incoming message can be retried, though it will
      //      still go through one of the previous two codepaths
      const message = this;
      const source = message.get('source');
      const type = message.get('type');
      let conversationId = message.get('conversationId');
      if (dataMessage.group) {
        conversationId = dataMessage.group.id;
      }
      const GROUP_TYPES = textsecure.protobuf.GroupContext.Type;

      const conversation = ConversationController.get(conversationId);
      return conversation.queueJob(async () => {
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
                members: _.union(
                  dataMessage.group.members,
                  conversation.get('members')
                ),
              };

              // Update this group conversations's avatar on disk if it has changed.
              if (dataMessage.group.avatar) {
                attributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
                  attributes,
                  dataMessage.group.avatar.data,
                  {
                    writeNewAttachmentData,
                    deleteAttachmentData,
                  }
                );
              }

              groupUpdate =
                conversation.changedAttributes(
                  _.pick(dataMessage.group, 'name', 'avatar')
                ) || {};

              const difference = _.difference(
                attributes.members,
                conversation.get('members')
              );
              if (difference.length > 0) {
                groupUpdate.joined = difference;
              }
              if (conversation.get('left')) {
                window.log.warn('re-added to a left group');
                attributes.left = false;
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
            schemaVersion: dataMessage.schemaVersion,
          });
          if (type === 'outgoing') {
            const receipts = Whisper.DeliveryReceipts.forMessage(
              conversation,
              message
            );
            receipts.forEach(() =>
              message.set({
                delivered: (message.get('delivered') || 0) + 1,
              })
            );
          }
          attributes.active_at = now;
          conversation.set(attributes);

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
          }
          if (type === 'incoming') {
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
              conversation.set(
                'unreadCount',
                conversation.get('unreadCount') + 1
              );
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

          if (dataMessage.profileKey) {
            const profileKey = dataMessage.profileKey.toString('base64');
            if (source === textsecure.storage.user.getNumber()) {
              conversation.set({ profileSharing: true });
            } else if (conversation.isPrivate()) {
              conversation.setProfileKey(profileKey);
            } else {
              ConversationController.getOrCreateAndWait(source, 'private').then(
                sender => {
                  sender.setProfileKey(profileKey);
                }
              );
            }
          }

          const id = await window.Signal.Data.saveMessage(message.attributes, {
            Message: Whisper.Message,
          });
          message.set({ id });

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
            await conversation.notify(message);
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

  Whisper.Message.refreshExpirationTimer = () =>
    Whisper.ExpiringMessagesListener.update();

  Whisper.MessageCollection = Backbone.Collection.extend({
    model: Whisper.Message,
    comparator(left, right) {
      if (left.get('received_at') === right.get('received_at')) {
        return (left.get('sent_at') || 0) - (right.get('sent_at') || 0);
      }

      return (left.get('received_at') || 0) - (right.get('received_at') || 0);
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

      const models = messages.filter(message => Boolean(message.id));
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
