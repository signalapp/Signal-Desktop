/* global storage, libsignal, ConversationController, textsecure, Whisper */

describe('InboxView', () => {
  let inboxView;
  let conversation;
  let identityKey;

  before(async () => {
    ConversationController.reset();
    identityKey = {
      pubKey: libsignal.crypto.getRandomBytes(33),
      privKey: libsignal.crypto.getRandomBytes(32),
    };
    storage.put('identityKey', identityKey);
    await ConversationController.load();
    await ConversationController.getOrCreateAndWait(
      textsecure.storage.user.getNumber(),
      'private'
    );
    inboxView = new Whisper.InboxView({
      model: {},
      window,
      initialLoadComplete() { },
    }).render();

    conversation = new Whisper.Conversation({
      id: '1234',
      type: 'private',
    });
  });

  describe('the conversation stack', () => {
    it('should be rendered', () => {
      assert.ok(inboxView.$('.conversation-stack').length === 1);
    });

    describe('opening a conversation', () => {
      let triggeredOpenedCount = 0;

      before(() => {
        conversation.on('opened', () => {
          triggeredOpenedCount += 1;
        });

        inboxView.conversation_stack.open(conversation);
      });

      it('should trigger an opened event', () => {
        assert.ok(triggeredOpenedCount === 1);
      });

      describe('and then opening it again immediately', () => {
        before(() => {
          inboxView.conversation_stack.open(conversation);
        });

        it('should trigger the opened event again', () => {
          assert.ok(triggeredOpenedCount === 2);
        });
      });
    });
  });
});
