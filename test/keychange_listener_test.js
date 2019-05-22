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

  beforeEach(() => {
    store = new SignalProtocolStore();
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
      await convo.destroyMessages();
      await window.Signal.Data.saveConversation(convo.id);
    });

    it('generates a key change notice in the private conversation with this contact', done => {
      convo.once('newmessage', async () => {
        await convo.fetchMessages();
        const message = convo.messageCollection.at(0);
        assert.strictEqual(message.get('type'), 'keychange');
        done();
      });
      store.saveIdentity(address.toString(), newKey);
    });
  });

  describe('When we have a group with this contact', () => {
    let convo;
    before(async () => {
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: 'groupId',
        type: 'group',
        members: [phoneNumberWithKeyChange],
      });
      await window.Signal.Data.saveConversation(convo.attributes, {
        Conversation: Whisper.Conversation,
      });
    });
    after(async () => {
      await convo.destroyMessages();
      await window.Signal.Data.saveConversation(convo.id);
    });

    it('generates a key change notice in the group conversation with this contact', done => {
      convo.once('newmessage', async () => {
        await convo.fetchMessages();
        const message = convo.messageCollection.at(0);
        assert.strictEqual(message.get('type'), 'keychange');
        done();
      });
      store.saveIdentity(address.toString(), newKey);
    });
  });
});
