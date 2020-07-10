/* global _, Whisper, Backbone, storage, textsecure */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

  const conversations = new Whisper.ConversationCollection();
  const inboxCollection = new (Backbone.Collection.extend({
    initialize() {
      this.listenTo(conversations, 'add change:active_at', this.addActive);
      this.listenTo(conversations, 'reset', () => this.reset([]));

      this.on(
        'add remove change:unreadCount',
        _.debounce(this.updateUnreadCount.bind(this), 1000)
      );
    },
    addActive(model) {
      if (model.get('active_at')) {
        this.add(model);
      } else {
        this.remove(model);
      }
    },
    updateUnreadCount() {
      const newUnreadCount = _.reduce(
        this.map(m => m.get('unreadCount')),
        (item, memo) => item + memo,
        0
      );
      storage.put('unreadCount', newUnreadCount);

      if (newUnreadCount > 0) {
        window.setBadgeCount(newUnreadCount);
        window.document.title = `${window.getTitle()} (${newUnreadCount})`;
      } else {
        window.setBadgeCount(0);
        window.document.title = window.getTitle();
      }
      window.updateTrayIcon(newUnreadCount);
    },
  }))();

  window.getInboxCollection = () => inboxCollection;
  window.getConversations = () => conversations;

  window.ConversationController = {
    get(id) {
      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      return conversations.get(id);
    },
    // Needed for some model setup which happens during the initial fetch() call below
    getUnsafe(id) {
      return conversations.get(id);
    },
    dangerouslyCreateAndAdd(attributes) {
      return conversations.add(attributes);
    },
    getOrCreate(identifier, type) {
      if (typeof identifier !== 'string') {
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

      let conversation = conversations.get(identifier);
      if (conversation) {
        return conversation;
      }

      const id = window.getGuid();

      if (type === 'group') {
        conversation = conversations.add({
          id,
          uuid: null,
          e164: null,
          groupId: identifier,
          type,
          version: 2,
        });
      } else if (window.isValidGuid(identifier)) {
        conversation = conversations.add({
          id,
          uuid: identifier,
          e164: null,
          groupId: null,
          type,
          version: 2,
        });
      } else {
        conversation = conversations.add({
          id,
          uuid: null,
          e164: identifier,
          groupId: null,
          type,
          version: 2,
        });
      }

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
            identifier,
            type,
            'Error:',
            error && error.stack ? error.stack : error
          );
          throw error;
        }

        return conversation;
      };

      conversation.initialPromise = create();

      return conversation;
    },
    getOrCreateAndWait(id, type) {
      return this._initialPromise.then(() => {
        const conversation = this.getOrCreate(id, type);

        if (conversation) {
          return conversation.initialPromise.then(() => conversation);
        }

        return Promise.reject(
          new Error('getOrCreateAndWait: did not get conversation')
        );
      });
    },
    getConversationId(address) {
      if (!address) {
        return null;
      }

      const [id] = textsecure.utils.unencodeNumber(address);
      const conv = this.get(id);

      if (conv) {
        return conv.get('id');
      }

      return null;
    },
    getOurConversationId() {
      const e164 = textsecure.storage.user.getNumber();
      const uuid = textsecure.storage.user.getUuid();
      return this.getConversationId(e164 || uuid);
    },
    /**
     * Given certain metadata about a message (an identifier of who wrote the
     * message and the sent_at timestamp of the message) returns the
     * conversation the message belongs to OR null if a conversation isn't
     * found.
     * @param {string} targetFrom The E164, UUID, or Conversation ID of the message author
     * @param {number} targetTimestamp The sent_at timestamp of the target message
     */
    async getConversationForTargetMessage(targetFrom, targetTimestamp) {
      const targetFromId = this.getConversationId(targetFrom);

      const messages = await window.Signal.Data.getMessagesBySentAt(
        targetTimestamp,
        {
          MessageCollection: Whisper.MessageCollection,
        }
      );
      const targetMessage = messages.find(m => {
        const contact = m.getContact();

        if (!contact) {
          return false;
        }

        const mcid = contact.get('id');
        return mcid === targetFromId;
      });

      if (targetMessage) {
        return targetMessage.getConversation();
      }

      return null;
    },
    prepareForSend(id, options) {
      // id is any valid conversation identifier
      const conversation = this.get(id);
      const sendOptions = conversation
        ? conversation.getSendOptions(options)
        : null;
      const wrap = conversation
        ? conversation.wrapSend.bind(conversation)
        : promise => promise;

      return { wrap, sendOptions };
    },
    async getAllGroupsInvolvingId(conversationId) {
      const groups = await window.Signal.Data.getAllGroupsInvolvingId(
        conversationId,
        {
          ConversationCollection: Whisper.ConversationCollection,
        }
      );
      return groups.map(group => conversations.add(group));
    },
    loadPromise() {
      return this._initialPromise;
    },
    reset() {
      this._initialPromise = Promise.resolve();
      this._initialFetchComplete = false;
      conversations.reset([]);
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
          await Promise.all(
            conversations.map(async conversation => {
              if (!conversation.get('lastMessage')) {
                await conversation.updateLastMessage();
              }

              // In case a too-large draft was saved to the database
              const draft = conversation.get('draft');
              if (draft && draft.length > MAX_MESSAGE_BODY_LENGTH) {
                this.model.set({
                  draft: draft.slice(0, MAX_MESSAGE_BODY_LENGTH),
                });
                window.Signal.Data.updateConversation(conversation.attributes);
              }
            })
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

      this._initialPromise = load();

      return this._initialPromise;
    },
  };
})();
