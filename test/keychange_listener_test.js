describe('KeyChangeListener', function() {
  var phoneNumberWithKeyChange = '+13016886524';  // nsa
  var address = new libsignal.SignalProtocolAddress(phoneNumberWithKeyChange, 1);
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
    before(function() {
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: phoneNumberWithKeyChange,
        type: 'private',
      });
      return convo.save();
    });

    after(function() {
      convo.destroyMessages();
      return convo.destroy();
    });

    it('generates a key change notice in the private conversation with this contact', function(done) {
      convo.on('newmessage', function() {
        return convo.fetchMessages().then(function() {
          var message = convo.messageCollection.at(0);
          assert.strictEqual(message.get('type'), 'keychange');
          done();
        });
      });
      return store.saveIdentity(address.toString(), newKey);
    });
  });


  describe('When we have a group with this contact', function() {
    let convo;
    before(function() {
      convo = ConversationController.dangerouslyCreateAndAdd({
        id: 'groupId',
        type: 'group',
        members: [phoneNumberWithKeyChange],
      });
      return convo.save();
    });
    after(function() {
      convo.destroyMessages();
      return convo.destroy();
    });

    it('generates a key change notice in the group conversation with this contact', function(done) {
      convo.on('newmessage', function() {
        return convo.fetchMessages().then(function() {
          var message = convo.messageCollection.at(0);
          assert.strictEqual(message.get('type'), 'keychange');
          done();
        });
      });
      return store.saveIdentity(address.toString(), newKey);
    });

  });

});
