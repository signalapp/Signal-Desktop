/* global Backbone, Whisper */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const Item = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'items',
  });
  const ItemCollection = Backbone.Collection.extend({
    model: Item,
    storeName: 'items',
    database: Whisper.Database,
  });

  let ready = false;
  const items = new ItemCollection();
  items.on('reset', () => {
    ready = true;
  });
  window.legacyStorage = {
    /** ***************************
     *** Base Storage Routines ***
     **************************** */
    put(key, value) {
      if (value === undefined) {
        throw new Error('Tried to store undefined');
      }
      if (!ready) {
        window.log.warn(
          'Called storage.put before storage is ready. key:',
          key
        );
      }
      const item = items.add({ id: key, value }, { merge: true });
      return new Promise((resolve, reject) => {
        item.save().then(resolve, reject);
      });
    },

    get(key, defaultValue) {
      const item = items.get(`${key}`);
      if (!item) {
        return defaultValue;
      }
      return item.get('value');
    },

    remove(key) {
      const item = items.get(`${key}`);
      if (item) {
        items.remove(item);
        return new Promise((resolve, reject) => {
          item.destroy().then(resolve, reject);
        });
      }
      return Promise.resolve();
    },

    onready(callback) {
      if (ready) {
        callback();
      } else {
        items.on('reset', callback);
      }
    },

    fetch() {
      return new Promise((resolve, reject) => {
        items
          .fetch({ reset: true })
          .fail(() =>
            reject(
              new Error(
                'Failed to fetch from storage.' +
                  ' This may be due to an unexpected database version.'
              )
            )
          )
          .always(resolve);
      });
    },

    reset() {
      items.reset();
    },
  };
})();
