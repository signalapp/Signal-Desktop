// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global ConversationController, libsignal, SignalProtocolStore, Whisper */

describe('KeyChangeListener', () => {
  const phoneNumberWithKeyChange = '+13016886524'; // nsa
  const address = new libsignal.SignalProtocolAddress(
    phoneNumberWithKeyChange,
    1
  );
  const oldKey = libsignal.crypto.getRandomBytes(33);
  const newKey = libsignal.crypto.getRandomBytes(33);
  let store;

  beforeEach(async () => {
    store = new SignalProtocolStore();
    await store.hydrateCaches();
    Whisper.KeyChangeListener.init(store);
    return store.saveIdentity(address.toString(), oldKey);
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
      await window.Signal.Data.saveConversation(convo.attributes, {
        Conversation: Whisper.Conversation,
      });
    });

    after(async () => {
      await window.Signal.Data.removeAllMessagesInConversation(convo.id, {
        MessageCollection: Whisper.MessageCollection,
      });
      await window.Signal.Data.removeConversation(convo.id, {
        Conversation: Whisper.Conversation,
      });
    });

    it('generates a key change notice in the private conversation with this contact', done => {
      const original = convo.addKeyChange;
      convo.addKeyChange = keyChangedId => {
        assert.equal(address.getName(), keyChangedId);
        convo.addKeyChange = original;
        done();
      };
      store.saveIdentity(address.toString(), newKey);
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
      await window.Signal.Data.saveConversation(convo.attributes, {
        Conversation: Whisper.Conversation,
      });
      await window.Signal.Data.saveConversation(groupConvo.attributes, {
        Conversation: Whisper.Conversation,
      });
    });
    after(async () => {
      await window.Signal.Data.removeAllMessagesInConversation(groupConvo.id, {
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
        assert.equal(address.getName(), keyChangedId);
        groupConvo.addKeyChange = original;
        done();
      };

      store.saveIdentity(address.toString(), newKey);
    });
  });
});
