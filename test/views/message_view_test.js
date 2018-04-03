describe('MessageView', function() {
  var convo, message;

  before(async (done) => {
    await clearDatabase();
    convo = new Whisper.Conversation({id: 'foo'});
    message = convo.messageCollection.add({
      conversationId: convo.id,
      body: 'hello world',
      type: 'outgoing',
      source: '+14158675309',
      received_at: Date.now(),
    });

    await storage.put('number_id', '+18088888888.1');
    done();
  });

  it('should display the message text', function() {
    var view = new Whisper.MessageView({model: message}).render();
    assert.match(view.$el.text(), /hello world/);
  });

  it('should auto-update the message text', function() {
    var view = new Whisper.MessageView({model: message}).render();
    message.set('body', 'goodbye world');
    assert.match(view.$el.html(), /goodbye world/);
  });

  it('should have a nice timestamp', function() {
    var view = new Whisper.MessageView({model: message});
    message.set({'sent_at': Date.now() - 5000});
    view.render();
    assert.match(view.$el.html(), /now/);

    message.set({'sent_at': Date.now() - 60000});
    view.render();
    assert.match(view.$el.html(), /min/);

    message.set({'sent_at': Date.now() - 3600000});
    view.render();
    assert.match(view.$el.html(), /hour/);
  });
  it('should not imply messages are from the future', function() {
    var view = new Whisper.MessageView({model: message});
    message.set({'sent_at': Date.now() + 60000});
    view.render();
    assert.match(view.$el.html(), /now/);
  });

  it('should go away when the model is destroyed', function() {
    var view = new Whisper.MessageView({model: message});
    var div = $('<div>').append(view.$el);
    message.destroy();
    assert.strictEqual(div.find(view.$el).length, 0);
  });

  it('allows links', function() {
    var url = 'http://example.com';
    message.set('body', url);
    var view = new Whisper.MessageView({model: message});
    view.render();
    var link = view.$el.find('.body a');
    assert.strictEqual(link.length, 1);
    assert.strictEqual(link.text(), url);
    assert.strictEqual(link.attr('href'), url);
  });

  it('disallows xss', function() {
    var xss = '<script>alert("pwnd")</script>';
    message.set('body', xss);
    var view = new Whisper.MessageView({model: message});
    view.render();
    assert.include(view.$el.text(), xss); // should appear as escaped text
    assert.strictEqual(view.$el.find('script').length, 0); // should not appear as html
  });

  it('supports emoji', function() {
    message.set('body', 'I \u2764\uFE0F emoji!');
    var view = new Whisper.MessageView({model: message});
    view.render();
    var img = view.$el.find('.content img');
    assert.strictEqual(img.length, 1);
    assert.strictEqual(img.attr('src'), 'node_modules/emoji-datasource-apple/img/apple/64/2764-fe0f.png');
    assert.strictEqual(img.attr('title'), ':heart:');
    assert.strictEqual(img.attr('class'), 'emoji');
  });
});
