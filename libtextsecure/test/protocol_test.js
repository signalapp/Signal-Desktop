/* global textsecure */

describe('Protocol', () => {
  describe('Unencrypted PushMessageProto "decrypt"', () => {
    // exclusive
    it('works', done => {
      localStorage.clear();

      const textMessage = new textsecure.protobuf.DataMessage();
      textMessage.body = 'Hi Mom';
      const serverMessage = {
        type: 4, // unencrypted
        source: '+19999999999',
        timestamp: 42,
        message: textMessage.encode(),
      };

      return textsecure.protocol_wrapper
        .handleEncryptedMessage(
          serverMessage.source,
          serverMessage.source_device,
          serverMessage.type,
          serverMessage.message
        )
        .then(message => {
          assert.equal(message.body, textMessage.body);
          assert.equal(
            message.attachments.length,
            textMessage.attachments.length
          );
          assert.equal(textMessage.attachments.length, 0);
        })
        .then(done)
        .catch(done);
    });
  });
});
