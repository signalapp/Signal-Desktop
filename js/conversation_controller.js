/* global _, Whisper, Backbone, storage */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const conversations = new Whisper.ConversationCollection();
  const inboxCollection = new (Backbone.Collection.extend({
    initialize() {
      this.on('change:timestamp change:name change:number', this.sort);

      this.listenTo(conversations, 'add change:active_at', this.addActive);
      this.listenTo(conversations, 'reset', () => this.reset([]));

      this.on(
        'add remove change:unreadCount',
        _.debounce(this.updateUnreadCount.bind(this), 1000)
      );
      this.startPruning();

      this.collator = new Intl.Collator();
    },
    comparator(m1, m2) {
      const timestamp1 = m1.get('timestamp');
      const timestamp2 = m2.get('timestamp');
      if (timestamp1 && !timestamp2) {
        return -1;
      }
      if (timestamp2 && !timestamp1) {
        return 1;
      }
      if (timestamp1 && timestamp2 && timestamp1 !== timestamp2) {
        return timestamp2 - timestamp1;
      }

      const title1 = m1.getTitle().toLowerCase();
      const title2 = m2.getTitle().toLowerCase();
      return this.collator.compare(title1, title2);
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
    startPruning() {
      const halfHour = 30 * 60 * 1000;
      this.interval = setInterval(() => {
        this.forEach(conversation => {
          conversation.trigger('prune');
        });
      }, halfHour);
    },
  }))();

  window.getInboxCollection = () => inboxCollection;

  window.ConversationController = {
    markAsSelected(toSelect) {
      conversations.each(conversation => {
        const current = conversation.isSelected || false;
        const newValue = conversation.id === toSelect.id;

        // eslint-disable-next-line no-param-reassign
        conversation.isSelected = newValue;
        if (current !== newValue) {
          conversation.trigger('change');
        }
      });
    },
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
    prepareForSend(id, options) {
      // id is either a group id or an individual user's id
      const conversation = this.get(id);
      const sendOptions = conversation
        ? conversation.getSendOptions(options)
        : null;
      const wrap = conversation
        ? conversation.wrapSend.bind(conversation)
        : promise => promise;

      return { wrap, sendOptions };
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
            conversations.map(conversation => conversation.updateLastMessage())
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
