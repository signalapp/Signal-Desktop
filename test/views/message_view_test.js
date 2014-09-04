describe('MessageView', function() {
  var message = Whisper.Messages.add({
    body: 'hello world',
    type: 'outgoing',
    timestamp: new Date().getTime()
  });

  it('should display the message text', function() {
    var view = new Whisper.MessageView({model: message});
    assert.match(view.render().$el.html(), /hello world/);
  });

  it('should auto-update the message text', function() {
    var view = new Whisper.MessageView({model: message});
    message.set('body', 'goodbye world');
    assert.match(view.$el.html(), /goodbye world/);
  });

  it('should go away when the model is destroyed', function() {
    var view = new Whisper.MessageView({model: message});
    var div = $('<div>').append(view.$el);
    message.destroy();
    assert.strictEqual(div.find(view.$el).length, 0);
  });
});
