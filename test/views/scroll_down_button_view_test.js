describe('ScrollDownButtonView', function() {
  it('renders with count = 0', function() {
    var view = new Whisper.ScrollDownButtonView();
    view.render();
    assert.equal(view.count, 0);
    assert.match(view.$el.html(), /Scroll to bottom/);
  });

  it('renders with count = 1', function() {
    var view = new Whisper.ScrollDownButtonView({ count: 1 });
    view.render();
    assert.equal(view.count, 1);
    assert.match(view.$el.html(), /new-messages/);
    assert.match(view.$el.html(), /New message below/);
  });

  it('renders with count = 2', function() {
    var view = new Whisper.ScrollDownButtonView({ count: 2 });
    view.render();
    assert.equal(view.count, 2);

    assert.match(view.$el.html(), /new-messages/);
    assert.match(view.$el.html(), /New messages below/);
  });

  it('increments count and re-renders', function() {
    var view = new Whisper.ScrollDownButtonView();
    view.render();
    assert.equal(view.count, 0);
    assert.notMatch(view.$el.html(), /new-messages/);
    view.increment(1);
    assert.equal(view.count, 1);
    assert.match(view.$el.html(), /new-messages/);
  });
});
