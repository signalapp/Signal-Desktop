mocha.setup("bdd");
window.assert = chai.assert;
describe('MessageView', function() {
  var message = Whisper.Messages.add({
    threadId: 'test-thread',
    body: 'hello world',
    type: 'outgoing',
    timestamp: new Date().getTime()
  });

  describe('#render', function() {
    var view = new Whisper.MessageView({model: message});
    var div = $('<div>').append(view.render().$el);

    it('should include the message text', function() {
      assert.match(view.$el.html(), /hello world/);
    });

    it('should auto-update the message text', function() {
      message.set('body', 'goodbye world');
      assert.match(view.$el.html(), /goodbye world/);
    });

    it('should go away when the model is destroyed', function() {
      message.destroy();
      assert.strictEqual(div.find(view.$el).length, 0);
    });
  });
});
