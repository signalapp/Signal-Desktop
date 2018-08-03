describe('Protocol', () => {
  describe('Unencrypted PushMessageProto "decrypt"', () => {
    // exclusive
    it('works', done => {
      localStorage.clear();

      const text_message = new textsecure.protobuf.DataMessage();
      text_message.body = 'Hi Mom';
      const server_message = {
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
        .then(message => {
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
