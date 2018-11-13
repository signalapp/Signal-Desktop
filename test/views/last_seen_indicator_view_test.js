/* global Whisper */

describe('LastSeenIndicatorView', () => {
  it('renders provided count', () => {
    const view = new Whisper.LastSeenIndicatorView({ count: 10 });
    assert.equal(view.count, 10);

    view.render();
    assert.match(view.$el.html(), /10 Unread Messages/);
  });

  it('renders count of 1', () => {
    const view = new Whisper.LastSeenIndicatorView({ count: 1 });
    assert.equal(view.count, 1);

    view.render();
    assert.match(view.$el.html(), /1 Unread Message/);
  });

  it('increments count', () => {
    const view = new Whisper.LastSeenIndicatorView({ count: 4 });

    assert.equal(view.count, 4);
    view.render();
    assert.match(view.$el.html(), /4 Unread Messages/);

    view.increment(3);
    assert.equal(view.count, 7);
    view.render();
    assert.match(view.$el.html(), /7 Unread Messages/);
  });
});
