// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global ConversationController, SignalProtocolStore, Whisper */

describe('KeyChangeListener', () => {
  const phoneNumberWithKeyChange = '+13016886524'; // nsa
  const addressString = `${phoneNumberWithKeyChange}.1`;
  const oldKey = window.Signal.Crypto.getRandomBytes(33);
  const newKey = window.Signal.Crypto.getRandomBytes(33);
  let store;

  beforeEach(async () => {
    store = new SignalProtocolStore();
    await store.hydrateCaches();
    Whisper.KeyChangeListener.init(store);
    return store.saveIdentity(addressString, oldKey);
  });

  afterEach(() => {
    return store.removeIdentityKey(phoneNumberWithKeyChange);
  });

  describe('When we have a conversation with this contact', () => {
    let convo;
    before(async () => {
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: phoneNumberWithKeyChange,
        type: 'private',
      });
      await window.Signal.Data.saveConversation(convo.attributes);
    });

    after(async () => {
      await window.Signal.Data.removeAllMessagesInConversation(convo.id, {
        logId: phoneNumberWithKeyChange,
        MessageCollection: Whisper.MessageCollection,
      });
      await window.Signal.Data.removeConversation(convo.id, {
        Conversation: Whisper.Conversation,
      });
    });

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
    let convo;
    before(async () => {
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: phoneNumberWithKeyChange,
        type: 'private',
      });
      groupConvo = ConversationController.dangerouslyCreateAndAdd({
        id: 'groupId',
        type: 'group',
        members: [convo.id],
      });
      await window.Signal.Data.saveConversation(convo.attributes);
      await window.Signal.Data.saveConversation(groupConvo.attributes);
    });
    after(async () => {
      await window.Signal.Data.removeAllMessagesInConversation(groupConvo.id, {
        logId: phoneNumberWithKeyChange,
        MessageCollection: Whisper.MessageCollection,
      });
      await window.Signal.Data.removeConversation(groupConvo.id, {
        Conversation: Whisper.Conversation,
      });
      await window.Signal.Data.removeConversation(convo.id, {
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
