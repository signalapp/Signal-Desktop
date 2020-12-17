/* global Whisper, textsecure, libsignal, log */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const conversations = new Whisper.ConversationCollection();

  window.getConversations = () => conversations;

  window.getMessagesByKey = async key => {
    // loadLive gets messages live, not from the database which can lag behind.

    let messages = [];
    const messageSet = await window.Signal.Data.getMessagesByConversation(key, {
      limit: 100,
      MessageCollection: Whisper.MessageCollection,
    });

    messages = messageSet.models.map(conv => conv.attributes);
    return messages;
  };

  window.ConversationController = {
    get(id) {
      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      return conversations.get(id);
    },
    getOrThrow(id) {
      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      const convo = conversations.get(id);

      if (convo) {
        return convo;
      }
      throw new Error(
        `Conversation ${id} does not exist on ConversationController.get()`
      );
    },
    // Needed for some model setup which happens during the initial fetch() call below
    getUnsafe(id) {
      return conversations.get(id);
    },
    dangerouslyCreateAndAdd(attributes) {
      return conversations.add(attributes);
    },
    getOrCreate(id, type) {
      if (typeof id !== 'string') {
        throw new TypeError("'id' must be a string");
      }

      if (type !== 'private' && type !== 'group') {
        throw new TypeError(
          `'type' must be 'private' or 'group'; got: '${type}'`
        );
      }

      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      let conversation = conversations.get(id);
      if (conversation) {
        return conversation;
      }

      conversation = conversations.add({
        id,
        type,
        version: 2,
      });

      const create = async () => {
        if (!conversation.isValid()) {
          const validationError = conversation.validationError || {};
          window.log.error(
            'Contact is not valid. Not saving, but adding to collection:',
            conversation.idForLogging(),
            validationError.stack
          );

          return conversation;
        }

        try {
          await window.Signal.Data.saveConversation(conversation.attributes, {
            Conversation: Whisper.Conversation,
          });
        } catch (error) {
          window.log.error(
            'Conversation save failed! ',
            id,
            type,
            'Error:',
            error && error.stack ? error.stack : error
          );
          throw error;
        }

        return conversation;
      };

      conversation.initialPromise = create();
      conversation.initialPromise.then(() => {
        if (!conversation.isPublic() && !conversation.isRss()) {
          Promise.all([
            conversation.updateProfileAvatar(),
            // NOTE: we request snodes updating the cache, but ignore the result
            window.SnodePool.getSnodesFor(id),
          ]);
        }
        if (window.inboxStore) {
          conversation.on('change', this.updateReduxConvoChanged);
          window.inboxStore.dispatch(
            window.actionsCreators.conversationAdded(
              conversation.id,
              conversation.getProps()
            )
          );
        }
      });

      return conversation;
    },
    async deleteContact(id) {
      if (typeof id !== 'string') {
        throw new TypeError("'id' must be a string");
      }

      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      const conversation = conversations.get(id);
      if (!conversation) {
        return;
      }

      // Close group leaving
      if (conversation.isClosedGroup()) {
        await conversation.leaveGroup();
      } else if (conversation.isPublic()) {
        const channelAPI = await conversation.getPublicSendData();
        if (channelAPI === null) {
          log.warn(`Could not get API for public conversation ${id}`);
        } else {
          channelAPI.serverAPI.partChannel(channelAPI.channelId);
        }
      } else if (conversation.isPrivate()) {
        const deviceIds = await textsecure.storage.protocol.getDeviceIds(id);
        await Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(id, deviceId);
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
              address
            );
            return sessionCipher.deleteAllSessionsForDevice();
          })
        );
      }

      await conversation.destroyMessages();

      await window.Signal.Data.removeConversation(id, {
        Conversation: Whisper.Conversation,
      });
      conversation.off('change', this.updateReduxConvoChanged);
      conversations.remove(conversation);
      if (window.inboxStore) {
        window.inboxStore.dispatch(
          window.actionsCreators.conversationRemoved(conversation.id)
        );
      }
    },
    getOrCreateAndWait(id, type) {
      return this._initialPromise.then(() => {
        if (!id) {
          return Promise.reject(
            new Error('getOrCreateAndWait: invalid id passed.')
          );
        }
        const pubkey = id && id.key ? id.key : id;
        const conversation = this.getOrCreate(pubkey, type);

        if (conversation) {
          return conversation.initialPromise.then(() => conversation);
        }

        return Promise.reject(
          new Error('getOrCreateAndWait: did not get conversation')
        );
      });
    },
    async getAllGroupsInvolvingId(id) {
      const groups = await window.Signal.Data.getAllGroupsInvolvingId(id, {
        ConversationCollection: Whisper.ConversationCollection,
      });
      return groups.map(group => conversations.add(group));
    },
    loadPromise() {
      return this._initialPromise;
    },
    reset() {
      this._initialPromise = Promise.resolve();
      this._initialFetchComplete = false;
      conversations.reset([]);
      if (window.inboxStore) {
        conversations.forEach(convo =>
          convo.off('change', this.updateReduxConvoChanged)
        );

        window.inboxStore.dispatch(
          window.actionsCreators.removeAllConversations()
        );
      }
    },
    updateReduxConvoChanged(convo) {
      if (window.inboxStore) {
        window.inboxStore.dispatch(
          window.actionsCreators.conversationChanged(convo.id, convo.getProps())
        );
      }
    },
    async load() {
      window.log.info('ConversationController: starting initial fetch');

      if (conversations.length) {
        throw new Error('ConversationController: Already loaded!');
      }

      const load = async () => {
        try {
          const collection = await window.Signal.Data.getAllConversations({
            ConversationCollection: Whisper.ConversationCollection,
          });

          conversations.add(collection.models);

          this._initialFetchComplete = true;
          const promises = [];
          conversations.forEach(conversation => {
            if (!conversation.get('lastMessage')) {
              promises.push(conversation.updateLastMessage());
            }

            promises.concat([
              conversation.updateProfileName(),
              conversation.updateProfileAvatar(),
            ]);
          });
          conversations.forEach(conversation => {
            // register for change event on each conversation, and forward to redux
            conversation.on('change', this.updateReduxConvoChanged);
          });
          await Promise.all(promises);

          // Remove any unused images
          window.profileImages.removeImagesNotInArray(
            conversations.map(c => c.id)
          );

          window.log.info('ConversationController: done with initial fetch');
        } catch (error) {
          window.log.error(
            'ConversationController: initial fetch failed',
            error && error.stack ? error.stack : error
          );
          throw error;
        }
      };
      await window.BlockedNumberController.load();

      this._initialPromise = load();

      return this._initialPromise;
    },
    getContactProfileNameOrShortenedPubKey: pubKey => {
      const conversation = window.ConversationController.get(pubKey);
      if (!conversation) {
        return pubKey;
      }
      return conversation.getContactProfileNameOrShortenedPubKey();
    },

    getContactProfileNameOrFullPubKey: pubKey => {
      const conversation = window.ConversationController.get(pubKey);
      if (!conversation) {
        return pubKey;
      }
      return conversation.getContactProfileNameOrFullPubKey();
    },

    isMediumGroup: hexEncodedGroupPublicKey =>
      conversations
        .filter(c => c.isMediumGroup())
        .some(c => c.id === hexEncodedGroupPublicKey),
    _handleOnline: pubKey => {
      try {
        const conversation = this.get(pubKey);
        conversation.set({ isOnline: true });
      } catch (e) {} // eslint-disable-line
    },
    _handleOffline: pubKey => {
      try {
        const conversation = this.get(pubKey);
        conversation.set({ isOnline: false });
      } catch (e) {} // eslint-disable-line
    },
  };
})();
