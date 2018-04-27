/*
 * vim: ts=4:sw=4:expandtab
 */
(function() {
  'use strict';
  window.Whisper = window.Whisper || {};
  var Item = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'items',
  });
  var ItemCollection = Backbone.Collection.extend({
    model: Item,
    storeName: 'items',
    database: Whisper.Database,
  });

  var ready = false;
  var items = new ItemCollection();
  items.on('reset', function() {
    ready = true;
  });
  window.storage = {
    /*****************************
     *** Base Storage Routines ***
     *****************************/
    put: function(key, value) {
      if (value === undefined) {
        throw new Error('Tried to store undefined');
      }
      if (!ready) {
        console.log('Called storage.put before storage is ready. key:', key);
      }
      var item = items.add({ id: key, value: value }, { merge: true });
      return new Promise(function(resolve, reject) {
        item.save().then(resolve, reject);
      });
    },

    get: function(key, defaultValue) {
      var item = items.get('' + key);
      if (!item) {
        return defaultValue;
      }
      return item.get('value');
    },

    remove: function(key) {
      var item = items.get('' + key);
      if (item) {
        items.remove(item);
        return new Promise(function(resolve, reject) {
          item.destroy().then(resolve, reject);
        });
      }
      return Promise.resolve();
    },

    onready: function(callback) {
      if (ready) {
        callback();
      } else {
        items.on('reset', callback);
      }
    },

    fetch: function() {
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

    reset: function() {
      items.reset();
    },
  };
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};
  window.textsecure.storage.impl = window.storage;
})();
