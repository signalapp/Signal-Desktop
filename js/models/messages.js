/* global
  _,
  Backbone,
  storage,
  filesize,
  ConversationController,
  MessageController,
  i18n,
  Signal,
  textsecure,
  Whisper,
  clipboard,
  libsession
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { Message: TypedMessage, Contact, PhoneNumber } = Signal.Types;

  const {
    deleteExternalMessageFiles,
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    loadQuoteData,
    loadPreviewData,
  } = window.Signal.Migrations;
  const { bytesFromString } = window.Signal.Crypto;

  window.AccountCache = Object.create(null);
  window.AccountJobs = Object.create(null);

  window.doesAcountCheckJobExist = number =>
    Boolean(window.AccountJobs[number]);

  window.isSignalAccountCheckComplete = number =>
    window.AccountCache[number] !== undefined;
  window.hasSignalAccount = () => true;

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
        } else if (this.isGroupInvitation()) {
          this.propsForGroupInvitation = this.getPropsForGroupInvitation();
        } else {
          this.propsForSearchResult = this.getPropsForSearchResult();
          this.propsForMessage = this.getPropsForMessage();
        }
      };
      const triggerChange = () => this.trigger('change');

      this.on('change', generateProps);

      const applicableConversationChanges =
        'change:color change:name change:number change:profileName change:profileAvatar';

      const conversation = this.getConversation();
      const fromContact = this.getIncomingContact();
      this.listenTo(conversation, applicableConversationChanges, generateProps);

      // trigger a change event on this component.
      // this will call generateProps and refresh the Message.tsx component with new props
      this.listenTo(conversation, 'disable:input', triggerChange);
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
      const endSessionFlag = textsecure.protobuf.DataMessage.Flags.END_SESSION;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & endSessionFlag);
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
      const expirationTimerFlag =
        textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & expirationTimerFlag);
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
      return conversation.getProfileName();
    },
    getLokiNameForNumber(number) {
      const conversation = ConversationController.get(number);
      if (number === textsecure.storage.user.getNumber()) {
        return i18n('you');
      }
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
        return messages.join(' ');
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
    isGroupInvitation() {
      return !!this.get('groupInvitation');
    },
    isSessionRestoration() {
      const sessionRestoreFlag =
        textsecure.protobuf.DataMessage.Flags.SESSION_RESTORE;
      /* eslint-disable no-bitwise */
      return (
        !!this.get('sessionRestoration') ||
        !!(this.get('flags') & sessionRestoreFlag)
      );
      /* eslint-enable no-bitwise */
    },
    getNotificationText() {
      let description = this.getDescription();
      if (description) {
        // regex with a 'g' to ignore part groups
        const regex = new RegExp(
          `@${window.libsession.Types.PubKey.regexForPubkeys}`,
          'g'
        );
        const pubkeysInDesc = description.match(regex);
        (pubkeysInDesc || []).forEach(pubkey => {
          const displayName = this.getLokiNameForNumber(pubkey.slice(1));
          if (displayName && displayName.length) {
            description = description.replace(pubkey, `@${displayName}`);
          }
        });
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
      let profileName;
      if (phoneNumber === window.storage.get('primaryDevicePubKey')) {
        profileName = i18n('you');
      } else {
        profileName = contactModel ? contactModel.getProfileName() : null;
      }

      return {
        phoneNumber: format(phoneNumber, {
          ourRegionCode: regionCode,
        }),
        color: null,
        avatarPath: contactModel ? contactModel.getAvatarPath() : null,
        name: contactModel ? contactModel.getName() : null,
        profileName,
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

      // Only return the status on outgoing messages
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
        serverTimestamp: this.get('serverTimestamp'),
        status: this.getMessagePropStatus(),
        contact: this.getPropsForEmbeddedContact(),
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
        isKickedFromGroup:
          conversation && conversation.get('isKickedFromGroup'),
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

        this.trigger('show-contact-detail', {
          contact,
          hasSignalAccount: window.hasSignalAccount(firstNumber),
        });
      };

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
    async getPropsForMessageDetail() {
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
      const finalContacts = await Promise.all(
        (phoneNumbers || []).map(async id => {
          const errorsForContact = errorsGroupedById[id];
          const isOutgoingKeyError = Boolean(
            _.find(errorsForContact, error => error.name === OUTGOING_KEY_ERROR)
          );
          const isUnidentifiedDelivery =
            storage.get('unidentifiedDeliveryIndicators') &&
            this.isUnidentifiedDelivery(id, unidentifiedLookup);
          const primary = await window.libsession.Protocols.MultiDeviceProtocol.getPrimaryDevice(
            id
          );

          const isPrimaryDevice = id === primary.key;

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
        })
      );

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
        title: i18n('copiedToClipboard'),
        type: 'success',
        id: 'copiedToClipboard',
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
        title: i18n('copiedToClipboard'),
        type: 'success',
        id: 'copiedToClipboard',
      });
    },

    /**
     * Uploads attachments, previews and quotes.
     * If body is too long then it is also converted to an attachment.
     *
     * @returns The uploaded data which includes: body, attachments, preview and quote.
     */
    async uploadData() {
      // TODO: In the future it might be best if we cache the upload results if possible.
      // This way we don't upload duplicated data.

      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const {
        body,
        attachments: finalAttachments,
      } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const previewWithData = await loadPreviewData(this.get('preview'));

      const conversation = this.getConversation();
      const openGroup = conversation && conversation.toOpenGroup();

      const { AttachmentUtils } = libsession.Utils;
      const [attachments, preview, quote] = await Promise.all([
        AttachmentUtils.uploadAttachments(finalAttachments, openGroup),
        AttachmentUtils.uploadLinkPreviews(previewWithData, openGroup),
        AttachmentUtils.uploadQuoteThumbnails(quoteWithData, openGroup),
      ]);

      return {
        body,
        attachments,
        preview,
        quote,
      };
    },

    // One caller today: event handler for the 'Retry Send' entry in triple-dot menu
    async retrySend() {
      if (!textsecure.messaging) {
        window.log.error('retrySend: Cannot retry since we are offline!');
        return null;
      }

      this.set({ errors: null });
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
      try {
        const conversation = this.getConversation();
        const intendedRecipients = this.get('recipients') || [];
        const successfulRecipients = this.get('sent_to') || [];
        const currentRecipients = conversation.getRecipients();

        if (conversation.isPublic()) {
          const openGroup = {
            server: conversation.get('server'),
            channel: conversation.get('channelId'),
            conversationId: conversation.id,
          };
          const { body, attachments, preview, quote } = await this.uploadData();

          const openGroupParams = {
            identifier: this.id,
            body,
            timestamp: Date.now(),
            group: openGroup,
            attachments,
            preview,
            quote,
          };
          const openGroupMessage = new libsession.Messages.Outgoing.OpenGroupMessage(
            openGroupParams
          );
          return libsession.getMessageQueue().sendToGroup(openGroupMessage);
        }

        let recipients = _.intersection(intendedRecipients, currentRecipients);
        recipients = recipients.filter(
          key => !successfulRecipients.includes(key)
        );

        if (!recipients.length) {
          window.log.warn('retrySend: Nobody to send to!');

          return window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });
        }

        const { body, attachments, preview, quote } = await this.uploadData();
        const ourNumber = window.storage.get('primaryDevicePubKey');
        const ourConversation = window.ConversationController.get(ourNumber);

        const chatParams = {
          identifier: this.id,
          body,
          timestamp: this.get('sent_at'),
          expireTimer: this.get('expireTimer'),
          attachments,
          preview,
          quote,
        };
        if (ourConversation) {
          chatParams.lokiProfile = ourConversation.getOurProfile();
        }

        const chatMessage = new libsession.Messages.Outgoing.ChatMessage(
          chatParams
        );

        // Special-case the self-send case - we send only a sync message
        if (recipients.length === 1) {
          const isOurDevice = await libsession.Protocols.MultiDeviceProtocol.isOurDevice(
            recipients[0]
          );
          if (isOurDevice) {
            return this.sendSyncMessageOnly(chatMessage);
          }
        }

        if (conversation.isPrivate()) {
          const [number] = recipients;
          const recipientPubKey = new libsession.Types.PubKey(number);

          return libsession
            .getMessageQueue()
            .sendUsingMultiDevice(recipientPubKey, chatMessage);
        }

        // TODO should we handle medium groups message here too?
        // Not sure there is the concept of retrySend for those
        const closedGroupChatMessage = new libsession.Messages.Outgoing.ClosedGroupChatMessage(
          {
            identifier: this.id,
            chatMessage,
            groupId: this.get('conversationId'),
          }
        );
        // Because this is a partial group send, we send the message with the groupId field set, but individually
        // to each recipient listed
        return Promise.all(
          recipients.map(async r => {
            const recipientPubKey = new libsession.Types.PubKey(r);
            return libsession
              .getMessageQueue()
              .sendUsingMultiDevice(recipientPubKey, closedGroupChatMessage);
          })
        );
      } catch (e) {
        await this.saveErrors(e);
        return null;
      }
    },

    // Called when the user ran into an error with a specific user, wants to send to them
    //   One caller today: ConversationView.forceSend()
    async resend(number) {
      const error = this.removeOutgoingErrors(number);
      if (!error) {
        window.log.warn('resend: requested number was not present in errors');
        return null;
      }

      try {
        const { body, attachments, preview, quote } = await this.uploadData();

        const chatMessage = new libsession.Messages.Outgoing.ChatMessage({
          identifier: this.id,
          body,
          timestamp: this.get('sent_at'),
          expireTimer: this.get('expireTimer'),
          attachments,
          preview,
          quote,
        });

        // Special-case the self-send case - we send only a sync message
        if (number === this.OUR_NUMBER) {
          return this.sendSyncMessageOnly(chatMessage);
        }

        const conversation = this.getConversation();
        const recipientPubKey = new libsession.Types.PubKey(number);

        if (conversation.isPrivate()) {
          return libsession
            .getMessageQueue()
            .sendUsingMultiDevice(recipientPubKey, chatMessage);
        }

        const closedGroupChatMessage = new libsession.Messages.Outgoing.ClosedGroupChatMessage(
          {
            chatMessage,
            groupId: this.get('conversationId'),
          }
        );
        // resend tries to send the message to that specific user only in the context of a closed group
        return libsession
          .getMessageQueue()
          .sendUsingMultiDevice(recipientPubKey, closedGroupChatMessage);
      } catch (e) {
        await this.saveErrors(e);
        return null;
      }
    },
    removeOutgoingErrors(number) {
      const errors = _.partition(
        this.get('errors'),
        e =>
          e.number === number &&
          (e.name === 'MessageError' ||
            e.name === 'SendMessageNetworkError' ||
            e.name === 'SignedPreKeyRotationError' ||
            e.name === 'OutgoingIdentityKeyError')
      );
      this.set({ errors: errors[1] });
      return errors[0][0];
    },

    /**
     * This function is called by inbox_view.js when a message was successfully sent for one device.
     * So it might be called several times for the same message
     */
    async handleMessageSentSuccess(sentMessage) {
      let sentTo = this.get('sent_to') || [];

      const isOurDevice = await window.libsession.Protocols.MultiDeviceProtocol.isOurDevice(
        sentMessage.device
      );

      // At this point the only way to check for medium
      // group is by comparing the encryption type
      const isMediumGroupMessage =
        sentMessage.encryption === libsession.Types.EncryptionType.MediumGroup;

      const isOpenGroupMessage =
        sentMessage.group &&
        sentMessage.group instanceof libsession.Types.OpenGroup;

      // We trigger a sync message only when the message is not to one of our devices, AND
      // the message is not for an open group (there is no sync for opengroups, each device pulls all messages), AND
      // if we did not sync or trigger a sync message for this specific message already
      const shouldTriggerSyncMessage =
        !isOurDevice &&
        !isOpenGroupMessage &&
        !isMediumGroupMessage &&
        !this.get('synced') &&
        !this.get('sentSync');

      // A message is synced if we triggered a sync message (sentSync)
      // and the current message was sent to our device (so a sync message)
      const shouldMarkMessageAsSynced =
        isOurDevice && !isOpenGroupMessage && this.get('sentSync');

      // Handle the sync logic here
      if (shouldTriggerSyncMessage) {
        const contentDecoded = textsecure.protobuf.Content.decode(
          sentMessage.plainTextBuffer
        );
        const { dataMessage } = contentDecoded;
        if (dataMessage) {
          await this.sendSyncMessage(dataMessage);
        }
      } else if (shouldMarkMessageAsSynced) {
        this.set({ synced: true });
      }
      if (!isOpenGroupMessage) {
        const primaryPubKey = await libsession.Protocols.MultiDeviceProtocol.getPrimaryDevice(
          sentMessage.device
        );
        sentTo = _.union(sentTo, [primaryPubKey.key]);
      }

      this.set({
        sent_to: sentTo,
        sent: true,
        expirationStartTimestamp: Date.now(),
        // unidentifiedDeliveries: result.unidentifiedDeliveries,
      });

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
      this.getConversation().updateLastMessage();

      this.trigger('sent', this);
    },

    async handleMessageSentFailure(sentMessage, error) {
      if (error instanceof Error) {
        this.saveErrors(error);
        if (error.name === 'SignedPreKeyRotationError') {
          await window.getAccountManager().rotateSignedPreKey();
        } else if (error.name === 'OutgoingIdentityKeyError') {
          const c = ConversationController.get(sentMessage.device);
          await c.getProfiles();
        }
      }
      const isOurDevice = await window.libsession.Protocols.MultiDeviceProtocol.isOurDevice(
        sentMessage.device
      );
      const expirationStartTimestamp = Date.now();
      if (isOurDevice && !this.get('sync')) {
        this.set({ sentSync: false });
      }
      this.set({
        sent: true,
        expirationStartTimestamp,
        // unidentifiedDeliveries: result.unidentifiedDeliveries,
      });
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
      this.trigger('change', this);

      this.getConversation().updateLastMessage();
      this.trigger('done');
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

      const key = source.key ? source.key : source;

      return ConversationController.getOrCreate(key, 'private');
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

      // TODO: remove this when we are certain that source
      // is PubKey ano not a string
      const sourceStr = source.key ? source.key : source;

      return ConversationController.getOrCreate(sourceStr, 'private');
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
    async setServerTimestamp(serverTimestamp) {
      if (_.isEqual(this.get('serverTimestamp'), serverTimestamp)) {
        return;
      }

      this.set({
        serverTimestamp,
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

    async sendSyncMessageOnly(dataMessage) {
      this.set({
        sent_to: [this.OUR_NUMBER],
        sent: true,
        expirationStartTimestamp: Date.now(),
      });

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });

      const data =
        dataMessage instanceof libsession.Messages.Outgoing.DataMessage
          ? dataMessage.dataProto()
          : dataMessage;
      await this.sendSyncMessage(data);
    },

    async sendSyncMessage(dataMessage) {
      if (this.get('synced') || this.get('sentSync')) {
        return;
      }

      const data =
        dataMessage instanceof libsession.Messages.Outgoing.DataMessage
          ? dataMessage.dataProto()
          : dataMessage;

      const syncMessage = new libsession.Messages.Outgoing.SentSyncMessage({
        timestamp: this.get('sent_at'),
        identifier: this.id,
        dataMessage: data,
        destination: this.get('destination'),
        expirationStartTimestamp: this.get('expirationStartTimestamp'),
        sent_to: this.get('sent_to'),
        unidentifiedDeliveries: this.get('unidentifiedDeliveries'),
      });

      await libsession.getMessageQueue().sendSyncMessage(syncMessage);

      this.set({ sentSync: true });
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
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

    async markMessageSyncOnly(dataMessage) {
      this.set({
        // These are the same as a normal send()
        dataMessage,
        sent_to: [this.OUR_NUMBER],
        sent: true,
        expirationStartTimestamp: Date.now(),
      });

      return window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
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

      if (this.isEndSession()) {
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
          e.name === 'SendMessageNetworkError' ||
          e.name === 'SignedPreKeyRotationError'
      );
      return !!error;
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

      this.add(models.reverse());

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
