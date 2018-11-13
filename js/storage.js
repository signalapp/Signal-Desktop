/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  let ready = false;
  let items;
  let callbacks = [];

  reset();

  async function put(key, value) {
    if (value === undefined) {
      throw new Error('Tried to store undefined');
    }
    if (!ready) {
      window.log.warn('Called storage.put before storage is ready. key:', key);
    }

    const data = { id: key, value };

    items[key] = data;
    await window.Signal.Data.createOrUpdateItem(data);
  }

  function get(key, defaultValue) {
    if (!ready) {
      window.log.warn('Called storage.get before storage is ready. key:', key);
    }

    const item = items[key];
    if (!item) {
      return defaultValue;
    }

    return item.value;
  }

  async function remove(key) {
    if (!ready) {
      window.log.warn('Called storage.get before storage is ready. key:', key);
    }

    delete items[key];
    await window.Signal.Data.removeItemById(key);
  }

  function onready(callback) {
    if (ready) {
      callback();
    } else {
      callbacks.push(callback);
    }
  }

  function callListeners() {
    if (ready) {
      callbacks.forEach(callback => callback());
      callbacks = [];
    }
  }

  async function fetch() {
    this.reset();
    const array = await window.Signal.Data.getAllItems();

    for (let i = 0, max = array.length; i < max; i += 1) {
      const item = array[i];
      const { id } = item;
      items[id] = item;
    }

    ready = true;
    callListeners();
  }

  function reset() {
    ready = false;
    items = Object.create(null);
  }

  const storage = {
    fetch,
    put,
    get,
    remove,
    onready,
    reset,
  };

  // Keep a reference to this storage system, since there are scenarios where
  //   we need to replace it with the legacy storage system for a while.
  window.newStorage = storage;

  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  window.installStorage = newStorage => {
    window.storage = newStorage;
    window.textsecure.storage.impl = newStorage;
  };

  window.installStorage(storage);
})();
