describe('KeyChangeListener', function() {
  var phone_number_with_keychange = '+13016886524';  // nsa
  var oldkey = libsignal.crypto.getRandomBytes(33);
  var newkey = libsignal.crypto.getRandomBytes(33);
  var store;

  before(function() {
    storage.put('safety-numbers-approval', false);
  });

  after(function() {
    storage.remove('safety-numbers-approval');
  });

  beforeEach(function() {
    store = new SignalProtocolStore();
    Whisper.KeyChangeListener.init(store);
    return store.saveIdentity(phone_number_with_keychange, oldkey);
  });

  afterEach(function() {
    return store.removeIdentityKey(phone_number_with_keychange);
  });

  describe('When we have a conversation with this contact', function() {
    var convo = new Whisper.Conversation({ id: phone_number_with_keychange, type: 'private'});
    before(function() {
      ConversationController.add(convo);
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
      return store.isTrustedIdentity(phone_number_with_keychange, newkey);
    });
  });


  describe('When we have a group with this contact', function() {
    var convo = new Whisper.Conversation({ id: 'groupId', type: 'group', members: [phone_number_with_keychange] });
    before(function() {
      ConversationController.add(convo);
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
      return store.isTrustedIdentity(phone_number_with_keychange, newkey);
    });

  });

});
