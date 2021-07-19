// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global ConversationController, SignalProtocolStore, Whisper */

describe('KeyChangeListener', () => {
  const STORAGE_KEYS_TO_RESTORE = ['number_id', 'uuid_id'];
  const oldStorageValues = new Map();

  const phoneNumberWithKeyChange = '+13016886524'; // nsa
  const addressString = `${phoneNumberWithKeyChange}.1`;
  const oldKey = window.Signal.Crypto.getRandomBytes(33);
  const newKey = window.Signal.Crypto.getRandomBytes(33);
  let store;

  before(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    STORAGE_KEYS_TO_RESTORE.forEach(key => {
      oldStorageValues.set(key, window.textsecure.storage.get(key));
    });
    window.textsecure.storage.put('number_id', '+14155555556.2');
    window.textsecure.storage.put('uuid_id', `${window.getGuid()}.2`);
  });

  after(async () => {
    await window.Signal.Data.removeAll();
    await window.storage.fetch();

    oldStorageValues.forEach((oldValue, key) => {
      if (oldValue) {
        window.textsecure.storage.put(key, oldValue);
      } else {
        window.textsecure.storage.remove(key);
      }
    });
  });

  let convo;

  beforeEach(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();
    await window.ConversationController.loadPromise();

    convo = window.ConversationController.dangerouslyCreateAndAdd({
      id: phoneNumberWithKeyChange,
      type: 'private',
    });
    await window.Signal.Data.saveConversation(convo.attributes);

    store = new SignalProtocolStore();
    await store.hydrateCaches();
    Whisper.KeyChangeListener.init(store);
    return store.saveIdentity(addressString, oldKey);
  });

  afterEach(async () => {
    await window.Signal.Data.removeAllMessagesInConversation(convo.id, {
      logId: phoneNumberWithKeyChange,
      MessageCollection: Whisper.MessageCollection,
    });
    await window.Signal.Data.removeConversation(convo.id, {
      Conversation: Whisper.Conversation,
    });

    await store.removeIdentityKey(phoneNumberWithKeyChange);
  });

  describe('When we have a conversation with this contact', () => {
    it('generates a key change notice in the private conversation with this contact', done => {
      const original = convo.addKeyChange;
      convo.addKeyChange = keyChangedId => {
        assert.equal(phoneNumberWithKeyChange, keyChangedId);
        convo.addKeyChange = original;
        done();
      };
      store.saveIdentity(addressString, newKey);
    });
  });

  describe('When we have a group with this contact', () => {
    let groupConvo;

    beforeEach(async () => {
      groupConvo = ConversationController.dangerouslyCreateAndAdd({
        id: 'groupId',
        type: 'group',
        members: [convo.id],
      });
      await window.Signal.Data.saveConversation(groupConvo.attributes);
    });

    afterEach(async () => {
      await window.Signal.Data.removeAllMessagesInConversation(groupConvo.id, {
        logId: phoneNumberWithKeyChange,
        MessageCollection: Whisper.MessageCollection,
      });
      await window.Signal.Data.removeConversation(groupConvo.id, {
        Conversation: Whisper.Conversation,
      });
    });

    it('generates a key change notice in the group conversation with this contact', done => {
      const original = groupConvo.addKeyChange;
      groupConvo.addKeyChange = keyChangedId => {
        assert.equal(phoneNumberWithKeyChange, keyChangedId);
        groupConvo.addKeyChange = original;
        done();
      };

      store.saveIdentity(addressString, newKey);
    });
  });
});
