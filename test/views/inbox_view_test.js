describe('InboxView', function() {
  var inboxView = new Whisper.InboxView({
    model: {},
    window: window,
    initialLoadComplete: function() {},
  }).render();

  var conversation = new Whisper.Conversation({ id: '1234', type: 'private' });

  describe('the conversation stack', function() {
    it('should be rendered', function() {
      assert.ok(inboxView.$('.conversation-stack').length === 1);
    });

    describe('opening a conversation', function() {
      var triggeredOpenedCount = 0;

      before(function() {
        conversation.on('opened', function() {
          triggeredOpenedCount++;
        });

        inboxView.conversation_stack.open(conversation);
      });

      it('should trigger an opened event', function() {
        assert.ok(triggeredOpenedCount === 1);
      });

      describe('and then opening it again immediately', function() {
        before(function() {
          inboxView.conversation_stack.open(conversation);
        });

        it('should trigger the opened event again', function() {
          assert.ok(triggeredOpenedCount === 2);
        });
      });
    });
  });
});
