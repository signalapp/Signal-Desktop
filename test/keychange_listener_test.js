describe('KeyChangeListener', function() {
  var phoneNumberWithKeyChange = '+13016886524'; // nsa
  var address = new libsignal.SignalProtocolAddress(
    phoneNumberWithKeyChange,
    1
  );
  var oldKey = libsignal.crypto.getRandomBytes(33);
  var newKey = libsignal.crypto.getRandomBytes(33);
  var store;

  beforeEach(function() {
    store = new SignalProtocolStore();
    Whisper.KeyChangeListener.init(store);
    return store.saveIdentity(address.toString(), oldKey);
  });

  afterEach(function() {
    return store.removeIdentityKey(phoneNumberWithKeyChange);
  });

  describe('When we have a conversation with this contact', function() {
    let convo;
    before(async function() {
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: phoneNumberWithKeyChange,
        type: 'private',
      });
      await window.Signal.Data.saveConversation(convo.attributes, {
        Conversation: Whisper.Conversation,
      });
    });

    after(async function() {
      await convo.destroyMessages();
      await window.Signal.Data.saveConversation(convo.id);
    });

    it('generates a key change notice in the private conversation with this contact', function(done) {
      convo.once('newmessage', async () => {
        await convo.fetchMessages();
        const message = convo.messageCollection.at(0);
        assert.strictEqual(message.get('type'), 'keychange');
        done();
      });
      store.saveIdentity(address.toString(), newKey);
    });
  });

  describe('When we have a group with this contact', function() {
    let convo;
    before(async function() {
      console.log('Creating group with contact', phoneNumberWithKeyChange);
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: 'groupId',
        type: 'group',
        members: [phoneNumberWithKeyChange],
      });
      await window.Signal.Data.saveConversation(convo.attributes, {
        Conversation: Whisper.Conversation,
      });
    });
    after(async function() {
      await convo.destroyMessages();
      await window.Signal.Data.saveConversation(convo.id);
    });

    it('generates a key change notice in the group conversation with this contact', function(done) {
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
