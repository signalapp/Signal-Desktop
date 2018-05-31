'use strict';
describe('Protocol', function() {
  describe('Unencrypted PushMessageProto "decrypt"', function() {
    //exclusive
    it('works', function(done) {
      localStorage.clear();

      var text_message = new textsecure.protobuf.DataMessage();
      text_message.body = 'Hi Mom';
      var server_message = {
        type: 4, // unencrypted
        source: '+19999999999',
        timestamp: 42,
        message: text_message.encode(),
      };

      return textsecure.protocol_wrapper
        .handleEncryptedMessage(
          server_message.source,
          server_message.source_device,
          server_message.type,
          server_message.message
        )
        .then(function(message) {
          assert.equal(message.body, text_message.body);
          assert.equal(
            message.attachments.length,
            text_message.attachments.length
          );
          assert.equal(text_message.attachments.length, 0);
        })
        .then(done)
        .catch(done);
    });
  });
});
